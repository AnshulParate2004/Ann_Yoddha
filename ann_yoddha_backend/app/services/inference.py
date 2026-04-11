"""Reusable Keras inference helpers for wheat disease prediction."""

from __future__ import annotations

from functools import lru_cache
from io import BytesIO
from pathlib import Path

from PIL import Image, UnidentifiedImageError
from ultralytics import YOLO

CLASS_NAMES = [
    "yellow rust",
    "leaf blight",
    "tan spot",
    "black rust",
    "mildew",
    "mite",
    "stem fly",
    "common root rot",
    "blast",
    "healthy",
    "brown rust",
    "smut",
    "aphid",
    "fusarium head blight",
    "septoria",
]

UNCERTAIN_LABEL = "uncertain"
CONFIDENCE_THRESHOLD = 0.10
MODEL_PATH = Path(__file__).resolve().parents[2] / "models" / "best.pt"

TREATMENTS = {
    "yellow rust": "Spray a triazole fungicide early and remove heavily infected leaves from the field margin.",
    "leaf blight": "Use a recommended fungicide, avoid overhead irrigation, and rotate away from wheat after harvest.",
    "tan spot": "Apply a protective fungicide, manage crop residue, and use balanced nutrition to reduce stress.",
    "black rust": "Scout nearby plants, spray a rust-targeted fungicide quickly, and avoid late nitrogen overuse.",
    "mildew": "Improve air flow, avoid dense irrigation conditions, and apply a mildew-labeled fungicide if spread continues.",
    "mite": "Inspect the field closely, control volunteer hosts, and use a recommended miticide only when infestation is confirmed.",
    "stem fly": "Remove badly damaged tillers, manage grasses around the field, and use targeted insect control if pressure is high.",
    "common root rot": "Improve drainage, rotate crops, and use seed treatment plus balanced fertility for the next planting.",
    "blast": "Remove infected heads where practical, avoid excess nitrogen, and apply a blast-recommended fungicide promptly.",
    "healthy": "No urgent treatment needed. Continue scouting and preventive care.",
    "brown rust": "Use a rust fungicide at early spread, monitor upper leaves, and avoid delaying treatment during humid weather.",
    "smut": "Do not rely on foliar sprays; use clean seed and systemic seed treatment before the next sowing cycle.",
    "aphid": "Check infestation level, protect beneficial insects where possible, and use a recommended insecticide if thresholds are crossed.",
    "fusarium head blight": "Avoid overhead moisture at flowering, harvest promptly, and apply a labeled fungicide at the correct stage.",
    "septoria": "Spray a broad-spectrum fungicide, reduce leaf wetness, and rotate crops to lower carryover pressure.",
    "uncertain": "Retake the image in better lighting and focus on one leaf or wheat head. Avoid spraying only from this result.",
}


class InferenceError(Exception):
    """Raised when an uploaded file cannot be processed for prediction."""


@lru_cache(maxsize=1)
def load_model():
    """Load the trained YOLO model once per process."""
    return YOLO(MODEL_PATH)


def predict_image(image_bytes: bytes) -> dict[str, float | str]:
    """Run image inference and map the result to a disease label and treatment."""
    try:
        image = Image.open(BytesIO(image_bytes)).convert("RGB")
    except (UnidentifiedImageError, OSError) as exc:
        raise InferenceError("Uploaded file is not a valid image") from exc

    model = load_model()
    results = model.predict(image, verbose=False)
    result = results[0]

    if result.boxes is not None and len(result.boxes) > 0:
        import numpy as np
        confs = result.boxes.conf.cpu().numpy()
        max_idx = int(np.argmax(confs))
        top_index = int(result.boxes.cls[max_idx].item())
        confidence = float(confs[max_idx])
        
        raw_label = result.names[top_index]
        predicted_label = raw_label.replace("_", " ")
    else:
        confidence = 0.0
        predicted_label = UNCERTAIN_LABEL

    disease_name = predicted_label if confidence >= CONFIDENCE_THRESHOLD else UNCERTAIN_LABEL

    return {
        "disease_name": disease_name,
        "confidence": confidence,
        "treatment": TREATMENTS.get(disease_name, TREATMENTS[UNCERTAIN_LABEL]),
        "predicted_label": predicted_label,
    }
