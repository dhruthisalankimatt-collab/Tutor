# Smruthi's Tutor — core build
1. Create a Supabase project; run `supabase/migrations/001_schema.sql` in the SQL editor.
2. `cp .env.example .env.local`, fill values. `npm i`.
3. `npm run seed` (needs env loaded) to provision Smruthi + Dhruthi with bcrypt hashes.
4. Store each Groq key encrypted: `encrypt()` from `lib/crypto.ts` → `ai_configurations.encrypted_api_key` (admin UI for this is not built yet).
5. `npm run dev`. Deploy to Vercel with the same env vars.
Implemented: schema + RLS, auth (HTTP-only JWT, bcrypt, rate limit, route guard), encrypted key storage, Agent 1 (hints, answer check, give-up, per-question memory isolation, answer never sent to browser), student chat UI.
Not yet built: image upload/crop/OCR, Agent 2, Agent 3, admin dashboard, Edit Keys/Subjects, Reset Database.
