"""
Profile and history management for farmers. Uses Supabase DB (no DATABASE_URL needed).
"""
from fastapi import APIRouter, HTTPException

from app.api.deps import CurrentUserId
from app.core.supabase_client import get_supabase

router = APIRouter(prefix="/farmers", tags=["farmers"])


@router.get("/me/profile")
async def get_my_profile(current_user_id: CurrentUserId):
    """Return current user's farmer profile (requires JWT)."""
    supabase = get_supabase()
    r = (
        supabase.table("farmers")
        .select("id, user_id, name, phone, region, language")
        .eq("user_id", current_user_id)
        .maybe_single()
        .execute()
    )
    row = r.data
    if not row:
        raise HTTPException(status_code=404, detail="Farmer profile not found")
    return {
        "farmer_id": row["id"],
        "user_id": row["user_id"],
        "name": row["name"],
        "phone": row["phone"],
        "region": row["region"],
        "language": row["language"],
    }


@router.get("/me/history")
async def get_my_diagnosis_history(current_user_id: CurrentUserId, limit: int = 50):
    """Return current user's diagnosis history (requires JWT)."""
    supabase = get_supabase()
    # Get farmer id for this user
    farmer_r = (
        supabase.table("farmers")
        .select("id")
        .eq("user_id", current_user_id)
        .maybe_single()
        .execute()
    )
    if not farmer_r.data:
        return {"history": [], "limit": limit}
    farmer_id = farmer_r.data["id"]
    # Get diagnosis records
    r = (
        supabase.table("diagnosis_records")
        .select("id, disease_detected, severity, confidence, created_at")
        .eq("farmer_id", farmer_id)
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    history = [
        {
            "id": row["id"],
            "disease_detected": row["disease_detected"],
            "severity": row["severity"],
            "confidence": row["confidence"],
            "created_at": row["created_at"],
        }
        for row in (r.data or [])
    ]
    return {"history": history, "limit": limit}
