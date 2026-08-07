import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApiHandler } from "@/lib/apiAuth";

interface RouteContext {
  params: { shareId: string };
}

/**
 * Shape of a track inside `Project.stateJson`, which is what the save route
 * writes. Only the fields the public viewer needs are described here.
 */
interface StoredNote {
  pitch: number;
  velocity: number;
  start: number;
  duration: number;
}

interface StoredClip {
  id: string;
  type: string;
  name: string;
  start?: number;
  startBeat?: number;
  duration: number;
  color: string;
  fileUrl?: string | null;
  muted?: boolean;
  notes?: StoredNote[];
}

interface StoredTrack {
  id: string;
  name: string;
  type: string;
  volume: number;
  pan: number;
  muted: boolean;
  soloed?: boolean;
  color: string;
  orderIndex?: number;
  clips?: StoredClip[];
  plugins?: Array<{ id: string; name?: string; pluginId?: string; slotIndex?: number }>;
}

/**
 * Project state is persisted as a single `stateJson` blob. The relational
 * Track/Clip/Note tables are legacy and are no longer written to, so the public
 * snapshot is projected from the blob. Reading the relational tables here was
 * why shared links rendered an empty project.
 */
function projectTracks(stateJson: Record<string, unknown>) {
  const tracks = Array.isArray(stateJson.tracks) ? (stateJson.tracks as StoredTrack[]) : [];

  return tracks.map(track => ({
    id: track.id,
    name: track.name,
    type: track.type,
    volume: track.volume,
    pan: track.pan,
    muted: track.muted,
    soloed: track.soloed ?? false,
    color: track.color,
    orderIndex: track.orderIndex ?? 0,
    clips: (track.clips ?? []).map(clip => {
      const start = clip.startBeat ?? clip.start ?? 0;
      return {
        id: clip.id,
        type: clip.type,
        name: clip.name,
        start,
        startBeat: start,
        duration: clip.duration,
        color: clip.color,
        fileUrl: clip.fileUrl ?? null,
        muted: clip.muted ?? false,
        notes: (clip.notes ?? []).map(note => ({
          pitch: note.pitch,
          velocity: note.velocity,
          start: note.start,
          duration: note.duration,
        })),
      };
    }),
    // Plugin settings are withheld: the public view only needs slot names.
    plugins: (track.plugins ?? []).map(plugin => ({
      id: plugin.id,
      name: plugin.name ?? plugin.pluginId ?? 'Plugin',
      slotIndex: plugin.slotIndex ?? 0,
    })),
  }));
}

export const GET = withApiHandler('public.share', async (
  _request: Request,
  { params }: RouteContext,
) => {
  const project = await prisma.project.findUnique({
    where: { shareId: params.shareId },
    select: {
      id: true,
      name: true,
      tempo: true,
      timeSignature: true,
      keySignature: true,
      projectFormat: true,
      isPublic: true,
      stateJson: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  // Unpublished links are indistinguishable from missing ones on purpose.
  if (!project || !project.isPublic) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const stateJson = (project.stateJson as Record<string, unknown> | null) ?? {};

  return NextResponse.json({
    id: project.id,
    name: project.name,
    tempo: project.tempo,
    timeSignature: project.timeSignature,
    keySignature: project.keySignature,
    projectFormat: project.projectFormat,
    tracks: projectTracks(stateJson),
    globalTracks: stateJson.globalTracks ?? null,
    settings: stateJson.settings ?? null,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  });
});
