"""
SQLAlchemy/SQLModel definitions for farmers, diagnoses, analytics.
"""
from datetime import datetime
from typing import Optional
from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()


class Farmer(Base):
    __tablename__ = "farmers"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(36), unique=True, index=True, nullable=True)  # UUID from auth.users(id)
    name = Column(String(255), nullable=False)
    phone = Column(String(20), unique=True, index=True, nullable=True)
    region = Column(String(100), nullable=True)
    language = Column(String(10), default="en")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class DiagnosisRecord(Base):
    __tablename__ = "diagnosis_records"

    id = Column(Integer, primary_key=True, index=True)
    farmer_id = Column(Integer, ForeignKey("farmers.id"), nullable=True)
    image_path = Column(String(512), nullable=True)
    disease_detected = Column(String(100), nullable=True)
    severity = Column(String(50), nullable=True)
    confidence = Column(Float, nullable=True)
    recommendations = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class RegionHotspot(Base):
    __tablename__ = "region_hotspots"

    id = Column(Integer, primary_key=True, index=True)
    region = Column(String(100), nullable=False, index=True)
    disease = Column(String(100), nullable=False)
    count = Column(Integer, default=0)
    reported_at = Column(DateTime, default=datetime.utcnow)
