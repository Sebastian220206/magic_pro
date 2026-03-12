import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
    request: Request,
    { params }: { params: { id: string } }
) {
    if (!process.env.DATABASE_URL) {
        return NextResponse.json({ error: "Database configuration missing (DATABASE_URL)" }, { status: 503 });
    }

    try {
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

        const stateJson = project.stateJson || {};

        const projectData = {
            id: project.id,
            name: project.name,
            tempo: project.tempo,
            timeSignature: project.timeSignature,
            keySignature: project.keySignature,
            projectFormat: project.projectFormat,
            surroundFormat: project.surroundFormat,
            spatialAudioMode: project.spatialAudioMode,
            tracks: project.tracks.map(track => ({
                ...track,
                clips: track.clips || []
            })),
            globalTracks: stateJson.globalTracks || project.globalTracks || {
                tempo: [{ time: 0, value: project.tempo, type: 'jump' }],
                markers: [],
                signature: [{ time: 0, numerator: 4, denominator: 4 }],
                key: [{ time: 0, root: 'C', mode: 'major' }],
                beatMapping: []
            },
            settings: stateJson.settings || {},
            globalSettings: stateJson.globalSettings || {},
            environment: stateJson.environment || {},
            currentAlternativeId: stateJson.currentAlternativeId || null,
            alternatives: stateJson.alternatives || [],
        };

        return NextResponse.json(projectData);
    } catch (error) {
        console.error("Error fetching project:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
