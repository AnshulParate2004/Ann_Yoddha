"""
RAG-based treatment advice for detected wheat diseases (Rust, Leaf blight, Karnal bunt, Fusarium head blight).
Uses Qdrant + Azure OpenAI; config via .env.
"""
from fastapi import APIRouter, HTTPException

from app.engines.rag.chain import get_recommendations as rag_get_recommendations

router = APIRouter(prefix="/recommendations", tags=["recommendations"])


@router.get("/")
async def get_recommendations(disease: str, severity: str | None = None):
    """
    Return treatment recommendations (chemical, organic, preventive) using RAG (Qdrant + Azure OpenAI).
    """
    try:
        treatments = rag_get_recommendations(disease, severity)
    except RuntimeError as e:
        if "not configured" in str(e).lower():
            raise HTTPException(status_code=503, detail="Recommendations service not configured (set Azure OpenAI and Qdrant in .env)") from e
        raise HTTPException(status_code=500, detail=str(e)) from e
    return {
        "disease": disease,
        "treatments": treatments,
    }
