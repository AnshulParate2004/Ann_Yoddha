"""
RAG treatment recommendations: Qdrant retrieval + Azure OpenAI (gpt-4o).
All config from env; returns list of treatments for the recommendations API.
"""
import json
import logging
from typing import Any

from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import AzureChatOpenAI
from pydantic import BaseModel, Field

from app.core.config import settings
from app.engines.rag.vector_store import query_vector_store

logger = logging.getLogger(__name__)


class TreatmentItem(BaseModel):
    """Single treatment for API response."""
    type: str = Field(description="One of: chemical, organic, preventive")
    name: str = Field(description="Short name of the treatment")
    description: str = Field(description="What to do and when")
    dosage: str | None = Field(default=None, description="Dosage or application instructions if applicable")


class TreatmentsResponse(BaseModel):
    """Structured LLM output: list of treatments."""
    treatments: list[TreatmentItem] = Field(description="List of treatment recommendations")


def _get_llm() -> AzureChatOpenAI:
    """Azure OpenAI chat model from settings."""
    return AzureChatOpenAI(
        azure_endpoint=settings.azure_openai_endpoint.rstrip("/"),
        api_key=settings.azure_openai_api_key,
        api_version=settings.openai_api_version,
        azure_deployment=settings.azure_openai_deployment,
        temperature=0,
    )


def _build_query(disease: str, severity: str | None) -> str:
    """Build retrieval query from disease and optional severity."""
    parts = [f"wheat disease {disease}", "treatment", "chemical organic preventive"]
    if severity:
        parts.append(f"severity {severity}")
    return " ".join(parts)


def get_recommendations(disease: str, severity: str | None = None) -> list[dict[str, Any]]:
    """
    RAG: retrieve context from Qdrant, then generate treatments with Azure OpenAI.
    Returns list of dicts: type, name, description, dosage (optional).
    """
    if not settings.rag_configured:
        raise RuntimeError("RAG not configured: set AZURE_OPENAI_* and QDRANT_* in .env")
    query = _build_query(disease, severity)
    context_chunks = query_vector_store(query, top_k=6)
    context = "\n\n".join(context_chunks) if context_chunks else "No specific treatment context found."
    prompt = ChatPromptTemplate.from_messages([
        ("system", """You are a wheat disease advisor. Using ONLY the following context about wheat disease treatments, output a JSON object with a single key "treatments" whose value is a list of treatment objects. Each object must have: "type" (chemical, organic, or preventive), "name", "description", and optionally "dosage". If context does not mention the disease, suggest general wheat disease management. Output only valid JSON, no markdown."""),
        ("human", "Disease: {disease}\nSeverity: {severity}\n\nContext:\n{context}\n\nJSON output:"),
    ])
    llm = _get_llm()
    chain = prompt | llm
    severity_str = severity or "not specified"
    try:
        msg = chain.invoke({"disease": disease, "severity": severity_str, "context": context})
        text = msg.content if hasattr(msg, "content") else str(msg)
        # Strip markdown code block if present
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0].strip()
        elif "```" in text:
            text = text.split("```")[1].split("```")[0].strip()
        data = json.loads(text)
        raw = data.get("treatments") or []
        validated = [TreatmentItem(**(t if isinstance(t, dict) else t.model_dump())) for t in raw]
        return [t.model_dump() for t in validated]
    except (json.JSONDecodeError, Exception) as e:
        logger.warning("RAG chain failed (%s), falling back to empty list: %s", disease, e)
        return []
