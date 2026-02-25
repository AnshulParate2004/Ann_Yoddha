"""
Wheat disease treatment knowledge base (RAG source). Based on Ann Yoddha project scope:
Rust, Leaf blight, Karnal bunt, Fusarium head blight. Minimize pesticide use; early detection.
"""
from typing import Any

# Disease name variants for matching (e.g. from model output)
DISEASE_ALIASES: dict[str, str] = {
    "rust": "rust",
    "leaf rust": "rust",
    "stripe rust": "rust",
    "yellow rust": "rust",
    "leaf blight": "leaf_blight",
    "blight": "leaf_blight",
    "karnal bunt": "karnal_bunt",
    "bunt": "karnal_bunt",
    "fusarium head blight": "fusarium_head_blight",
    "fusarium": "fusarium_head_blight",
    "fhb": "fusarium_head_blight",
    "head blight": "fusarium_head_blight",
}

# Structured treatments per disease (chemical, organic, preventive)
KNOWLEDGE: dict[str, list[dict[str, Any]]] = {
    "rust": [
        {
            "type": "chemical",
            "name": "Fungicide (Triazole)",
            "description": "Apply triazole-based fungicide at first signs of pustules. Effective against stripe and leaf rust. Spray when disease severity is low to moderate.",
            "dosage": "As per label; typically 0.5–1 L/ha. Do not exceed 2 applications per season.",
        },
        {
            "type": "organic",
            "name": "Sulphur / Copper spray",
            "description": "Wettable sulphur or copper oxychloride can suppress rust in early stages. Best combined with resistant varieties and crop hygiene.",
            "dosage": "Sulphur 2–3 kg/ha; follow product label.",
        },
        {
            "type": "preventive",
            "name": "Resistant varieties & early detection",
            "description": "Use rust-resistant wheat varieties. Scout fields early; remove volunteer plants. Avoid excess nitrogen. Ann Yoddha helps with early detection to reduce spread.",
        },
    ],
    "leaf_blight": [
        {
            "type": "chemical",
            "name": "Fungicide (Strobilurin / Triazole)",
            "description": "Apply at flag leaf stage if weather favors disease. Protects foliage and grain fill.",
            "dosage": "As per label; one to two sprays at 10–14 day interval if needed.",
        },
        {
            "type": "organic",
            "name": "Crop rotation & residue management",
            "description": "Rotate with non-host crops. Destroy or bury infected residue. Reduce humidity in canopy through spacing.",
            "dosage": None,
        },
        {
            "type": "preventive",
            "name": "Healthy seed & balanced nutrition",
            "description": "Use certified, disease-free seed. Balanced N-P-K; avoid late heavy nitrogen. Early diagnosis via Ann Yoddha limits damage.",
        },
    ],
    "karnal_bunt": [
        {
            "type": "chemical",
            "name": "Seed treatment (Fungicide)",
            "description": "Treat seed with recommended fungicide to reduce soil/seed-borne inoculum. Foliar fungicide has limited effect once infection is in the spike.",
            "dosage": "As per seed treatment label; do not use for food grain beyond allowed MRL.",
        },
        {
            "type": "organic",
            "name": "Clean seed & rotation",
            "description": "Use bunt-free seed from certified sources. Long rotation with non-cereals. Avoid planting in fields with previous bunt history.",
            "dosage": None,
        },
        {
            "type": "preventive",
            "name": "Avoid flowering in wet weather",
            "description": "If possible, choose sowing time so flowering does not coincide with prolonged wet conditions. Early detection of other diseases helps keep crop stress low.",
        },
    ],
    "fusarium_head_blight": [
        {
            "type": "chemical",
            "name": "Fungicide at flowering",
            "description": "Apply registered fungicide (e.g. triazole) at early flowering to protect heads. Timing is critical; late application is less effective.",
            "dosage": "As per label; often single application at flowering. Check local recommendations for FHB.",
        },
        {
            "type": "organic",
            "name": "Residue management & variety",
            "description": "Plow under or remove maize/cereal residue. Use moderately resistant varieties. Reduce irrigation at flowering to limit humidity.",
            "dosage": None,
        },
        {
            "type": "preventive",
            "name": "Minimize pesticide use via precise detection",
            "description": "Ann Yoddha enables precise, localized identification so you treat only when and where needed. Early detection of FHB reduces reliance on blanket sprays.",
        },
    ],
}


def normalize_disease(name: str) -> str | None:
    """Map model output or user input to internal disease key."""
    if not name or not name.strip():
        return None
    key = name.strip().lower()
    if key in DISEASE_ALIASES:
        return DISEASE_ALIASES[key]
    canonical = key.replace(" ", "_")
    return canonical if canonical in KNOWLEDGE else None


def get_treatments(disease: str, severity: str | None = None) -> list[dict[str, Any]]:
    """
    RAG-style retrieval: return treatment recommendations for a wheat disease.
    severity can be used later to filter or rank (e.g. more aggressive for high severity).
    """
    norm = normalize_disease(disease)
    if not norm or norm not in KNOWLEDGE:
        return []
    treatments = [dict(t) for t in KNOWLEDGE[norm]]
    if severity and severity.lower() in ("high", "critical"):
        for t in treatments:
            if t.get("type") == "preventive":
                t["description"] = t["description"] + " In high severity, combine with chemical control as per label."
    return treatments
