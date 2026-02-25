"""
Pydantic models for diagnosis request/response.
"""
from pydantic import BaseModel
from typing import Optional


class DetectionItem(BaseModel):
    """Single detection (disease, bbox, confidence)."""
    disease: str
    confidence: float
    bbox: Optional[list[float]] = None


class DiagnosisResponse(BaseModel):
    """Response after running YOLOv12/SNN inference."""
    success: bool = True
    detections: list[DetectionItem] = []
    message: Optional[str] = None
