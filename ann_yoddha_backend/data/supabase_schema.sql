-- Ann Yoddha – Supabase tables
-- Run in Supabase Dashboard: SQL Editor > New query > paste and Run.
-- Links farmers to Supabase Auth via auth.users(id).

-- Optional: enable UUID extension (usually already on)
-- CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ---------------------------------------------------------------------------
-- 1. Farmers (profile); optional link to Supabase Auth
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.farmers (
    id              BIGSERIAL PRIMARY KEY,
    user_id         UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    name            VARCHAR(255) NOT NULL,
    phone           VARCHAR(20) UNIQUE,
    region          VARCHAR(100),
    language        VARCHAR(10) DEFAULT 'en',
    created_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_farmers_user_id ON public.farmers(user_id);
CREATE INDEX IF NOT EXISTS idx_farmers_phone ON public.farmers(phone);
CREATE INDEX IF NOT EXISTS idx_farmers_region ON public.farmers(region);

COMMENT ON TABLE public.farmers IS 'Farmer profiles; user_id links to Supabase Auth (auth.users).';

-- ---------------------------------------------------------------------------
-- 2. Diagnosis records (per upload / inference)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.diagnosis_records (
    id               BIGSERIAL PRIMARY KEY,
    farmer_id        BIGINT REFERENCES public.farmers(id) ON DELETE SET NULL,
    image_path       VARCHAR(512),
    disease_detected VARCHAR(100),
    severity         VARCHAR(50),
    confidence       REAL,
    recommendations  TEXT,
    created_at       TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_diagnosis_records_farmer_id ON public.diagnosis_records(farmer_id);
CREATE INDEX IF NOT EXISTS idx_diagnosis_records_created_at ON public.diagnosis_records(created_at);
CREATE INDEX IF NOT EXISTS idx_diagnosis_records_disease ON public.diagnosis_records(disease_detected);

COMMENT ON TABLE public.diagnosis_records IS 'Wheat disease diagnosis results (YOLOv12/SNN).';

-- ---------------------------------------------------------------------------
-- 3. Region hotspots (analytics / dashboard)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.region_hotspots (
    id          BIGSERIAL PRIMARY KEY,
    region      VARCHAR(100) NOT NULL,
    disease     VARCHAR(100) NOT NULL,
    count       INTEGER DEFAULT 0 NOT NULL,
    reported_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_region_hotspots_region ON public.region_hotspots(region);
CREATE INDEX IF NOT EXISTS idx_region_hotspots_reported_at ON public.region_hotspots(reported_at);

COMMENT ON TABLE public.region_hotspots IS 'Aggregated disease counts by region for dashboard.';

-- ---------------------------------------------------------------------------
-- 4. Row Level Security (RLS) – optional
-- ---------------------------------------------------------------------------
ALTER TABLE public.farmers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diagnosis_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.region_hotspots ENABLE ROW LEVEL SECURITY;

-- Farmers: users can read/update own row (match auth.uid() to user_id)
CREATE POLICY "Users can read own farmer profile"
    ON public.farmers FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update own farmer profile"
    ON public.farmers FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own farmer profile"
    ON public.farmers FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Service role can do anything; anon/key can be restricted as needed.
-- Diagnosis: users can read/insert own records (via farmer_id)
CREATE POLICY "Users can read own diagnosis records"
    ON public.diagnosis_records FOR SELECT
    USING (
        farmer_id IN (SELECT id FROM public.farmers WHERE user_id = auth.uid())
    );

CREATE POLICY "Users can insert own diagnosis records"
    ON public.diagnosis_records FOR INSERT
    WITH CHECK (
        farmer_id IS NULL
        OR farmer_id IN (SELECT id FROM public.farmers WHERE user_id = auth.uid())
    );

-- Region hotspots: read-only for authenticated (or anon if you want public dashboard)
CREATE POLICY "Authenticated users can read hotspots"
    ON public.region_hotspots FOR SELECT
    TO authenticated
    USING (true);

-- Backend (FastAPI) uses direct Postgres (DATABASE_URL), not JWT.
-- So either: use a DB user with BYPASSRLS, or add policies for your DB role.
-- Example: allow backend to manage all (run as postgres/superuser bypasses RLS):
-- no extra policy needed if your DATABASE_URL user has BYPASSRLS.
