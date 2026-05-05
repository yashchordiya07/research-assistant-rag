from pydantic import BaseModel, Field
from typing import Optional, List, Any
from datetime import datetime


# ─── Conversation ────────────────────────────────────────────────────────────

class ConversationCreate(BaseModel):
    title: str = "New Conversation"


class ConversationResponse(BaseModel):
    id: int
    title: str
    created_at: datetime
    updated_at: datetime
    message_count: int = 0

    class Config:
        from_attributes = True


# ─── Messages ────────────────────────────────────────────────────────────────

class MessageResponse(BaseModel):
    id: int
    conversation_id: int
    role: str
    content: str
    sources: Optional[List[Any]] = None
    confidence: Optional[float] = None
    model: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ─── Chat ────────────────────────────────────────────────────────────────────

class ChatRequest(BaseModel):
    conversation_id: int
    message: str
    use_rag: bool = True
    top_k: int = Field(default=5, ge=1, le=20)


class SourceChunk(BaseModel):
    document_id: int
    document_title: str
    chunk_index: int
    content: str
    similarity: float


class ChatResponse(BaseModel):
    message: MessageResponse
    sources: List[SourceChunk] = []
    confidence: Optional[float] = None
    rag_used: bool = False


# ─── Documents ───────────────────────────────────────────────────────────────

class DocumentCreate(BaseModel):
    title: str
    content: str


class DocumentResponse(BaseModel):
    id: int
    title: str
    file_type: Optional[str] = None
    file_size: Optional[int] = None
    is_embedded: bool
    chunk_count: int
    created_at: datetime
    updated_at: datetime
    content_preview: Optional[str] = None

    class Config:
        from_attributes = True


class EmbedResponse(BaseModel):
    document_id: int
    chunks_created: int
    status: str


# ─── Search ──────────────────────────────────────────────────────────────────

class SearchRequest(BaseModel):
    query: str
    top_k: int = Field(default=5, ge=1, le=20)
    document_ids: Optional[List[int]] = None


class SearchResult(BaseModel):
    document_id: int
    document_title: str
    chunk_index: int
    content: str
    similarity: float


class SearchResponse(BaseModel):
    query: str
    results: List[SearchResult]
    total: int


# ─── System ──────────────────────────────────────────────────────────────────

class SystemStatus(BaseModel):
    api: str
    database: str
    ollama: str
    ollama_model: str
    embedding_model: str
    models_available: List[str] = []
    document_count: int = 0
    embedded_count: int = 0
    conversation_count: int = 0
