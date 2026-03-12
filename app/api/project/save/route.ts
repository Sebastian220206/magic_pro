import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
    if (!process.env.DATABASE_URL) {
        return NextResponse.json({ error: "Database configuration missing (DATABASE_URL)" }, { status: 503 });
    }

    try {
        const body = await request.json();
        const { id, userId, name, tempo, timeSignature, keySignature, projectFormat, surroundFormat, spatialAudioMode, tracks, globalTracks, settings, currentAlternativeId, alternatives, globalSettings, environment } = body;

        // Using a transaction for atomic project saving
        const savedProject = await prisma.$transaction(async (tx) => {
            // 1. Update project root
            const project = await tx.project.upsert({
                where: { id: id || "temp-id" },
                update: {
                    name,
                    tempo,
                    timeSignature,
                    keySignature,
                    projectFormat,
                    surroundFormat,
                    spatialAudioMode,
                    stateJson: {
                        tracks,
                        globalTracks,
                        settings,
                        currentAlternativeId,
                        alternatives,
                        globalSettings,
                        environment
                    }
                },
                create: {
                    userId,
                    name,
                    tempo,
                    timeSignature,
                    keySignature,
                    projectFormat,
                    surroundFormat,
                    spatialAudioMode,
                    stateJson: {
                        tracks,
                        globalTracks,
                        settings,
                        currentAlternativeId,
                        alternatives,
                        globalSettings,
                        environment
                    }
                },
            });

            // 2. Clear old data for simple "full-replace" re-serialization
            // In a production app, we would use a more granular sync or patch system
            await tx.track.deleteMany({ where: { projectId: project.id } });

            // 3. Re-create the entire project graph
            // This is a naive implementation for demonstration
            for (const t of tracks) {
                const createdTrack = await tx.track.create({
                    data: {
                        projectId: project.id,
                        name: t.name,
                        type: t.type,
                        volume: t.volume,
                        pan: t.pan,
                        muted: t.muted,
                        soloed: t.soloed,
                        color: t.color,
                        orderIndex: t.orderIndex || 0,
                    },
                });

                if (t.clips) {
                    for (const c of t.clips) {
                        const createdClip = await tx.clip.create({
                            data: {
                                trackId: createdTrack.id,
                                type: c.type,
                                start: c.start,
                                duration: c.duration,
                                name: c.name,
                                color: c.color,
                            },
                        });

                        if (c.notes) {
                            await tx.note.createMany({
                                data: c.notes.map((n: any) => ({
                                    clipId: createdClip.id,
                                    pitch: n.pitch,
                                    velocity: n.velocity,
                                    start: n.start,
                                    duration: n.duration,
                                })),
                            });
                        }
                    }
                }
            }
            return project;
        });

        return NextResponse.json(savedProject);
    } catch (error) {
        console.error("Error saving project:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
