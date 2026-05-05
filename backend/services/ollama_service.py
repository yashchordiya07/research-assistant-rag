import httpx
import json
import logging
from typing import List, Optional, AsyncGenerator
from backend.core.config import settings

logger = logging.getLogger(__name__)


class OllamaService:
    def __init__(self):
        self.base_url = settings.ollama_base_url
        self.model = settings.ollama_model
        self.embedding_model = settings.ollama_embedding_model
        self.timeout = settings.ollama_timeout

    async def is_available(self) -> bool:
        try:
            async with httpx.AsyncClient(timeout=5) as client:
                resp = await client.get(f"{self.base_url}/api/tags")
                return resp.status_code == 200
        except Exception:
            return False

    async def list_models(self) -> List[str]:
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(f"{self.base_url}/api/tags")
                data = resp.json()
                return [m["name"] for m in data.get("models", [])]
        except Exception:
            return []

    async def generate(self, prompt: str, system: Optional[str] = None, context: Optional[str] = None) -> str:
        full_prompt = prompt
        if context:
            full_prompt = f"Context:\n{context}\n\nQuestion: {prompt}"

        payload = {
            "model": self.model,
            "prompt": full_prompt,
            "stream": False,
            "options": {"temperature": 0.3, "num_predict": 1024},
        }
        if system:
            payload["system"] = system

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                resp = await client.post(f"{self.base_url}/api/generate", json=payload)
                resp.raise_for_status()
                data = resp.json()
                return data.get("response", "")
        except httpx.TimeoutException:
            raise RuntimeError("Ollama request timed out. Is the model loaded?")
        except Exception as e:
            raise RuntimeError(f"Ollama generate error: {e}")

    async def embed(self, text: str) -> List[float]:
        try:
            async with httpx.AsyncClient(timeout=60) as client:
                resp = await client.post(
                    f"{self.base_url}/api/embeddings",
                    json={"model": self.embedding_model, "prompt": text},
                )
                resp.raise_for_status()
                data = resp.json()
                return data.get("embedding", [])
        except Exception as e:
            raise RuntimeError(f"Ollama embedding error: {e}")

    async def embed_batch(self, texts: List[str]) -> List[List[float]]:
        results = []
        for text in texts:
            emb = await self.embed(text)
            results.append(emb)
        return results


ollama_service = OllamaService()
