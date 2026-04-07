"""Primary FastAPI application for the Ann Yoddha SaaS backend."""

from datetime import datetime

from fastapi import Depends, FastAPI, File, HTTPException, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session

from app.api.deps import CurrentUser
from app.api.v1.api import api_router
from app.auth import authenticate_user, create_access_token, create_user, get_user_by_email, seed_default_users
from app.db.models import ScanHistory, User
from app.db.session import SessionLocal, get_db, init_db
from app.services.inference import InferenceError, predict_image

app = FastAPI(
    title="Ann Yoddha API",
    description="JWT-authenticated backend for Ann Yoddha.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api/v1")


class RegisterRequest(BaseModel):
    """Input payload for creating a new farmer account."""

    email: str
    password: str = Field(min_length=8)


class UserResponse(BaseModel):
    """Minimal user payload returned to the client."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    role: str


class TokenResponse(BaseModel):
    """Standard OAuth-style access token response."""

    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class PredictionResponse(BaseModel):
    """Response payload for protected crop diagnosis."""

    disease_name: str
    confidence: float
    treatment: str
    timestamp: datetime
    status: str = "saved_to_cloud"


class SyncScanRequest(BaseModel):
    """Single offline scan payload uploaded from the mobile client."""

    local_id: int | None = None
    disease_name: str
    confidence: float
    treatment: str
    image_url: str | None = None
    timestamp: datetime


class SyncRequest(BaseModel):
    """Batch upload payload for offline scans waiting to sync."""

    scans: list[SyncScanRequest]


class SyncedScanResponse(BaseModel):
    """Mapping returned so the client can mark local rows as synced."""

    local_id: int | None = None
    cloud_id: int
    timestamp: datetime


class SyncResponse(BaseModel):
    """Batch sync result summary."""

    synced_count: int
    synced_scans: list[SyncedScanResponse]
    status: str = "synced"


class HistoryItemResponse(BaseModel):
    """Single cloud scan history row for authenticated clients."""

    id: int
    disease_name: str
    confidence: float
    treatment: str
    image_url: str | None = None
    timestamp: datetime


class HistoryResponse(BaseModel):
    """Authenticated scan history response."""

    history: list[HistoryItemResponse]
    limit: int


def serialize_user(user: User) -> dict[str, int | str]:
    """Keep auth responses explicit instead of relying on ORM serialization."""
    return {
        "id": user.id,
        "email": user.email,
        "role": user.role,
    }


@app.on_event("startup")
def bootstrap_application() -> None:
    """Ensure the database schema and requested test users exist."""
    init_db()
    with SessionLocal() as db:
        seed_default_users(db)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/auth/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(
    payload: RegisterRequest,
    db: Session = Depends(get_db),
):
    """Register a new local user and issue a JWT immediately."""
    existing_user = get_user_by_email(db, payload.email)
    if existing_user is not None:
        raise HTTPException(status_code=400, detail="Email is already registered")

    user = create_user(db, payload.email, payload.password)
    access_token = create_access_token(str(user.id), user.email, user.role)
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": serialize_user(user),
    }


@app.post("/auth/login", response_model=TokenResponse)
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    """Authenticate using email in the OAuth `username` field and return a JWT."""
    user = authenticate_user(db, form_data.username, form_data.password)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = create_access_token(str(user.id), user.email, user.role)
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": serialize_user(user),
    }


@app.get("/auth/me", response_model=UserResponse)
@app.get("/api/v1/auth/me", response_model=UserResponse)
def auth_me(current_user: CurrentUser):
    """Return the authenticated user's profile."""
    return serialize_user(current_user)


@app.post("/predict", response_model=PredictionResponse)
async def predict(
    current_user: CurrentUser,
    image: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """Run protected Keras inference and persist the authenticated scan result."""
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

    scan = ScanHistory(
        user_id=current_user.id,
        disease_name=str(result["disease_name"]),
        confidence=float(result["confidence"]),
        treatment=str(result["treatment"]),
        image_url=image.filename,
    )
    db.add(scan)
    db.commit()
    db.refresh(scan)

    return {
        "disease_name": scan.disease_name,
        "confidence": scan.confidence,
        "treatment": scan.treatment,
        "timestamp": scan.timestamp,
        "status": "saved_to_cloud",
    }


@app.post("/sync", response_model=SyncResponse)
def sync_scans(
    payload: SyncRequest,
    current_user: CurrentUser,
    db: Session = Depends(get_db),
):
    """Persist a batch of offline scans for the authenticated user."""
    if not payload.scans:
        return {
            "synced_count": 0,
            "synced_scans": [],
            "status": "nothing_to_sync",
        }

    synced_scans: list[dict[str, int | datetime | None]] = []

    for item in payload.scans:
        scan = ScanHistory(
            user_id=current_user.id,
            disease_name=item.disease_name,
            confidence=item.confidence,
            treatment=item.treatment,
            image_url=item.image_url,
            timestamp=item.timestamp,
        )
        db.add(scan)
        db.flush()
        synced_scans.append(
            {
                "local_id": item.local_id,
                "cloud_id": scan.id,
                "timestamp": scan.timestamp,
            }
        )

    db.commit()

    return {
        "synced_count": len(synced_scans),
        "synced_scans": synced_scans,
        "status": "synced",
    }


@app.get("/history", response_model=HistoryResponse)
def get_history(
    current_user: CurrentUser,
    limit: int = 50,
    db: Session = Depends(get_db),
):
    """Return recent cloud scan history for the authenticated user."""
    rows = (
        db.query(ScanHistory)
        .filter(ScanHistory.user_id == current_user.id)
        .order_by(ScanHistory.timestamp.desc())
        .limit(limit)
        .all()
    )

    return {
        "history": [
            {
                "id": row.id,
                "disease_name": row.disease_name,
                "confidence": row.confidence,
                "treatment": row.treatment,
                "image_url": row.image_url,
                "timestamp": row.timestamp,
            }
            for row in rows
        ],
        "limit": limit,
    }
