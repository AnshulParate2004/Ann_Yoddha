# Ann Yoddha

# Problem Statement

Farmers often cannot identify wheat crop diseases early. Because of this:

Crop yield decreases

Wrong pesticides are used

Disease spreads quickly

The solution is a web application where farmers upload crop images, and an AI model detects the disease and suggests treatment.

# Architecture

Farmer (Mobile/Web)
        │
        ▼
   React Web App
        │
        ▼
    FastAPI Backend
        │
        ├── Image Processing
        ├── ML Model (Disease Detection)
        └── Recommendation Engine
        │
        ▼
   Database (Store Results)

## What it’s made of

- **Frontend:** [ann-yoddha-harvest-help](ann-yoddha-harvest-help) — Vite, React, TypeScript, Supabase, shadcn/ui
- **Backend:** [ann_yoddha_backend](ann_yoddha_backend) — FastAPI, Supabase (Auth, DB, Storage)

## Run

- **Backend:** `cd ann_yoddha_backend && uv sync --dev && uv run uvicorn app.main:app --reload`
- **Frontend:** `cd ann-yoddha-harvest-help && npm i && npm run dev`

See each folder’s README for env and details.
