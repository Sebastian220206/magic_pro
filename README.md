# Magic Pro — DAW  (BY SEBASTIAN GUNTUR)

A digital audio workstation built with Next.js, featuring multi-track audio/MIDI recording, real-time effects, a professional mixer interface, and optional cloud/collaboration/AI features. See [`implementation_plan.md.resolved`](./implementation_plan.md.resolved) for the full architecture plan.

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
- PostgreSQL (optional — SQLite fallback for local dev)

### Setup

```bash
# 1. Install dependencies
npm install

# 2. Set up environment variables
cp .env.example .env.local
# Edit .env.local with your database credentials

# 3. Initialize the database
npx prisma generate
npx prisma db push

# 4. (Optional) Seed sample data
npx prisma db seed

# 5. Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Environment Variables

| Variable | Description | Default |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | `file:./dev.db` (SQLite) |
| `NEXTAUTH_SECRET` | NextAuth encryption key | auto-generated |
| `NEXTAUTH_URL` | App URL | `http://localhost:3000` |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (optional) | — |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key (optional) | — |

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

- **Multi-track timeline** with audio/MIDI clips, drag-to-arrange, trimming, looping
- **Mixer** with per-track volume faders, pan, mute/solo, effects chain
- **Real-time audio scheduling** with lookahead window, drift correction
- **Recording** audio input with live waveform display
- **Piano roll** for MIDI editing (notes, velocity, automation)
- **BPM automation** with tempo curves and live BPM changes
- **History/undo** with capped selective snapshots (no full-store cloning)
- **Session-based authentication** (NextAuth + credentials)
- **Project save/load** to PostgreSQL + IndexedDB with auto-save
- **Cloud save** via Supabase storage (feature-flagged)
- **AI features**: chord suggestion, melody generation, auto-mix suggestions, lyric assistant (OpenAI)
- **Plugin sandbox**: WASM/AudioWorklet plugins with manifest API and standard GUI contract
- **Flex Time/Pitch**: WSOLA time-stretch, YIN pitch detection, warp markers
- **Comping**: take lane manager with crossfade comping
- **Score editor**: Canvas staff renderer with clefs, key/time signatures, noteheads
- **Video track**: HTML5 `<video>` backed playback with sync
- **Export**: WAV + MP3 + stem export; print-to-PDF
- **PWA**: offline-capable shell with service worker (feature-flagged)
- **Stripe subscriptions**: Free/Pro/Studio tiers (feature-flagged)
- **Docker**: multi-stage build with Postgres 16 + Redis 7
- **CI**: GitHub Actions (tsc, eslint, jest on every push)

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npx prisma studio` | Open Prisma database UI |
