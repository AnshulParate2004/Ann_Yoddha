"""
RAG-based treatment advice for detected wheat diseases.
"""
from fastapi import APIRouter

router = APIRouter(prefix="/recommendations", tags=["recommendations"])


@router.get("/")
async def get_recommendations(disease: str, severity: str | None = None):
    """
    Return treatment recommendations using RAG over agricultural journals.
    """
    # TODO: integrate app.engines.rag (vector_store, document_loader, chain)
    return {"disease": disease, "recommendations": [], "message": "Integrate RAG chain"}
