For frontend work:
- Use playwright to verify UI changes.
- Open localhost after every feature.
- Check browser console.
- Take screenshots when UI changes.
- Report regressions before finishing.

For documentation:
- Use context7 before implementing unfamiliar APIs.

Phase 6 (Cloud & Collaboration Infrastructure):
- PWA: manifest.json + sw.js at `/public/`, registered via `<link manifest>` in layout.tsx
- S3 storage adapter: `lib/storage-s3.ts` (createS3Adapter) — feature-flagged off (`s3Storage: false`)
- Supabase storage: `lib/storage.ts` exports `{ storage, uploadAudio }` with a `StorageAdapter` interface (uploadBuffer, uploadFile, deleteFile, getPublicUrl, listFiles)
- Cloud upload API: `POST /api/upload` — accepts multipart form, validates file type/size, stores via Supabase storage at `users/{userId}/{timestamp}-{safeName}`, returns public URL
- CRDT collaboration stubs (feature-flagged off):
  - `engine/collaboration/CRDTProvider.ts` — WebSocket-based Yjs provider with reconnect, user awareness, cursor sync
  - `engine/collaboration/ProjectCRDTSync.ts` — project state sync via CRDT operations with chunking for large payloads
  - `engine/collaboration/awareness.ts` — user presence/cursor tracking with subscribe/unsubscribe
  - `engine/collaboration/collaborationManager.ts` — top-level manager, gated by `featureFlags.collaboration` / `featureFlags.crdtCollaboration`
  - `engine/collaboration/types.ts` — TypeScript types for users, cursors, events, sync options
  - `engine/collaboration/index.ts` — re-exports
- Docker: `Dockerfile` (multi-stage, alpine, standalone output) + `docker-compose.yml` (Postgres 16, Redis 7, app service)
- Stripe integration (feature-flagged `stripeSubscriptions: false`):
  - `lib/stripe.ts` — Stripe client + plan definitions (Free/Pro/Studio)
  - `POST /api/stripe/create-checkout` — creates subscription checkout session
  - `POST /api/stripe/webhook` — handles checkout.completed, subscription.updated, subscription.deleted
  - `POST /api/stripe/portal` — creates billing portal session
  - Prisma schema updated: User model now has planTier, stripeCustomerId, stripeSubscriptionId, stripeSubscriptionStatus
- Print to PDF: `lib/printExport.ts` — generates printer-friendly HTML with track/clip/mixer/plugin info, auto-triggers window.print()
- Dependencies installed: uuid@8, stripe
- Feature flags added: pwa, cloudSave, s3Storage, printToPdf, stripeSubscriptions
