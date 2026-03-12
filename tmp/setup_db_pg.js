const { Client } = require('pg');

const connectionString = 'postgresql://postgres.bfgxhcvweqppzvxafqgt:wt3Bd7LnOqOXQ1Ph@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres';

const sql = `
CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT NOT NULL,
    "username" TEXT,
    "email" TEXT,
    "passwordHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Project" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tempo" INTEGER NOT NULL DEFAULT 120,
    "timeSignature" TEXT NOT NULL DEFAULT '4/4',
    "keySignature" TEXT NOT NULL DEFAULT 'C Maj',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Track" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "volume" DOUBLE PRECISION NOT NULL DEFAULT 0.8,
    "pan" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "muted" BOOLEAN NOT NULL DEFAULT false,
    "soloed" BOOLEAN NOT NULL DEFAULT false,
    "color" TEXT NOT NULL DEFAULT '#888888',
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Track_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Clip" (
    "id" TEXT NOT NULL,
    "trackId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "start" DOUBLE PRECISION NOT NULL,
    "duration" DOUBLE PRECISION NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "fileUrl" TEXT,
    CONSTRAINT "Clip_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Note" (
    "id" TEXT NOT NULL,
    "clipId" TEXT NOT NULL,
    "pitch" INTEGER NOT NULL,
    "velocity" INTEGER NOT NULL,
    "start" DOUBLE PRECISION NOT NULL,
    "duration" DOUBLE PRECISION NOT NULL,
    CONSTRAINT "Note_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Automation" (
    "id" TEXT NOT NULL,
    "trackId" TEXT NOT NULL,
    "parameter" TEXT NOT NULL,
    CONSTRAINT "Automation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AutomationPoint" (
    "id" TEXT NOT NULL,
    "automationId" TEXT NOT NULL,
    "time" DOUBLE PRECISION NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    CONSTRAINT "AutomationPoint_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Plugin" (
    "id" TEXT NOT NULL,
    "trackId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slotIndex" INTEGER NOT NULL,
    "settingsJson" TEXT,
    CONSTRAINT "Plugin_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Bus" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    CONSTRAINT "Bus_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Send" (
    "id" TEXT NOT NULL,
    "trackId" TEXT NOT NULL,
    "busId" TEXT NOT NULL,
    "level" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    CONSTRAINT "Send_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Project_userId_fkey') THEN
        ALTER TABLE "Project" ADD CONSTRAINT "Project_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Track_projectId_fkey') THEN
        ALTER TABLE "Track" ADD CONSTRAINT "Track_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Clip_trackId_fkey') THEN
        ALTER TABLE "Clip" ADD CONSTRAINT "Clip_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "Track"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Note_clipId_fkey') THEN
        ALTER TABLE "Note" ADD CONSTRAINT "Note_clipId_fkey" FOREIGN KEY ("clipId") REFERENCES "Clip"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
`;

async function main() {
    const client = new Client({ connectionString });
    try {
        await client.connect();
        console.log('Connected to Supabase via pg.');
        await client.query(sql);
        console.log('Database schema created successfully!');
    } catch (err) {
        console.error('Setup failed:', err.message);
    } finally {
        await client.end();
    }
}

main();
