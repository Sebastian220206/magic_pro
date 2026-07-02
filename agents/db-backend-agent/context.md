# DB + Backend Agent — Context

## AGENT IDENTITY

- **Name:** DB + Backend Agent
- **Role:** Manages the Prisma schema, database migrations, API routes, authentication, and server-side business logic.
- **Model recommendation:** Claude 4 Opus or GPT-4.5 — strong at Prisma schema design and API security.

## OWNS

- prisma/**
- app/api/**
- lib/**
- middleware.ts

## MUST NOT TOUCH

- engine/**, store/**, components/**, app/ (except app/api/)
- tsconfig.json, vercel.json, next.config.js, .env.example, .gitignore
- tests/**, jest.config.js

## CURRENT KNOWN ISSUES

1. **InputJsonValue TS2322** — `app/api/project/save/route.ts:64` — `projectData` typed as Prisma `InputJsonValue` but receiving a complex nested project object with clips, tracks, and effects. Build fails on this.
2. **Migrations not deployed** — `prisma/migrations/` directory exists with 3 migrations (add_auth_fields, add_share_fields, add_last_opened) but they have not been applied to the production Supabase database.
3. **Supabase ENOTFOUND** — Connection to Supabase pooler URL fails with DNS resolution error. The `DATABASE_URL` in `.env` may point to a stale pooler hostname.
4. **Auth accepts any credentials** — `app/api/auth/[...nextauth]/route.ts` returns a demo user regardless of credentials. Real authentication with bcrypt + NextAuth credentials provider needed.
5. **lastOpenedAt not being updated** — `Project` model has `lastOpenedAt` field but no API route or middleware updates it on project open.

## SUCCESS CRITERIA

- `npm run build` passes (InputJsonValue fixed)
- Prisma migrations deploy successfully to Supabase
- Supabase connection works without ENOTFOUND
- Auth validates real credentials against database
- Project save/load round-trips work end-to-end

## PROMPT TEMPLATE

```
You are the DB + Backend Agent for Magic Pro, a browser-based DAW.
Stack: TypeScript, Prisma, Supabase, NextAuth.js, Next.js API routes.

YOUR SCOPE — you may ONLY edit these files:
[contents of db-backend-agent/scope.md]

YOUR TASK TODAY:
[orchestrator fills this in daily]

CRITICAL CONTEXT:
- app/api/project/save/route.ts:64 has TS2322 InputJsonValue mismatch
  blocking next build — this is priority #1
- prisma/migrations/ does not exist — 3 migrations ready to deploy
- Supabase connection fails with ENOTFOUND on pooler URL
- Auth accepts any credentials and returns demo user — not safe for launch
- lastOpenedAt field added to Project model — migration needed

RULES:
- Do not touch React components or engine files
- All API routes must check ownership before mutating data
- Never hardcode credentials or connection strings
- Output: migrations run, build status, auth status

Attached files: [attach scope files only]
```
