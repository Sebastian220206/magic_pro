import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { forbidden, requireUserId, withApiHandler } from "@/lib/apiAuth";

/**
 * Persist the full DAW state for a project.
 *
 * The entire editable project lives in `stateJson`; the scalar columns are
 * denormalised copies used by the dashboard listing so it does not have to
 * parse the blob.
 */
export const POST = withApiHandler('project.save', async (req: Request) => {
  const userId = await requireUserId();
  const body = await req.json();

  const {
    id,
    name,
    tempo,
    timeSignature,
    keySignature,
    projectFormat,
    surroundFormat,
    spatialAudioMode,
    tracks,
    globalTracks,
    settings,
    currentAlternativeId,
    alternatives,
    globalSettings,
    environment,
  } = body;

  // An existing project may only be overwritten by its owner. Without this
  // check the upsert below would let any caller clobber any project by id.
  if (id) {
    const existing = await prisma.project.findUnique({
      where: { id },
      select: { userId: true },
    });
    if (existing && existing.userId !== userId) throw forbidden();
  }

  const projectId = id || `proj-${Date.now()}`;

  const scalars = {
    name: name || 'Untitled',
    tempo: tempo || 120,
    timeSignature: timeSignature || '4/4',
    keySignature: keySignature || 'C Maj',
    projectFormat: projectFormat || 'stereo',
    surroundFormat: surroundFormat || '5.1 (ITU 775)',
    spatialAudioMode: spatialAudioMode || 'Off',
    stateJson: {
      tracks,
      globalTracks,
      settings,
      currentAlternativeId,
      alternatives,
      globalSettings,
      environment,
    },
  };

  const savedProject = await prisma.project.upsert({
    where: { id: projectId },
    update: scalars,
    create: { id: projectId, userId, ...scalars },
    select: { id: true },
  });

  return NextResponse.json({ id: savedProject.id, success: true });
});
