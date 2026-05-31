import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

interface RouteContext {
  params: { shareId: string };
}

export async function GET(_request: Request, { params }: RouteContext) {
  const project = await prisma.project.findUnique({
    where: { shareId: params.shareId },
    include: {
      tracks: {
        include: {
          clips: { include: { notes: true } },
          automation: { include: { points: true } },
          plugins: true,
        },
      },
      buses: { include: { sends: true } },
    },
  });

  if (!project || !project.isPublic) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const stateJson = (project.stateJson as Record<string, unknown> | null) ?? {};

  const snapshot = {
    id: project.id,
    name: project.name,
    tempo: project.tempo,
    timeSignature: project.timeSignature,
    keySignature: project.keySignature,
    projectFormat: project.projectFormat,
    tracks: project.tracks.map(t => ({
      id: t.id,
      name: t.name,
      type: t.type,
      volume: t.volume,
      pan: t.pan,
      muted: t.muted,
      soloed: t.soloed,
      color: t.color,
      orderIndex: t.orderIndex,
      clips: t.clips.map(c => ({
        id: c.id,
        type: c.type,
        name: c.name,
        start: c.start,
        startBeat: c.start,
        duration: c.duration,
        color: c.color,
        fileUrl: c.fileUrl,
        notes: c.notes.map(n => ({
          pitch: n.pitch,
          velocity: n.velocity,
          start: n.start,
          duration: n.duration,
        })),
      })),
      plugins: t.plugins.map(p => ({ id: p.id, name: p.name, slotIndex: p.slotIndex })),
    })),
    globalTracks: stateJson.globalTracks || null,
    settings: stateJson.settings || null,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  };

  return NextResponse.json(snapshot);
}
