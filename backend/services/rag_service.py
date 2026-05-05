import math
import logging
import re
from typing import Dict, List, Optional, Tuple

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.config import settings
from backend.models.models import Document, DocumentChunk
from backend.services.ollama_service import ollama_service

logger = logging.getLogger(__name__)

SECTION_PATTERNS = [
    "summary",
    "professional summary",
    "profile",
    "objective",
    "education",
    "experience",
    "work experience",
    "internship",
    "internships",
    "projects",
    "project",
    "skills",
    "technical skills",
    "core skills",
    "certifications",
    "certification",
    "certifications & awards",
    "awards",
    "achievements",
    "languages",
    "additional information",
    "contact",
]

SECTION_ALIASES = {
    "certificate": "certifications",
    "certificates": "certifications",
    "certification": "certifications",
    "certifications": "certifications",
    "award": "awards",
    "awards": "awards",
    "skill": "skills",
    "skills": "skills",
    "project": "projects",
    "projects": "projects",
    "education": "education",
    "experience": "experience",
    "internship": "experience",
    "internships": "experience",
    "language": "languages",
    "languages": "languages",
    "summary": "summary",
}

HEADING_TERMS = sorted(set(SECTION_PATTERNS), key=len, reverse=True)
HEADING_PATTERN = "|".join(re.escape(p) for p in HEADING_TERMS)

INLINE_HEADING_REGEX = re.compile(
    rf"(?i)(?<![A-Za-z])({HEADING_PATTERN})(\s*[:&\-])?"
)
LINE_HEADING_REGEX = re.compile(
    rf"(?im)^\s*({HEADING_PATTERN})(?:\s*[:\-]|\s*&\s*awards)?\s*$"
)
SECTION_LINE_REGEX = re.compile(r"(?im)^section:\s*([a-z &]+)\s*$")


def canonicalize_section_name(name: str) -> str:
    cleaned = re.sub(r"\s+", " ", name.lower().replace("&", " and ")).strip(" :-")

    if "certification" in cleaned or "award" in cleaned:
        return "certifications"
    if "skill" in cleaned:
        return "skills"
    if "project" in cleaned:
        return "projects"
    if "education" in cleaned:
        return "education"
    if "experience" in cleaned or "internship" in cleaned:
        return "experience"
    if "language" in cleaned:
        return "languages"
    if "summary" in cleaned or "profile" in cleaned or "objective" in cleaned:
        return "summary"
    if "additional information" in cleaned:
        return "additional information"

    return cleaned


def normalize_text(text: str) -> str:
    if not text:
        return ""

    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = text.replace("\t", " ")

    # Fix common PDF text collapse patterns.
    text = re.sub(r"(?<=[a-z])(?=[A-Z])", " ", text)
    text = re.sub(r"(?<=[A-Za-z])(?=[0-9])", " ", text)
    text = re.sub(r"(?<=[0-9])(?=[A-Za-z])", " ", text)

    # Ensure section headings start on their own line even when PDFs collapse them inline.
    def heading_break(match: re.Match) -> str:
        heading = match.group(1)
        suffix = match.group(2) or ""
        return f"\n{heading}{suffix}\n"

    text = INLINE_HEADING_REGEX.sub(heading_break, text)

    # Clean spacing and empty lines.
    lines: List[str] = []
    for raw_line in text.split("\n"):
        line = re.sub(r"\s+", " ", raw_line).strip(" -•\t")
        if line:
            lines.append(line)

    text = "\n".join(lines)
    text = re.sub(r"\n{3,}", "\n\n", text)

    return text.strip()


def detect_target_sections(query: str) -> List[str]:
    query_lower = query.lower()
    found: List[str] = []

    for raw, normalized in SECTION_ALIASES.items():
        if raw in query_lower and normalized not in found:
            found.append(normalized)

    return found


def split_into_sections(text: str) -> List[Tuple[str, str]]:
    text = normalize_text(text)
    if not text:
        return []

    lines = [line.strip() for line in text.split("\n") if line.strip()]
    sections: List[Tuple[str, List[str]]] = []
    current_title = "general"
    current_lines: List[str] = []

    def flush() -> None:
        nonlocal current_lines
        content = "\n".join(current_lines).strip()
        if content:
            sections.append((current_title, current_lines[:]))
            current_lines = []

    for line in lines:
        if LINE_HEADING_REGEX.match(line):
            flush()
            current_title = canonicalize_section_name(line)
            continue
        current_lines.append(line)

    flush()

    if not sections:
        return [("general", text)]

    merged: List[Tuple[str, str]] = []
    for title, content_lines in sections:
        content = "\n".join(content_lines).strip()
        if not content:
            continue

        if merged and merged[-1][0] == title:
            merged[-1] = (title, merged[-1][1] + "\n" + content)
        else:
            merged.append((title, content))

    return merged


def chunk_words(text: str, chunk_size: int, overlap: int) -> List[str]:
    words = text.split()
    if not words:
        return []

    chunks: List[str] = []
    step = max(1, chunk_size - overlap)
    i = 0

    while i < len(words):
        end = min(i + chunk_size, len(words))
        chunk = " ".join(words[i:end]).strip()
        if chunk:
            chunks.append(chunk)
        i += step

    return chunks


def chunk_text(
    text: str,
    chunk_size: Optional[int] = None,
    overlap: Optional[int] = None,
) -> List[str]:
    # Smaller chunks work better for structured docs like resumes.
    chunk_size = min(chunk_size or settings.max_chunk_size, 120)
    overlap = min(overlap or settings.chunk_overlap, 20)

    normalized = normalize_text(text)
    sections = split_into_sections(normalized)
    all_chunks: List[str] = []

    for section_title, section_content in sections:
        section_chunks = chunk_words(
            section_content,
            chunk_size=chunk_size,
            overlap=overlap,
        )

        if not section_chunks and section_content:
            section_chunks = [section_content]

        for chunk in section_chunks:
            if section_title != "general":
                all_chunks.append(f"Section: {section_title}\n{chunk}")
            else:
                all_chunks.append(chunk)

    return all_chunks


def cosine_similarity(a: List[float], b: List[float]) -> float:
    if not a or not b or len(a) != len(b):
        return 0.0

    dot = sum(x * y for x, y in zip(a, b))
    mag_a = math.sqrt(sum(x * x for x in a))
    mag_b = math.sqrt(sum(x * x for x in b))

    if mag_a == 0 or mag_b == 0:
        return 0.0

    return dot / (mag_a * mag_b)


def lexical_overlap_score(query: str, content: str) -> float:
    ignored = {
        "what",
        "inside",
        "section",
        "tell",
        "resume",
        "pdf",
        "kanishk",
    }

    query_terms = {
        term
        for term in re.findall(r"[a-zA-Z]{3,}", query.lower())
        if term not in ignored
    }

    if not query_terms:
        return 0.0

    content_lower = content.lower()
    hits = sum(1 for term in query_terms if term in content_lower)

    return min(hits * 0.08, 0.24)


def extract_section_name(content: str) -> Optional[str]:
    match = SECTION_LINE_REGEX.search(content)
    if not match:
        return None
    return canonicalize_section_name(match.group(1))


def extract_relevant_snippet(content: str, query: str, max_len: int = 320) -> str:
    target_sections = detect_target_sections(query)
    snippet = content.strip()

    if snippet.lower().startswith("section:"):
        parts = snippet.split("\n", 1)
        section_header = parts[0].strip()
        body = parts[1].strip() if len(parts) > 1 else ""
        section_name = canonicalize_section_name(
            section_header.replace("Section:", "", 1)
        )

        if target_sections and section_name in target_sections:
            snippet = body or snippet
        else:
            snippet = f"{section_header} {body}".strip()

    snippet = re.sub(r"\s+", " ", snippet).strip()

    if len(snippet) <= max_len:
        return snippet

    return snippet[: max_len - 3].rstrip() + "..."


async def fetch_document_titles(
    db: AsyncSession,
    document_ids: List[int],
) -> Dict[int, str]:
    if not document_ids:
        return {}

    result = await db.execute(
        select(Document.id, Document.title).where(
            Document.id.in_(sorted(set(document_ids)))
        )
    )
    return {doc_id: title for doc_id, title in result.all()}


async def embed_document(document_id: int, db: AsyncSession) -> int:
    result = await db.execute(
        select(Document).where(Document.id == document_id)
    )
    doc = result.scalar_one_or_none()

    if not doc:
        raise ValueError(f"Document {document_id} not found")

    cleaned_content = normalize_text(doc.content)
    doc.content = cleaned_content

    existing = await db.execute(
        select(DocumentChunk).where(DocumentChunk.document_id == document_id)
    )
    for chunk in existing.scalars().all():
        await db.delete(chunk)

    await db.flush()

    chunks = chunk_text(cleaned_content)

    for i, chunk_text_val in enumerate(chunks):
        embedding = await ollama_service.embed(chunk_text_val)
        db_chunk = DocumentChunk(
            document_id=document_id,
            chunk_index=i,
            content=chunk_text_val,
            embedding=embedding,
        )
        db.add(db_chunk)

    doc.is_embedded = True
    doc.chunk_count = len(chunks)
    await db.flush()

    return len(chunks)


async def semantic_search(
    query: str,
    db: AsyncSession,
    top_k: int = 5,
    document_ids: Optional[List[int]] = None,
) -> List[Tuple[DocumentChunk, float]]:
    query_embedding = await ollama_service.embed(query)
    target_sections = detect_target_sections(query)

    stmt = select(DocumentChunk).where(DocumentChunk.embedding.is_not(None))
    if document_ids:
        stmt = stmt.where(DocumentChunk.document_id.in_(document_ids))

    result = await db.execute(stmt)
    chunks = result.scalars().all()

    scored: List[Tuple[DocumentChunk, float]] = []

    for chunk in chunks:
        if not chunk.embedding:
            continue

        sim = cosine_similarity(query_embedding, chunk.embedding)
        content_lower = chunk.content.lower()
        content_section = extract_section_name(chunk.content)

        score = sim + lexical_overlap_score(query, chunk.content)

        if target_sections:
            if content_section and content_section in target_sections:
                score += 0.75
            elif any(f"section: {section}" in content_lower for section in target_sections):
                score += 0.60
            elif any(section in content_lower for section in target_sections):
                score += 0.15
            else:
                score -= 0.20

        scored.append((chunk, score))

    scored.sort(key=lambda x: x[1], reverse=True)
    return scored[:top_k]