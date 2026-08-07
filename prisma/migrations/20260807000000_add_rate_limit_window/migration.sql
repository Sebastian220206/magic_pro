-- Shared rate-limit windows.
--
-- Replaces in-process counters, which on a serverless host gave each warm
-- instance its own separate quota — the effective limit was the configured one
-- multiplied by the instance count. The endpoints this guards bill per call.
CREATE TABLE IF NOT EXISTS "RateLimitWindow" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "resetAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimitWindow_pkey" PRIMARY KEY ("key")
);

-- Supports the bulk delete of expired windows.
CREATE INDEX IF NOT EXISTS "RateLimitWindow_resetAt_idx" ON "RateLimitWindow"("resetAt");
