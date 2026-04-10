"""Primary FastAPI application for the Ann Yoddha SaaS backend."""

import asyncio
from datetime import datetime
from typing import Any
import urllib.request

from fastapi import Depends, FastAPI, File, HTTPException, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, ConfigDict, Field

from app.api.deps import CurrentUser
from app.api.v1.api import api_router
from app.auth import authenticate_user, create_user
from app.core.supabase_client import get_supabase
from app.db.models import User
from app.services.inference import InferenceError, predict_image
from app.services.storage import upload_bytes
from app.core.config import settings

app = FastAPI(
    title="Ann Yoddha API",
    description="Supabase-native backend for Ann Yoddha.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

async def ping_render():
    while True:
        try:
            await asyncio.sleep(180)  # Wait 3 minutes
            await asyncio.to_thread(urllib.request.urlopen, "https://ann-yoddha.onrender.com/health")
        except Exception:
            pass

@app.on_event("startup")
async def start_keepalive():
    asyncio.create_task(ping_render())

app.include_router(api_router, prefix="/api/v1")


class RegisterRequest(BaseModel):
    email: str
    password: str = Field(min_length=8)
    name: str | None = None


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    email: str
    role: str
    name: str | None = None
    phone: str | None = None
    region: str | None = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class PredictionResponse(BaseModel):
    disease_name: str
    confidence: float
    treatment: str
    timestamp: datetime
    status: str = "saved_to_cloud"
    image_url: str | None = None


class SyncScanRequest(BaseModel):
    local_id: int | None = None
    disease_name: str
    confidence: float
    treatment: str
    image_url: str | None = None
    timestamp: datetime


class SyncRequest(BaseModel):
    scans: list[SyncScanRequest]


class SyncedScanResponse(BaseModel):
    local_id: int | None = None
    cloud_id: int
    timestamp: datetime


class SyncResponse(BaseModel):
    synced_count: int
    synced_scans: list[SyncedScanResponse]
    status: str = "synced"


class HistoryItemResponse(BaseModel):
    id: int
    disease_name: str
    confidence: float
    treatment: str
    image_url: str | None = None
    timestamp: datetime


class HistoryResponse(BaseModel):
    history: list[HistoryItemResponse]
    limit: int


def serialize_user(user: User) -> dict[str, str]:
    meta = user.meta or {}
    name = meta.get("full_name") or user.email.split("@")[0]
    return {
        "id": str(user.id),
        "email": user.email,
        "role": user.role,
        "name": name,
        "phone": meta.get("phone", ""),
        "region": meta.get("region", ""),
    }


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/api/v1/speech/token")
def auth_speech(current_user: CurrentUser):
    """Securely fetch Azure Speech authorization token."""
    key = settings.azure_speech_key
    region = settings.azure_speech_region
    if not key or not region:
        raise HTTPException(status_code=500, detail="Azure speech not configured.")
    url = f"https://{region}.api.cognitive.microsoft.com/sts/v1.0/issueToken"
    req = urllib.request.Request(url, method="POST")
    req.add_header("Ocp-Apim-Subscription-Key", key)
    
    try:
        with urllib.request.urlopen(req) as response:
            token = response.read().decode("utf-8")
            return {"token": token, "region": region}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/auth/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest):
    """Register a new user via Supabase Auth and get JWT."""
    supabase = get_supabase()
    meta = {"full_name": payload.name} if payload.name else None
    result = create_user(supabase, payload.email, payload.password, meta=meta)
    if not getattr(result, "user", None):
        raise HTTPException(status_code=400, detail="Registration failed.")
        
    if not getattr(result, "session", None):
        # The user likely already exists. Let's try to log them in automatically to make the UX seamless.
        login_result = authenticate_user(supabase, payload.email, payload.password)
        if login_result and getattr(login_result, "session", None):
            result = login_result
        else:
            raise HTTPException(
                status_code=400,
                detail="Email is already registered. Please sign in with your password."
            )

    user = User(
        id=str(result.user.id),
        email=result.user.email,
        created_at=result.user.created_at,
        meta=result.user.user_metadata or {},
    )
    return {
        "access_token": result.session.access_token,
        "token_type": "bearer",
        "user": serialize_user(user),
    }


@app.post("/auth/login", response_model=TokenResponse)
def login(form_data: OAuth2PasswordRequestForm = Depends()):
    """Authenticate using email and return Supabase JWT."""
    supabase = get_supabase()
    result = authenticate_user(supabase, form_data.username, form_data.password)
    if not result or not getattr(result, "user", None):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = User(
        id=str(result.user.id),
        email=result.user.email,
        created_at=result.user.created_at,
        meta=result.user.user_metadata or {},
    )
    return {
        "access_token": result.session.access_token,
        "token_type": "bearer",
        "user": serialize_user(user),
    }


@app.get("/auth/me", response_model=UserResponse)
@app.get("/api/v1/auth/me", response_model=UserResponse)
def auth_me(current_user: CurrentUser):
    return serialize_user(current_user)


@app.post("/predict", response_model=PredictionResponse)
async def predict(
    current_user: CurrentUser,
    image: UploadFile = File(...),
):
    """Run inference and persist via Supabase client."""
    if not image.content_type or not image.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Please upload a valid image file")

    image_bytes = await image.read()
    if not image_bytes:
        raise HTTPException(status_code=400, detail="Uploaded image is empty")

    try:
        result = predict_image(image_bytes)
    except InferenceError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Prediction failed") from exc

    # Upload image to Supabase Storage and get back a public URL
    import uuid
    ext = (image.filename or "image.jpg").rsplit(".", 1)[-1]
    object_name = f"scans/{current_user.id}/{uuid.uuid4().hex}.{ext}"
    content_type = image.content_type or "image/jpeg"
    public_image_url = upload_bytes(image_bytes, object_name, content_type=content_type)

    supabase = get_supabase()
    timestamp = datetime.utcnow().isoformat()
    db_response = supabase.table("scan_history").insert({
        "user_id": current_user.id,
        "disease_name": str(result["disease_name"]),
        "confidence": float(result["confidence"]),
        "treatment": str(result["treatment"]),
        "image_url": public_image_url or image.filename,
        "timestamp": timestamp
    }).execute()

    if not db_response.data:
        raise HTTPException(status_code=500, detail="Failed to save prediction to database.")

    return {
        "disease_name": result["disease_name"],
        "confidence": result["confidence"],
        "treatment": result["treatment"],
        "timestamp": timestamp,
        "status": "saved_to_cloud",
        "image_url": public_image_url,
    }


@app.post("/sync", response_model=SyncResponse)
def sync_scans(
    payload: SyncRequest,
    current_user: CurrentUser,
):
    """Persist offline scans via Supabase client."""
    if not payload.scans:
        return {"synced_count": 0, "synced_scans": [], "status": "nothing_to_sync"}

    supabase = get_supabase()
    insert_payload = []
    for item in payload.scans:
        insert_payload.append({
            "user_id": current_user.id,
            "disease_name": item.disease_name,
            "confidence": item.confidence,
            "treatment": item.treatment,
            "image_url": item.image_url,
            "timestamp": item.timestamp.isoformat()
        })

    db_response = supabase.table("scan_history").insert(insert_payload).execute()
    synced_scans = []
    
    # Map back original local IDs assuming order is preserved by Supabase insert return
    if db_response.data and len(db_response.data) == len(payload.scans):
        for original, saved in zip(payload.scans, db_response.data):
            synced_scans.append({
                "local_id": original.local_id,
                "cloud_id": saved["id"],
                "timestamp": saved["timestamp"],
            })

    return {
        "synced_count": len(synced_scans),
        "synced_scans": synced_scans,
        "status": "synced",
    }


@app.get("/history", response_model=HistoryResponse)
def get_history(
    current_user: CurrentUser,
    limit: int = 50,
):
    """Fetch scan history via Supabase client."""
    supabase = get_supabase()
    db_response = supabase.table("scan_history") \
        .select("*") \
        .eq("user_id", current_user.id) \
        .order("timestamp", desc=True) \
        .limit(limit) \
        .execute()

    rows = db_response.data or []
    return {
        "history": rows,
        "limit": limit,
    }
