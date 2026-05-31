import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

interface RouteContext {
    params: {
        id: string;
    };
}

interface ProjectStateJson {
    tracks?: Prisma.JsonValue;
    globalTracks?: Prisma.JsonValue;
    settings?: Prisma.JsonValue;
    globalSettings?: Prisma.JsonValue;
    environment?: Prisma.JsonValue;
    currentAlternativeId?: string | null;
    alternatives?: Prisma.JsonValue;
}

export async function GET(
    request: Request,
    { params }: RouteContext
) {
    if (!process.env.DATABASE_URL) {
        return NextResponse.json({ error: "Database configuration missing (DATABASE_URL)" }, { status: 503 });
    }

    try {
        const session = await getSession();
        const userId = session?.user?.id || 'user-1';

        const project = await prisma.project.findUnique({
            where: { id: params.id },
            include: {
                tracks: {
                    include: {
                        clips: {
                            include: {
                                notes: true,
                            },
                        },
                        automation: {
                            include: {
                                points: true,
                            },
                        },
                        plugins: true,
                    },
                },
                buses: {
                    include: {
                        sends: true,
                    },
                },
            },
        });

        if (!project) {
            return NextResponse.json({ error: "Project not found" }, { status: 404 });
        }

        const stateJson = (project.stateJson as ProjectStateJson | null) ?? {};
    
        // Safety check for globalTracks and settings
        const globalTracks = stateJson.globalTracks || { tempo: [], markers: [], signature: [], key: [], beatMapping: [] };
        const settings = stateJson.settings || { sampleRate: 44100, projectStart: 0, projectEnd: 100 };

        const projectData = {
            id: project.id,
            name: project.name,
            tempo: project.tempo,
            timeSignature: project.timeSignature,
            keySignature: project.keySignature,
            projectFormat: project.projectFormat,
            surroundFormat: project.surroundFormat,
            spatialAudioMode: project.spatialAudioMode,
            tracks: (stateJson.tracks as any[]) || project.tracks.map(track => ({
                ...track,
                clips: track.clips.map((clip) => ({
                    ...clip,
                    startBeat: clip.start,
                    startTime: clip.start,
                    fadeIn: { duration: 0, curve: 'linear', gain: 1 },
                    fadeOut: { duration: 0, curve: 'linear', gain: 1 },
                    playbackRate: 1,
                    pitchOffset: 0,
                    stretchMode: 'none',
                }))
            })),
            globalTracks: globalTracks,
            settings: settings,
            globalSettings: stateJson.globalSettings || {},
            environment: stateJson.environment || {},
            currentAlternativeId: stateJson.currentAlternativeId || null,
            alternatives: stateJson.alternatives || [],
        };

        return NextResponse.json(projectData);
    } catch (error) {
        console.error("Error fetching project [ID Route]:", error);
        
        const stringified = JSON.stringify(error, (key, value) =>
            typeof value === 'bigint' ? value.toString() : value
        );
        
        return new Response(JSON.stringify({ 
            error: "Internal Server Error", 
            detail: error instanceof Error ? error.message : "Prisma Serialization Error",
            debug: JSON.parse(stringified)
        }), { 
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const session = await getSession();
  const userId = session?.user?.id || 'user-1';

  const project = await prisma.project.findUnique({
    where: { id: params.id },
    select: { id: true, userId: true },
  });

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  if (project.userId !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const data: Record<string, unknown> = {};

    if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
    if (typeof body.tempo === "number") data.tempo = body.tempo;
    if (body.lastOpenedAt === true) data.lastOpenedAt = new Date();

    const updated = await prisma.project.update({
      where: { id: params.id },
      data,
      select: { id: true, name: true, tempo: true, updatedAt: true, lastOpenedAt: true },
    });

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Failed to update project" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const session = await getSession();
  const userId = session?.user?.id || 'user-1';

  const project = await prisma.project.findUnique({
    where: { id: params.id },
    select: { id: true, userId: true },
  });

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  if (project.userId !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    await prisma.project.delete({ where: { id: params.id } });
    return NextResponse.json({ deleted: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete project" }, { status: 500 });
  }
}
