from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from backend.core.database import get_db
from backend.models.models import Document, Conversation
from backend.schemas.schemas import SystemStatus
from backend.services.ollama_service import ollama_service
from backend.core.config import settings

router = APIRouter(tags=["system"])


@router.get("/system/status", response_model=SystemStatus)
async def get_status(db: AsyncSession = Depends(get_db)):
    db_ok = "ok"
    try:
        await db.execute(select(func.count()).select_from(Document))
    except Exception:
        db_ok = "error"

    ollama_ok = "ok" if await ollama_service.is_available() else "unavailable"
    models = await ollama_service.list_models() if ollama_ok == "ok" else []

    doc_count = (await db.execute(select(func.count()).select_from(Document))).scalar_one()
    emb_count = (await db.execute(
        select(func.count()).select_from(Document).where(Document.is_embedded == True)
    )).scalar_one()
    conv_count = (await db.execute(select(func.count()).select_from(Conversation))).scalar_one()

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
