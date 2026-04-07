"""Reusable Keras inference helpers for wheat disease prediction."""

from __future__ import annotations

from functools import lru_cache
from io import BytesIO
from pathlib import Path

import numpy as np
from PIL import Image, UnidentifiedImageError
from tensorflow import keras

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
CONFIDENCE_THRESHOLD = 0.5
IMAGE_SIZE = (224, 224)
MODEL_PATH = Path(__file__).resolve().parents[2] / "models" / "wheat_model.keras"

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
    """Load the trained Keras model once per process."""
    return keras.models.load_model(MODEL_PATH)


def _preprocess_image(image_bytes: bytes) -> np.ndarray:
    try:
        image = Image.open(BytesIO(image_bytes)).convert("RGB")
    except (UnidentifiedImageError, OSError) as exc:
        raise InferenceError("Uploaded file is not a valid image") from exc

    resized = image.resize(IMAGE_SIZE)
    normalized = np.asarray(resized, dtype=np.float32) / 255.0
    return np.expand_dims(normalized, axis=0)


def predict_image(image_bytes: bytes) -> dict[str, float | str]:
    """Run image inference and map the result to a disease label and treatment."""
    model = load_model()
    input_tensor = _preprocess_image(image_bytes)
    probabilities = np.asarray(model.predict(input_tensor, verbose=0))[0]

    top_index = int(np.argmax(probabilities))
    confidence = float(probabilities[top_index])
    predicted_label = CLASS_NAMES[top_index]
    disease_name = predicted_label if confidence >= CONFIDENCE_THRESHOLD else UNCERTAIN_LABEL

    return {
        "disease_name": disease_name,
        "confidence": confidence,
        "treatment": TREATMENTS[disease_name],
        "predicted_label": predicted_label,
    }
