"""
YOLOv12 + SNN inference triggers for wheat disease detection.
"""
from fastapi import APIRouter, File, UploadFile

router = APIRouter(prefix="/diagnosis", tags=["diagnosis"])


@router.post("/upload")
async def run_diagnosis(image: UploadFile = File(...)):
    """
    Accept image upload; trigger YOLOv12/SNN inference and return detection results.
    """
    # TODO: integrate app.engines.vision (yolov12_nano, snn_inference)
    return {"status": "pending", "message": "Diagnosis endpoint - integrate vision engines"}
