-- ================================================================
-- ApnaDoctor Database Setup
-- Run this entire script in Supabase SQL Editor
-- Project: piyldwatkjslodfuyifn.supabase.co
-- Go to: Dashboard → SQL Editor → New Query → Paste → Run
-- ================================================================

-- ── PROFILES TABLE ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  date_of_birth DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);


-- ── CONSENT RECORDS TABLE ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.consent_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  consent_given BOOLEAN NOT NULL DEFAULT false,
  consent_text TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.consent_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own consent records" ON public.consent_records;
CREATE POLICY "Users can view own consent records"
  ON public.consent_records FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own consent records" ON public.consent_records;
CREATE POLICY "Users can insert own consent records"
  ON public.consent_records FOR INSERT
  WITH CHECK (auth.uid() = user_id);


-- ── SYMPTOM SESSIONS TABLE ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.symptom_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  symptoms_text TEXT NOT NULL,
  onset TEXT,
  severity TEXT,
  duration TEXT,
  existing_conditions TEXT,
  current_medications TEXT,
  allergies TEXT,
  age INTEGER,
  is_pregnant BOOLEAN DEFAULT false,
  triage_level TEXT,
  triage_reason TEXT,
  confidence_score NUMERIC(3,2),
  recommendations JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.symptom_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own sessions" ON public.symptom_sessions;
CREATE POLICY "Users can view own sessions"
  ON public.symptom_sessions FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own sessions" ON public.symptom_sessions;
CREATE POLICY "Users can insert own sessions"
  ON public.symptom_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own sessions" ON public.symptom_sessions;
CREATE POLICY "Users can update own sessions"
  ON public.symptom_sessions FOR UPDATE
  USING (auth.uid() = user_id);


-- ── REPORT FILES TABLE ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.report_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.symptom_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  ocr_status TEXT DEFAULT 'pending',
  ocr_text TEXT,
  parsed_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.report_files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own report files" ON public.report_files;
CREATE POLICY "Users can view own report files"
  ON public.report_files FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own report files" ON public.report_files;
CREATE POLICY "Users can insert own report files"
  ON public.report_files FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own report files" ON public.report_files;
CREATE POLICY "Users can update own report files"
  ON public.report_files FOR UPDATE
  USING (auth.uid() = user_id);


-- ── LLM AUDIT LOG TABLE ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.llm_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.symptom_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  prompt_data JSONB NOT NULL,
  response_data JSONB NOT NULL,
  model_used TEXT NOT NULL,
  tokens_used INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.llm_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own audit logs" ON public.llm_audit_log;
CREATE POLICY "Users can view own audit logs"
  ON public.llm_audit_log FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "System can insert audit logs" ON public.llm_audit_log;
CREATE POLICY "System can insert audit logs"
  ON public.llm_audit_log FOR INSERT
  WITH CHECK (auth.uid() = user_id);


-- ── STORAGE BUCKET ────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('medical-reports', 'medical-reports', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Users can upload own reports" ON storage.objects;
CREATE POLICY "Users can upload own reports"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'medical-reports' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users can view own reports" ON storage.objects;
CREATE POLICY "Users can view own reports"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'medical-reports' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );


-- ── FUNCTIONS & TRIGGERS ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS set_updated_at ON public.profiles;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ================================================================
-- Done! All tables, policies, storage bucket and triggers created.
-- ================================================================
