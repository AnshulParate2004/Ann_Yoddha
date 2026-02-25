"""
Qdrant vector store for RAG. Uses Azure OpenAI embeddings; all config from env.
"""
import logging
from typing import Any

from app.core.config import settings
from app.engines.rag.knowledge_base import KNOWLEDGE

logger = logging.getLogger(__name__)

_vector_store: Any = None
_embeddings: Any = None


def _get_embeddings():
    global _embeddings
    if _embeddings is None:
        from langchain_openai import AzureOpenAIEmbeddings
        _embeddings = AzureOpenAIEmbeddings(
            azure_endpoint=settings.azure_openai_endpoint.rstrip("/"),
            api_key=settings.azure_openai_api_key,
            api_version=settings.openai_api_version,
            azure_deployment=settings.azure_openai_embedding_deployment,
        )
    return _embeddings


def _knowledge_to_text_chunks() -> list[str]:
    """Convert KNOWLEDGE dict into text chunks for indexing (one chunk per treatment)."""
    chunks = []
    for disease_key, treatments in KNOWLEDGE.items():
        disease_name = disease_key.replace("_", " ").title()
        for t in treatments:
            parts = [
                f"Wheat disease: {disease_name}.",
                f"Treatment type: {t.get('type', '')}.",
                f"Name: {t.get('name', '')}.",
                f"Description: {t.get('description', '')}.",
            ]
            if t.get("dosage"):
                parts.append(f"Dosage: {t['dosage']}.")
            chunks.append(" ".join(parts))
    return chunks


def get_vector_store(ensure_seeded: bool = True):
    """Return Qdrant vector store, optionally seeding from knowledge if empty."""
    global _vector_store
    if _vector_store is not None:
        if ensure_seeded:
            _ensure_collection_seeded()
        return _vector_store
    if not settings.rag_configured:
        raise RuntimeError("RAG not configured: set AZURE_OPENAI_* and QDRANT_* in .env")
    from langchain_qdrant import QdrantVectorStore
    from qdrant_client import QdrantClient
    client = QdrantClient(
        url=settings.qdrant_url,
        api_key=settings.qdrant_api_key or None,
    )
    embeddings = _get_embeddings()
    _vector_store = QdrantVectorStore(
        client=client,
        collection_name=settings.qdrant_collection_name,
        embedding=embeddings,
    )
    if ensure_seeded:
        _ensure_collection_seeded()
    return _vector_store


def _ensure_collection_seeded():
    """If collection is missing or empty, create it and seed from KNOWLEDGE."""
    from qdrant_client import QdrantClient
    from qdrant_client.http.models import Distance, VectorParams
    # Azure text-embedding-3-small dimension
    vector_size = 1536
    try:
        client = QdrantClient(
            url=settings.qdrant_url,
            api_key=settings.qdrant_api_key or None,
        )
        try:
            coll = client.get_collection(settings.qdrant_collection_name)
            if coll.points_count > 0:
                return
        except Exception:
            pass
        client.create_collection(
            collection_name=settings.qdrant_collection_name,
            vectors_config=VectorParams(size=vector_size, distance=Distance.COSINE),
        )
    except Exception as e:
        if "already exists" not in str(e).lower():
            logger.warning("Could not create Qdrant collection: %s", e)
            return
    try:
        store = _vector_store or get_vector_store(ensure_seeded=False)
        chunks = _knowledge_to_text_chunks()
        if chunks:
            store.add_texts(chunks)
            logger.info("Seeded Qdrant with %s wheat disease treatment chunks", len(chunks))
    except Exception as e:
        logger.warning("Could not seed Qdrant: %s", e)


def query_vector_store(query: str, top_k: int = 5) -> list[str]:
    """Retrieve relevant text chunks from Qdrant for the query."""
    store = get_vector_store()
    docs = store.similarity_search(query, k=top_k)
    return [d.page_content for d in docs]
