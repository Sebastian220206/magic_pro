-- Add sharing fields to Project model
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "shareId" TEXT;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "isPublic" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "shareCreatedAt" TIMESTAMP(3);

-- shareId must be unique
CREATE UNIQUE INDEX IF NOT EXISTS "Project_shareId_key" ON "Project"("shareId");
