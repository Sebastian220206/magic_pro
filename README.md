# Magic Pro — DAW  (BY SEBASTIAN GUNTUR)

A digital audio workstation built with Next.js, featuring multi-track audio/MIDI recording, real-time effects, a professional mixer interface, and optional cloud/AI features.

> ### 📍 Start here
>
> **[`ASSESSMENT.md`](./ASSESSMENT.md)** is the statement of record for what
> actually works, what doesn't, and what to do next. The feature list below
> describes intended scope — a meaningful portion of it is implemented but not
> yet reachable from the UI, and the assessment says precisely which.
>
> Working on this codebase? Read **[`docs/CONTINUITY.md`](./docs/CONTINUITY.md)**
> first — it explains the conventions that keep a 128k-line project coherent
> across sessions.
>
> `PROJECT_REPORT.md`, `PROJECT_DETAILED.md` and `ROADMAP_TO_LOGIC_PARITY.md` are
> **historical** and contradict both each other and the code. Retained for the
> vision discussion only; do not use them as a status reference.

## Tech Stack

- **Frontend**: Next.js 14 (React 18), Zustand, Tailwind CSS, WebGL2
- **Backend**: Next.js API routes, Prisma ORM, PostgreSQL / SQLite
- **Audio**: Web Audio API, AudioWorklet, custom scheduler with lookahead, WASM DSP
- **Auth**: NextAuth.js
- **Storage**: IndexedDB (client-side), PostgreSQL (server-side), Supabase / S3 (cloud)
- **Cloud**: Docker, PWA, Stripe subscriptions, OpenAI integration
- **Plugin System**: WASM sandbox with manifest-based plugin API

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL — required. `prisma/schema.prisma` declares the `postgresql`
  provider; there is no SQLite fallback.

### Setup

```bash
# 1. Install dependencies
npm install

# 2. Set up environment variables
cp .env.example .env
# Edit .env — DATABASE_URL and NEXTAUTH_SECRET are the two that block startup

# 3. Initialize the database
npx prisma generate
npx prisma migrate deploy

# 4. Download the General MIDI bank (~30 MB, not in git)
npm run soundfont:gm

# 5. (Optional) Seed sample data
npx prisma db seed

# 6. Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

Step 4 is what gives you instruments. It also runs automatically before
`npm run build`, so a production build always has one.

### Environment Variables

`.env.example` is the full list, with a note on what breaks without each one.
The essentials:

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | yes | PostgreSQL connection string |
| `NEXTAUTH_SECRET` | yes | Session encryption key; changing it signs everyone out |
| `NEXTAUTH_URL` | yes | Canonical app URL — share links are built from it |
| `NEXT_PUBLIC_SUPABASE_URL` | no | Object storage for uploads |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | no | Object storage for uploads |
| `SUPABASE_SERVICE_ROLE_KEY` | no | Admin storage operations — server only |
| `OPENAI_API_KEY` | no | AI features; without it they answer 503 |
| `STRIPE_SECRET_KEY` | no | Billing; without it everyone is on the free tier |
| `STRIPE_WEBHOOK_SECRET` | no | Required for subscriptions to actually activate |
| `ERROR_WEBHOOK_URL` | no | Forwards server errors to a collector |

## Deployment

### Before the first deploy

1. **Provision Postgres** and set `DATABASE_URL`.
2. **Run migrations** — `npx prisma migrate deploy`. Use a direct connection
   (Supabase port 5432), not the transaction pooler.
3. **Set `NEXTAUTH_SECRET` and `NEXTAUTH_URL`.** `NEXTAUTH_URL` must be the real
   public URL; share links are generated from it.
4. **Point the Stripe webhook** at `https://your-domain/api/stripe/webhook` and
   set `STRIPE_WEBHOOK_SECRET`. Without it, payments succeed and nobody is ever
   upgraded.

The General MIDI bank needs no action — `prebuild` fetches it, and
`data/soundfontManifest.json` (committed) describes its presets so the server
never has to read the 30 MB file.

### Vercel

Push, and set the environment variables in Project Settings. `vercel.json`
already carries the cross-origin isolation headers the audio engine needs.

Leave `BUILD_STANDALONE` unset — Vercel does its own bundling.

### Docker

```bash
docker compose up --build
```

The image is multi-stage and runs as a non-root user. `docker-compose.yml`
brings up Postgres 16 and Redis 7 alongside it. Run migrations against the
container's database once it is up.

### Verifying a deploy

`GET /api/health` reports whether the app can reach its database and how many
soundfonts it shipped:

```json
{ "status": "ok", "checks": { "database": "up", "soundfonts": "ok" }, "soundfonts": 1 }
```

It answers **503** when the database is unreachable. `soundfonts: "missing"`
does not fail the probe but means the build shipped no instruments — worth an
alert, because nothing else surfaces it.

### Operational notes

- **Errors** are written to stdout as one line of JSON each, with a `requestId`
  also returned to the client in `X-Request-Id`. Set `ERROR_WEBHOOK_URL` to
  forward them. Credential-shaped strings are scrubbed before either.
- **Rate limits** are shared across instances via the `RateLimitWindow` table.
  If the migration has not run, the limiter falls back to per-instance counting
  and logs once — the app keeps working, but the quota is weaker.
- Expired rate-limit rows are only overwritten when a key recurs, so schedule
  `sweepSharedWindows()` if you want the table to stay small.

## Architecture

```
app/                    Next.js App Router (pages + API routes)
├── project/[projectId]  Main DAW workspace
├── dashboard            User dashboard
└── api/                 REST endpoints

components/             React UI components
├── TransportBar         Transport controls (play, stop, BPM, metronome)
├── Mixer               Channel strip mixer with volume faders
├── Timeline            Clip arrangement timeline
├── Inspector           Track/clip property inspector
├── TrackList           Track headers and controls
└── ...

engine/                 Audio engine
├── audioEngine/         Scheduler, routing, playback control
├── AudioEngineAdapter   Engine singleton
├── audioRecording/      Recording pipeline
├── useAudioPlayer.ts    React hook bridging store → scheduler
├── automation/          Automation lanes
├── waveform.ts          Peak extraction + waveform drawing
├── timeline/            Canvas timeline renderer + clip renderer
└── persistence/         Save/load to IndexedDB + server

store/                  Zustand stores
├── projectStore.ts      Main project state (tracks, clips, transport, history)
├── midiStore.ts         MIDI recording state
├── mixerStore.ts        Mixer layout state
└── ...

lib/                    Shared utilities
models/                 Data model types (Track, Clip, etc.)
prisma/                 Database schema + migrations
```

## Key Features

### Working — reachable from the UI

- **Multi-track timeline** with audio/MIDI clips, drag-to-arrange, trimming, looping
- **Mixer** with per-track volume faders, pan, mute/solo, effects chain
- **Real-time audio scheduling** with lookahead window and drift correction
- **Recording** audio input with live waveform display
- **Piano roll** for MIDI editing (notes, velocity, quantise, humanise)
- **Metronome** with accent/level/polyphonic click settings
- **Live BPM changes** during playback
- **History/undo** with capped selective snapshots
- **Session-based authentication** (NextAuth + credentials)
- **Project save/load** to PostgreSQL + IndexedDB with auto-save
- **Public project sharing** via read-only share links
- **AI assistant**: chord suggestion, melody generation, auto-mix, lyrics (OpenAI)
- **Export**: WAV; MP3 via the bounce dialog
- **Docker**: multi-stage build with Postgres 16 + Redis 7
- **CI**: GitHub Actions — typecheck, lint, jest, reachability gate, build

### Implemented but not yet wired into the UI

These exist as working modules that nothing currently imports. They are not
user-accessible. See `ASSESSMENT.md` §7.1 and §17.6.

- Flex Time / Flex Pitch (WSOLA, YIN), comping, audio quantisation
- Plugin sandbox with manifest API and GUI contract
- Score/notation editor, guitar tab
- Video track, MIDI control-surface mapping
- Six additional Rust DSP effects (reverb, delay, saturation, chorus, limiter,
  de-esser) — written, but the WASM core has never been built or shipped

### Not implemented

- Tempo *curves* affecting scheduled audio (single tempo value only)
- Server-side stem separation, real-time collaboration, surround/Atmos
- Multiband compression
- PWA is scaffolded but off

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start development server |
| `npm run build` | Production build (fetches the GM bank first) |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Run the Jest suite |
| `npm run verify` | typecheck + lint + tests + reachability gate |
| `npm run soundfont:gm` | Download the General MIDI bank into `public/soundfonts/` |
| `npm run soundfont:list` | Show the available banks |
| `npm run soundfont:manifest` | Regenerate `data/soundfontManifest.json` |
| `npm run soundfont:check` | Fail if the manifest is out of date |
| `npx prisma migrate deploy` | Apply migrations |
| `npx prisma studio` | Open Prisma database UI |
