"""
Main router assembly for API v1.
"""
from fastapi import APIRouter

from app.api.v1.endpoints import analytics, diagnosis, farmers, recommendations, indexing

api_router = APIRouter()

api_router.include_router(diagnosis.router)
api_router.include_router(recommendations.router)
api_router.include_router(analytics.router)
api_router.include_router(farmers.router)
api_router.include_router(indexing.router, prefix="/indexing", tags=["indexing"])
