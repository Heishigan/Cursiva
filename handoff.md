# Cursiva Project Handoff

Welcome, Agent! You are taking over the Cursiva project. Below is a comprehensive overview of the architecture, the work we have completed, and the specific bug that requires your attention.

## 🏗️ Architecture

- **Frontend:** Next.js 14 (App Router) hosted on Vercel.
- **Backend:** FastAPI deployed on Google Cloud Run (`https://cursiva-backend-1045461593148.europe-north1.run.app`).
- **Database:** Supabase PostgreSQL (`postgresql://postgres:uDYxUq8E0iER3HTV@db.svebrceyxkcqpxyzkyjj.supabase.co:5432/postgres`), managed via SQLAlchemy.
- **Authentication:** Clerk. The frontend passes a Bearer JWT, which the backend (`backend/auth.py`) verifies against Clerk's public JWKS.

## ✅ Work Completed

1. **Persistent Database Migration:** The backend was originally defaulting to an ephemeral SQLite database inside the Cloud Run container, causing data loss on every container restart. We migrated it to the production Supabase instance by setting the `DATABASE_URL` and `ENV=production` environment variables on Google Cloud Run.
2. **Clock Skew JWT Fix:** The backend was throwing `401 Unauthorized` errors for freshly minted Clerk tokens. This was due to clock skew between Clerk's servers and Google Cloud Run triggering an `ImmatureSignatureError` (`nbf` claim). We fixed this by adding `leeway=60` to `jwt.decode` in `backend/auth.py` and deploying the fix to Cloud Run.
3. **Cross-Account Data Bleed:** We purged legacy `localStorage` keys (`generic_cv_json`) in `frontend/src/app/dashboard/layout.tsx` to prevent a user's old CV data from silently bleeding into a new Clerk account session.

## 🐛 The Active Bug

**Issue:** The onboarding flow (`/onboarding`) fails to trigger for a brand new user.

**Expected Behavior:** 
When a new user signs up and lands on `/dashboard`, `frontend/src/app/dashboard/layout.tsx` fetches the user's profile from `/api/user/profile`. Since the user is new, their Supabase record should return `has_baseline: False`. The layout component should detect this and immediately redirect the user to `/onboarding`.

**Current Behavior:**
The user deletes their account and creates a new one, but they are never redirected to the onboarding flow. Instead, they remain stuck on the dashboard, which shows a "Not Configured" or "Backend Offline" state.

**Recent Debugging Context:**
- We recently updated `layout.tsx` to use `window.location.href = '/onboarding'` instead of `router.push('/onboarding')` for a more aggressive redirect, and we pushed this to Vercel. However, the user reports the issue persists.
- **Possible Culprits:**
  1. The Vercel deployment did not finish propagating, so the user is testing stale frontend code.
  2. The `fetch` call to `/api/user/profile` in `layout.tsx` is throwing a silent network error (or 401/500), causing the `data.status === 'success'` check to fail, completely bypassing the redirect logic.
  3. The `legacyCv` migration block in `layout.tsx` is somehow still finding a cached CV in `localStorage` and immediately `POST`ing it to the new account profile *before* the redirect check happens, causing `has_baseline` to evaluate to `True`.

Good luck! Start by checking the Cloud Run logs or injecting `console.log` statements in `layout.tsx` to verify exactly what payload the frontend receives from `/api/user/profile`.
