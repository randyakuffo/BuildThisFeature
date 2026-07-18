# AGENTS.md

## Cursor Cloud specific instructions

### Verification preference
- **Do not use computer-use / browser automation** to demo or verify UI changes.
- Make the code changes, run lint/typecheck/tests/build as appropriate, and leave visual verification to the user.
- They will review in their own browser and report any issues.

### App overview
NudgeBox is a frontend-only Vite + React SPA. Auth and Gmail sync go through a hosted Supabase project (`utils/supabase/info.tsx`). There is no local backend to run.

Standard commands are in `package.json` / `README.md`: `pnpm dev`, `pnpm typecheck`, `pnpm test`, `pnpm build`.
