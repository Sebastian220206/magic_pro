FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json* ./
# `prisma generate` runs from a postinstall hook and needs the schema, which is
# not part of the dependency layer otherwise.
COPY prisma ./prisma
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Emit `.next/standalone`, which the runner stage copies. Opt-in; see
# next.config.js.
ENV BUILD_STANDALONE=1
# API routes import the Prisma client, so it has to exist before the build.
# No database connection is needed to generate it.
RUN npx prisma generate
# `prebuild` fetches the General MIDI bank into public/soundfonts/, and the
# build bundles data/soundfontManifest.json describing it. Both are needed for
# the deployed app to have any instruments.
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Carries the GM bank fetched during the build. Unlike a CDN deployment, this
# container serves it itself.
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Healthy once the app answers and can reach its database.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
