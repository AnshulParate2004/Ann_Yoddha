# Ann Yoddha

Wheat disease detection for farmers. Upload crop images, get AI diagnosis and treatment advice. Web app + FastAPI backend.

## What it’s made of

- **Frontend:** [ann-yoddha-harvest-help](ann-yoddha-harvest-help) — Vite, React, TypeScript, Supabase, shadcn/ui
- **Backend:** [ann_yoddha_backend](ann_yoddha_backend) — FastAPI, Supabase (Auth, DB, Storage)

## Run

- **Backend:** `cd ann_yoddha_backend && uv sync --dev && uv run uvicorn app.main:app --reload`
- **Frontend:** `cd ann-yoddha-harvest-help && npm i && npm run dev`

See each folder’s README for env and details.
