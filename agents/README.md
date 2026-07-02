# Magic Pro — Agent System

## How to use this

### Starting a new agent session

1. Open agents/orchestrator/audit-score.md — know your score
2. Open agents/orchestrator/daily-log.md — know today's tasks
3. Pick an agent to run
4. Open agents/[agent-name]/context.md
5. Copy the PROMPT TEMPLATE section
6. Open a new AI session (opencode, Claude, etc.)
7. Paste the prompt + attach only the files in scope.md
8. Complete the task, commit with message format:
   [agent-name]: description of change
9. Run npm run build — confirm it passes
10. Update daily-log.md with result

### Commit message format

```
typescript-agent: fix InputJsonValue mismatch in save/route.ts
audio-engine-agent: fix track lifecycle createTrack allocation
ui-state-agent: add error boundaries to Timeline and Mixer
db-agent: deploy prisma migrations to production
deploy-agent: add COOP/COEP headers to vercel.json
```

### Golden rules

1. Each agent only edits files in its scope.md
2. Build must pass after every session
3. Never run two agents on the same file same day
4. Orchestrator reviews before any production deploy
5. Update audit-score.md after every meaningful session

### Current hard blockers (fix these first)

1. Prisma InputJsonValue — DB Agent
2. projectStore.ts TS errors — TypeScript Agent
3. Track lifecycle crash — Audio Engine Agent
4. Prisma migrations — DB Agent
