from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional
import io

from backend.core.database import get_db
from backend.models.models import Document
from backend.schemas.schemas import DocumentCreate, DocumentResponse, EmbedResponse
from backend.services.rag_service import embed_document, normalize_text
import logging

logger = logging.getLogger(__name__)
router = APIRouter(tags=["documents"])


@router.post("/documents", response_model=DocumentResponse)
async def create_document(data: DocumentCreate, db: AsyncSession = Depends(get_db)):
    cleaned_content = normalize_text(data.content)
    doc = Document(title=data.title, content=cleaned_content, file_type="text")
    db.add(doc)
    await db.flush()
    await db.refresh(doc)
    return DocumentResponse(
        id=doc.id,
        title=doc.title,
        file_type=doc.file_type,
        file_size=len(cleaned_content.encode()),
        is_embedded=doc.is_embedded,
        chunk_count=doc.chunk_count,
        created_at=doc.created_at,
        updated_at=doc.updated_at,
        content_preview=cleaned_content[:200],
    )


@router.post("/documents/upload", response_model=DocumentResponse)
async def upload_document(
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
    db: AsyncSession = Depends(get_db),
):
    content_bytes = await file.read()
    file_type = file.content_type or "text/plain"
    doc_title = title or file.filename or "Uploaded Document"

    if "pdf" in file_type:
        try:
            import PyPDF2
            reader = PyPDF2.PdfReader(io.BytesIO(content_bytes))
            text = "\n".join(page.extract_text() or "" for page in reader.pages)
        except Exception:
            text = content_bytes.decode("utf-8", errors="replace")
    else:
        text = content_bytes.decode("utf-8", errors="replace")

    cleaned_text = normalize_text(text)

    doc = Document(
        title=doc_title,
        content=cleaned_text,
        file_type=file_type,
        file_size=len(content_bytes),
    )
    db.add(doc)
    await db.flush()
    await db.refresh(doc)
    return DocumentResponse(
        id=doc.id,
        title=doc.title,
        file_type=doc.file_type,
        file_size=doc.file_size,
        is_embedded=False,
        chunk_count=0,
        created_at=doc.created_at,
        updated_at=doc.updated_at,
        content_preview=cleaned_text[:200],
    )


@router.get("/documents", response_model=List[DocumentResponse])
async def list_documents(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Document).order_by(Document.created_at.desc()))
    docs = result.scalars().all()
    return [
        DocumentResponse(
            id=d.id,
            title=d.title,
            file_type=d.file_type,
            file_size=d.file_size,
            is_embedded=d.is_embedded,
            chunk_count=d.chunk_count,
            created_at=d.created_at,
            updated_at=d.updated_at,
            content_preview=d.content[:200] if d.content else None,
        )
        for d in docs
    ]


@router.delete("/documents/{doc_id}")
async def delete_document(doc_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Document).where(Document.id == doc_id))
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    await db.delete(doc)
    return {"status": "deleted"}


@router.post("/documents/{doc_id}/embed", response_model=EmbedResponse)
async def embed_doc(doc_id: int, db: AsyncSession = Depends(get_db)):
    try:
        n = await embed_document(doc_id, db)
        return EmbedResponse(document_id=doc_id, chunks_created=n, status="success")
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Embedding failed: {str(e)}")
