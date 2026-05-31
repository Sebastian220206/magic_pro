-- Add lastOpenedAt field to Project
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "lastOpenedAt" TIMESTAMP(3);
