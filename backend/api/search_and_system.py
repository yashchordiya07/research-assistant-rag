from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from backend.core.database import get_db
from backend.models.models import Document, Conversation
from backend.schemas.schemas import SearchRequest, SearchResponse, SearchResult, SystemStatus
from backend.services.rag_service import semantic_search
from backend.services.ollama_service import ollama_service
import logging

logger = logging.getLogger(__name__)

# ─── Search Router ────────────────────────────────────────────────────────────
search_router = APIRouter(tags=["search"])


@search_router.post("/search", response_model=SearchResponse)
async def search(req: SearchRequest, db: AsyncSession = Depends(get_db)):
    hits = await semantic_search(req.query, db, top_k=req.top_k, document_ids=req.document_ids)
    results = []
    for chunk, sim in hits:
        results.append(SearchResult(
            document_id=chunk.document_id,
            document_title=chunk.document.title if chunk.document else "Unknown",
            chunk_index=chunk.chunk_index,
            content=chunk.content,
            similarity=round(sim, 4),
        ))
    return SearchResponse(query=req.query, results=results, total=len(results))


# ─── System Router ────────────────────────────────────────────────────────────
system_router = APIRouter(tags=["system"])


@system_router.get("/system/status", response_model=SystemStatus)
async def get_status(db: AsyncSession = Depends(get_db)):
    db_ok = "ok"
    try:
        await db.execute(select(func.count()).select_from(Document))
    except Exception:
        db_ok = "error"

    ollama_ok = "ok" if await ollama_service.is_available() else "unavailable"
    models = await ollama_service.list_models() if ollama_ok == "ok" else []

    doc_count_r = await db.execute(select(func.count()).select_from(Document))
    doc_count = doc_count_r.scalar_one()

    emb_count_r = await db.execute(
        select(func.count()).select_from(Document).where(Document.is_embedded == True)
    )
    emb_count = emb_count_r.scalar_one()

    conv_count_r = await db.execute(select(func.count()).select_from(Conversation))
    conv_count = conv_count_r.scalar_one()

    from backend.core.config import settings
    return SystemStatus(
        api="ok",
        database=db_ok,
        ollama=ollama_ok,
        ollama_model=settings.ollama_model,
        embedding_model=settings.ollama_embedding_model,
        models_available=models,
        document_count=doc_count,
        embedded_count=emb_count,
        conversation_count=conv_count,
    )


# Export single router objects consumed by main.py
router = APIRouter()
router.include_router(search_router)
router.include_router(system_router)
