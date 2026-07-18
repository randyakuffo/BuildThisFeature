# AGENTS.md

## Cursor Cloud specific instructions

### Verification preference
- **Do not use computer-use / browser automation** to demo or verify UI changes.
- Make the code changes, run lint/typecheck/tests/build as appropriate, and leave visual verification to the user.
- They will review in their own browser and report any issues.

### App overview
NudgeBox is a frontend-only Vite + React SPA. Auth and Gmail sync go through a hosted Supabase project (`utils/supabase/info.tsx`). There is no local backend to run.

Standard commands are in `package.json` / `README.md`: `pnpm dev`, `pnpm typecheck`, `pnpm test`, `pnpm build`.

### Supabase edge function deploy
The live function name is `make-server-6ac207ec`, but source lives in `supabase/functions/server/`. Requires `SUPABASE_ACCESS_TOKEN`.

```bash
ln -sfn server supabase/functions/make-server-6ac207ec
npx supabase functions deploy make-server-6ac207ec --project-ref kkveffyelwdenrlzymip --use-api
```

Do not commit the `make-server-6ac207ec` symlink or `supabase/.temp/`. After deploy, users must **Sync Inbox** once for Attachment Vault data.
