"""
Pydantic models for recommendation request/response.
"""
from pydantic import BaseModel
from typing import Optional


class RecommendationRequest(BaseModel):
    """Input for RAG-based recommendations."""
    disease: str
    severity: Optional[str] = None


class RecommendationResponse(BaseModel):
    """Treatment advice from RAG."""
    disease: str
    recommendations: str
    sources: Optional[list[str]] = []
