import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { badRequest, requireUserId, withApiHandler } from "@/lib/apiAuth";

export const GET = withApiHandler('projects.list', async () => {
  const userId = await requireUserId();

  const projects = await prisma.project.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      tempo: true,
      timeSignature: true,
      keySignature: true,
      isPublic: true,
      shareId: true,
      createdAt: true,
      updatedAt: true,
      lastOpenedAt: true,
    },
  });

  return NextResponse.json(projects);
});

export const POST = withApiHandler('projects.create', async (request: Request) => {
  const userId = await requireUserId();
  const body = await request.json();
  const { name, tempo, timeSignature, keySignature } = body;

  if (tempo !== undefined && (!Number.isFinite(tempo) || tempo < 20 || tempo > 999)) {
    throw badRequest('Tempo must be between 20 and 999 BPM');
  }

  const project = await prisma.project.create({
    data: {
      userId,
      name: typeof name === 'string' && name.trim() ? name.trim() : "Untitled",
      tempo: tempo ? Math.round(tempo) : 120,
      timeSignature: timeSignature || "4/4",
      keySignature: keySignature || "C Major",
      projectFormat: "stereo",
      surroundFormat: "5.1 (ITU 775)",
      spatialAudioMode: "Off",
      lastOpenedAt: new Date(),
    },
  });

  return NextResponse.json(project, { status: 201 });
});
