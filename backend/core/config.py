import os
from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    database_url: str = "sqlite+aiosqlite:///./research_assistant.db"
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "mistral"
    ollama_embedding_model: str = "nomic-embed-text"
    ollama_timeout: int = 120
    upload_dir: str = "./uploads"
    max_chunk_size: int = 500
    chunk_overlap: int = 50
    top_k_results: int = 5
    local_mode: bool = True

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
