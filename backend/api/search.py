from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.database import get_db
from backend.schemas.schemas import SearchRequest, SearchResponse, SearchResult
from backend.services.rag_service import (
    extract_relevant_snippet,
    fetch_document_titles,
    semantic_search,
)

router = APIRouter(tags=["search"])


@router.post("/search", response_model=SearchResponse)
async def search(req: SearchRequest, db: AsyncSession = Depends(get_db)):
    hits = await semantic_search(
        req.query,
        db,
        top_k=req.top_k,
        document_ids=req.document_ids,
    )

    document_ids = [chunk.document_id for chunk, _ in hits if chunk.document_id is not None]
    document_titles = await fetch_document_titles(db, document_ids)

    results = []
    for chunk, sim in hits:
        results.append(
            SearchResult(
                document_id=chunk.document_id,
                document_title=document_titles.get(chunk.document_id, "Unknown"),
                chunk_index=chunk.chunk_index,
                content=extract_relevant_snippet(chunk.content, req.query),
                similarity=round(sim, 4),
            )
        )

    return SearchResponse(query=req.query, results=results, total=len(results))
