"""
YOLOv12 + SNN inference triggers for wheat disease detection.
"""
from fastapi import APIRouter, File, UploadFile

router = APIRouter(prefix="/diagnosis", tags=["diagnosis"])


@router.post("/upload")
async def run_diagnosis(image: UploadFile = File(...)):
    """
    Accept image upload; trigger YOLOv12/SNN inference and return detection results.
    Until the vision engine is integrated, returns a stub so the frontend can test the recommendations flow.
    """
    # TODO: integrate app.engines.vision (yolov12_nano, snn_inference)
    # Stub for demo: one detection so "View Recommendations" returns RAG results (Rust, Leaf blight, Karnal bunt, FHB).
    return {
        "status": "ok",
        "detections": [
            {"disease": "Rust", "confidence": 0.85, "severity": "medium"},
        ],
    }
