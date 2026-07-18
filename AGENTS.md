# AGENTS.md

## Cursor Cloud specific instructions

InboxOS is a **frontend-only Vite + React SPA** (single package at the repo root). There is no local backend to run: the app talks to a **hosted Supabase project** (id `kkveffyelwdenrlzymip`, configured in `utils/supabase/info.tsx`) and its deployed edge functions under `supabase/functions/server/`. Those edge functions are not run locally in this environment.

Standard commands live in `package.json` scripts and are documented in `README.md`:
- `pnpm dev` — Vite dev server on port `5173` (started with `--host`).
- `pnpm typecheck` — TypeScript check (this repo's "lint").
- `pnpm test` — Vitest unit tests (`src/lib/*.test.ts`).
- `pnpm build` / `pnpm preview` — production build / preview.

Non-obvious caveats:
- Use **pnpm** (there is a `pnpm-lock.yaml`); Node 20+ is required (Node 22 works).
- On `pnpm install`, build scripts for `@tailwindcss/oxide` and `esbuild` are reported as "ignored". This is **safe to leave as-is** — `pnpm dev`, `pnpm build`, and `pnpm test` all work without approving them. Do not run the interactive `pnpm approve-builds`.
- Meaningful use of the app requires **Google OAuth sign-in**, which redirects to Google and requires a real Google account plus Gmail scopes granted on the Supabase project. Clicking "Continue with Google" correctly initiates the OAuth redirect, but completing login/Gmail sync needs valid credentials and Supabase redirect URLs configured for the current origin. Without them you can still verify the login screen renders and the OAuth redirect starts.
- The dev server binds to `0.0.0.0:5173`; open the forwarded port (5173) to view it. `localhost` inside the cloud VM is not your local machine.
