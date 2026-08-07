import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
    badRequest,
    forbidden,
    notFound,
    requireProjectOwner,
    requireUserId,
    withApiHandler,
} from "@/lib/apiAuth";

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

const DEFAULT_GLOBAL_TRACKS = {
    tempo: [{ time: 0, value: 120, type: 'jump' }],
    markers: [],
    signature: [{ time: 0, numerator: 4, denominator: 4 }],
    key: [{ time: 0, root: 'C', mode: 'major' }],
    beatMapping: [],
};

const DEFAULT_SETTINGS = { sampleRate: 44100, projectStart: 0, projectEnd: 100 };

/**
 * Load the relational track graph.
 *
 * Only reachable for projects written before state moved into `stateJson`; the
 * current save path writes the blob exclusively. Kept as a fallback so legacy
 * rows still open, but skipped entirely on the common path because the joins
 * are expensive and return nothing.
 */
async function loadLegacyTracks(projectId: string) {
    const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: {
            tracks: {
                include: {
                    clips: { include: { notes: true } },
                    automation: { include: { points: true } },
                    plugins: true,
                },
            },
        },
    });

    return (project?.tracks ?? []).map(track => ({
        ...track,
        clips: track.clips.map(clip => ({
            ...clip,
            startBeat: clip.start,
            startTime: clip.start,
            fadeIn: { duration: 0, curve: 'linear', gain: 1 },
            fadeOut: { duration: 0, curve: 'linear', gain: 1 },
            playbackRate: 1,
            pitchOffset: 0,
            stretchMode: 'none',
        })),
    }));
}

export const GET = withApiHandler('project.get', async (
    _request: Request,
    { params }: RouteContext,
) => {
    if (!process.env.DATABASE_URL) {
        return NextResponse.json(
            { error: "Database configuration missing (DATABASE_URL)" },
            { status: 503 },
        );
    }

    const userId = await requireUserId();

    const project = await prisma.project.findUnique({
        where: { id: params.id },
        select: {
            id: true,
            userId: true,
            name: true,
            tempo: true,
            timeSignature: true,
            keySignature: true,
            projectFormat: true,
            surroundFormat: true,
            spatialAudioMode: true,
            stateJson: true,
        },
    });

    if (!project) throw notFound('Project');
    if (project.userId !== userId) throw forbidden();

    const stateJson = (project.stateJson as ProjectStateJson | null) ?? {};
    const tracks = (stateJson.tracks as unknown[] | undefined)
        ?? await loadLegacyTracks(params.id);

    return NextResponse.json({
        id: project.id,
        name: project.name,
        tempo: project.tempo,
        timeSignature: project.timeSignature,
        keySignature: project.keySignature,
        projectFormat: project.projectFormat,
        surroundFormat: project.surroundFormat,
        spatialAudioMode: project.spatialAudioMode,
        tracks,
        globalTracks: stateJson.globalTracks || DEFAULT_GLOBAL_TRACKS,
        settings: stateJson.settings || DEFAULT_SETTINGS,
        globalSettings: stateJson.globalSettings || {},
        environment: stateJson.environment || {},
        currentAlternativeId: stateJson.currentAlternativeId || null,
        alternatives: stateJson.alternatives || [],
    });
});

export const PATCH = withApiHandler('project.patch', async (
    request: Request,
    { params }: RouteContext,
) => {
    await requireProjectOwner(params.id);

    const body = await request.json();
    const data: Prisma.ProjectUpdateInput = {};

    if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
    if (typeof body.tempo === "number") {
        if (!Number.isFinite(body.tempo) || body.tempo < 20 || body.tempo > 999) {
            throw badRequest('Tempo must be between 20 and 999 BPM');
        }
        data.tempo = Math.round(body.tempo);
    }
    if (body.lastOpenedAt === true) data.lastOpenedAt = new Date();

    const updated = await prisma.project.update({
        where: { id: params.id },
        data,
        select: { id: true, name: true, tempo: true, updatedAt: true, lastOpenedAt: true },
    });

    return NextResponse.json(updated);
});

export const DELETE = withApiHandler('project.delete', async (
    _request: Request,
    { params }: RouteContext,
) => {
    await requireProjectOwner(params.id);
    await prisma.project.delete({ where: { id: params.id } });
    return NextResponse.json({ deleted: true });
});
