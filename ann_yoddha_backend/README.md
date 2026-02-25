# Ann Yoddha Backend

FastAPI + Supabase (Auth, DB, Storage). See root README for run commands.

## 401 Unauthorized on `/farmers/me/*` or `/auth/me`

Supabase signs JWTs with **RS256** (public keys at `SUPABASE_URL/auth/v1/.well-known/jwks.json`). The backend verifies using that URL, so **SUPABASE_URL** must be set correctly in `.env`.

If you still get 401:

1. Ensure **SUPABASE_URL** in `.env` is exactly your project URL (e.g. `https://xxxx.supabase.co`), with no trailing slash.
2. Restart the backend after changing `.env`.

For older projects using HS256, set **SUPABASE_JWT_SECRET** (Project Settings → API → JWT Secret) as well; the backend will try JWKS first, then HS256 with that secret.
