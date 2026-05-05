from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
import logging

from backend.core.database import get_db
from backend.models.models import Conversation, Message
from backend.schemas.schemas import (
    ChatRequest,
    ChatResponse,
    ConversationCreate,
    ConversationResponse,
    MessageResponse,
    SourceChunk,
)
from backend.services.ollama_service import ollama_service
from backend.services.rag_service import (
    detect_target_sections,
    extract_relevant_snippet,
    fetch_document_titles,
    semantic_search,
)

logger = logging.getLogger(__name__)
router = APIRouter(tags=["conversations"])


@router.post("/conversations", response_model=ConversationResponse)
async def create_conversation(
    data: ConversationCreate,
    db: AsyncSession = Depends(get_db),
):
    conv = Conversation(title=data.title)
    db.add(conv)
    await db.flush()
    await db.refresh(conv)

    return ConversationResponse(
        id=conv.id,
        title=conv.title,
        created_at=conv.created_at,
        updated_at=conv.updated_at,
        message_count=0,
    )


@router.get("/conversations", response_model=List[ConversationResponse])
async def list_conversations(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Conversation).order_by(Conversation.updated_at.desc())
    )
    convs = result.scalars().all()

    out = []
    for c in convs:
        cnt_r = await db.execute(
            select(func.count()).select_from(Message).where(
                Message.conversation_id == c.id
            )
        )
        out.append(
            ConversationResponse(
                id=c.id,
                title=c.title,
                created_at=c.created_at,
                updated_at=c.updated_at,
                message_count=cnt_r.scalar_one(),
            )
        )

    return out


@router.get("/conversations/{conv_id}/messages", response_model=List[MessageResponse])
async def get_messages(conv_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Message)
        .where(Message.conversation_id == conv_id)
        .order_by(Message.created_at)
    )
    return result.scalars().all()


@router.delete("/conversations/{conv_id}")
async def delete_conversation(conv_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Conversation).where(Conversation.id == conv_id)
    )
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    await db.delete(conv)
    await db.flush()

    return {"status": "deleted"}


@router.patch("/conversations/{conv_id}")
async def rename_conversation(
    conv_id: int,
    data: ConversationCreate,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Conversation).where(Conversation.id == conv_id)
    )
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    conv.title = data.title
    await db.flush()

    return {"status": "updated"}


@router.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Conversation).where(Conversation.id == req.conversation_id)
    )
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    user_msg = Message(
        conversation_id=req.conversation_id,
        role="user",
        content=req.message,
    )
    db.add(user_msg)
    await db.flush()

    sources_out = []
    rag_used = False
    raw_sources = []
    context_str = ""
    confidence = None

    target_sections = detect_target_sections(req.message)

    if req.use_rag:
        try:
            hits = await semantic_search(
                req.message,
                db,
                top_k=req.top_k,
            )

            document_titles = await fetch_document_titles(
                db,
                [chunk.document_id for chunk, _ in hits if chunk.document_id is not None],
            )

            if hits:
                rag_used = True
                context_parts = []
                filtered_hits = []

                if target_sections:
                    for chunk, sim in hits:
                        snippet = extract_relevant_snippet(chunk.content, req.message)
                        if snippet and not snippet.lower().startswith("section:"):
                            filtered_hits.append((chunk, sim))
                    if filtered_hits:
                        hits = filtered_hits

                for chunk, sim in hits:
                    if sim > 0.15:
                        document_title = document_titles.get(chunk.document_id, "Unknown")
                        snippet = extract_relevant_snippet(
                            chunk.content,
                            req.message,
                            max_len=500,
                        )

                        context_parts.append(
                            f"[Source: {document_title}, chunk {chunk.chunk_index}]\n{snippet}"
                        )

                        raw_sources.append(
                            {
                                "document_id": chunk.document_id,
                                "document_title": document_title,
                                "chunk_index": chunk.chunk_index,
                                "content": snippet,
                                "similarity": round(sim, 4),
                            }
                        )

                        sources_out.append(
                            SourceChunk(
                                document_id=chunk.document_id,
                                document_title=document_title,
                                chunk_index=chunk.chunk_index,
                                content=snippet,
                                similarity=round(sim, 4),
                            )
                        )

                if context_parts:
                    context_str = "\n\n".join(context_parts)
                    top_sim = hits[0][1]
                    confidence = round(min(top_sim * 1.05, 1.0), 3)

        except Exception as e:
            logger.warning(f"RAG retrieval failed: {e}")

    section_instruction = ""
    if target_sections:
        joined = ", ".join(target_sections)
        section_instruction = (
            f" The user is asking about the following section(s): {joined}."
            " Only answer from those section(s)."
            " Return a short clean answer with bullets."
            " If the section is not found in context, say that clearly."
        )

    system_prompt = (
        "You are a precise research assistant. "
        "Answer using only the provided context when context exists. "
        "Never dump the whole document. "
        "Prefer the most relevant snippet. "
        "If the question asks about a section, answer only that section. "
        "If the context is insufficient, say that clearly instead of guessing."
        + section_instruction
    )

    try:
        response_text = await ollama_service.generate(
            prompt=req.message,
            system=system_prompt,
            context=context_str if context_str else None,
        )
    except Exception as e:
        response_text = f"Error generating response: {str(e)}"

    assistant_msg = Message(
        conversation_id=req.conversation_id,
        role="assistant",
        content=response_text,
        sources=raw_sources if rag_used else None,
        confidence=confidence,
        model=ollama_service.model,
    )
    db.add(assistant_msg)
    await db.flush()
    await db.refresh(assistant_msg)

    return ChatResponse(
        message=MessageResponse(
            id=assistant_msg.id,
            conversation_id=assistant_msg.conversation_id,
            role=assistant_msg.role,
            content=assistant_msg.content,
            sources=assistant_msg.sources,
            confidence=assistant_msg.confidence,
            model=assistant_msg.model,
            created_at=assistant_msg.created_at,
        ),
        sources=sources_out,
        confidence=confidence,
        rag_used=rag_used,
    )