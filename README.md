# Ann Yoddha

## Problem Statement

Farmers often cannot identify wheat crop diseases early. This causes:

- crop yield loss
- incorrect pesticide use
- faster disease spread

Ann Yoddha is a full-stack crop diagnosis system where farmers upload crop images, receive AI-based disease detection, and get treatment guidance.

## Architecture

Farmer (Mobile/Web) -> React clients -> FastAPI backend -> database and model inference

## What It Is Made Of

- Frontend web app: `ann-yoddha-harvest-help` (Vite, React, TypeScript, shadcn/ui)
- Mobile app: `ann-yoddha-mobile` (Expo, React Native, offline-first sync)
- Backend: `ann_yoddha_backend` (FastAPI, JWT auth, Keras inference)

## Run (Quick)

- Backend: `cd ann_yoddha_backend && uv sync --dev && uv run uvicorn app.main:app --reload`
- Web: `cd ann-yoddha-harvest-help && npm i && npm run dev`
- Mobile: `cd ann-yoddha-mobile && npm i && npx expo start`

## One Command Startup (Backend + Web + Mobile)

From repo root:

```powershell
npm run dev:all
```

This opens three PowerShell windows and starts:

- backend on `0.0.0.0:8000`
- web app on `0.0.0.0:5173`
- mobile app with Expo LAN mode

## Local LAN + Phone Testing

Use [README_LOCAL_DEPLOYMENT.md](README_LOCAL_DEPLOYMENT.md) for the complete local deployment flow, including:

- backend on LAN host
- web setup with `VITE_API_BASE`
- mobile setup with `EXPO_PUBLIC_BACKEND_URL`
- real-phone validation checklist

Current LAN values in this workspace:

- Backend base URL: `http://172.16.204.191:8000`
- Web URL on phone: `http://172.16.204.191:5173`
