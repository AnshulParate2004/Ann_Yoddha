-- ---------------------------------------------------------------------------
-- Ann Yoddha – Complete Supabase Schema
-- Run this entire script in your Supabase Dashboard: SQL Editor > New query > Run.
-- ---------------------------------------------------------------------------

-- 1. Farmers Profile Table
-- Keeps track of demographics and links directly to the Supabase Auth system.
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


-- 2. Scan History (Direct App History)
-- Stores the direct results from the Mobile/Web App prediction endpoint.
CREATE TABLE IF NOT EXISTS public.scan_history (
    id              BIGSERIAL PRIMARY KEY,
    user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    disease_name    TEXT NOT NULL,
    confidence      FLOAT NOT NULL,
    treatment       TEXT NOT NULL,
    image_url       TEXT,
    timestamp       TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_scan_history_user_id ON public.scan_history(user_id);


-- 3. Diagnosis Records (Detailed Analytics / Legacy)
-- Associates diagnosis with specific farmer profiles for deeper analytics.
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


-- 4. Region Hotspots (Analytics Dashboard)
-- Aggregates disease occurrences per region.
CREATE TABLE IF NOT EXISTS public.region_hotspots (
    id          BIGSERIAL PRIMARY KEY,
    region      VARCHAR(100) NOT NULL,
    disease     VARCHAR(100) NOT NULL,
    count       INTEGER DEFAULT 0 NOT NULL,
    reported_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_region_hotspots_region ON public.region_hotspots(region);
CREATE INDEX IF NOT EXISTS idx_region_hotspots_reported_at ON public.region_hotspots(reported_at);


-- ---------------------------------------------------------------------------
-- 5. Indexed Documents (PageIndex RAG Storage)
-- Stores JSON hierarchical tree structures extracted from PDF documents
CREATE TABLE IF NOT EXISTS public.indexed_documents (
    id              BIGSERIAL PRIMARY KEY,
    user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    filename        TEXT NOT NULL,
    structure       JSONB NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_indexed_documents_user_id ON public.indexed_documents(user_id);

-- ---------------------------------------------------------------------------
-- 6. Row Level Security (RLS) Policies
-- ---------------------------------------------------------------------------
ALTER TABLE public.farmers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scan_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diagnosis_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.region_hotspots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.indexed_documents ENABLE ROW LEVEL SECURITY;

-- Farmers
CREATE POLICY "Users can read own farmer profile" ON public.farmers FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own farmer profile" ON public.farmers FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own farmer profile" ON public.farmers FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Scan History
CREATE POLICY "Users can see own history" ON public.scan_history FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own history" ON public.scan_history FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Diagnosis Records
CREATE POLICY "Users can read own diagnosis records" ON public.diagnosis_records FOR SELECT
USING (farmer_id IN (SELECT id FROM public.farmers WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert own diagnosis records" ON public.diagnosis_records FOR INSERT
WITH CHECK (farmer_id IS NULL OR farmer_id IN (SELECT id FROM public.farmers WHERE user_id = auth.uid()));

-- Hotspots (Publicly readable to authenticated users)
CREATE POLICY "Authenticated users can read hotspots" ON public.region_hotspots FOR SELECT TO authenticated USING (true);

-- Indexed Documents
CREATE POLICY "Users can read own indexed documents" ON public.indexed_documents FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own indexed documents" ON public.indexed_documents FOR INSERT WITH CHECK (auth.uid() = user_id);
