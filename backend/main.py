from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging

from backend.core.database import init_db
from backend.api import conversations, documents, search, system

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting Research Assistant API...")
    await init_db()
    logger.info("Database initialized.")
    yield
    logger.info("Shutting down.")


app = FastAPI(
    title="Research Assistant API",
    description="Local RAG-based document research assistant",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(conversations.router, prefix="/api")
app.include_router(documents.router, prefix="/api")
app.include_router(search.router, prefix="/api")
app.include_router(system.router, prefix="/api")


@app.get("/")
async def root():
    return {"status": "ok", "message": "Research Assistant API is running"}


@app.get("/health")
async def health():
    return {"status": "healthy"}
