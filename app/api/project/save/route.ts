import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const session = await getSession();
    const sessionUserId = session?.user?.id;

    const body = await req.json();

    console.log("[SAVE REQUEST]");
    console.log("id:", body.id);
    console.log("name:", body.name);
    console.log("payload:", Math.round(JSON.stringify(body).length / 1024), "KB");
    console.log("sessionUserId:", sessionUserId);
    console.log("body.userId:", body.userId);
    console.log("match:", sessionUserId === body.userId);

    const { id, name, tempo, timeSignature, keySignature, projectFormat, surroundFormat, spatialAudioMode, tracks, globalTracks, settings, currentAlternativeId, alternatives, globalSettings, environment } = body;

    // Use server-side session userId — NOT the body value — to stay in sync
    // with the projects list route which also uses getSession()
    const userId = sessionUserId || 'user-1';

    // Generate an ID if the frontend doesn't have one yet
    const projectId = id || `proj-${Date.now()}`;

    // Ensure the user exists
    await prisma.user.upsert({
      where: { id: userId },
      update: {},
      create: { id: userId, email: `${userId}@magicpro.app`, passwordHash: 'demo', name: 'Demo User' },
    });

    // Store the full DAW state as a single JSON blob in stateJson
    const savedProject = await prisma.project.upsert({
      where: { id: projectId },
      update: {
        name: name || 'Untitled',
        tempo: tempo || 120,
        timeSignature: timeSignature || '4/4',
        keySignature: keySignature || 'C Maj',
        projectFormat: projectFormat || 'stereo',
        surroundFormat: surroundFormat || '5.1 (ITU 775)',
        spatialAudioMode: spatialAudioMode || 'Off',
        stateJson: { tracks, globalTracks, settings, currentAlternativeId, alternatives, globalSettings, environment },
      },
      create: {
        id: projectId,
        userId,
        name: name || 'Untitled',
        tempo: tempo || 120,
        timeSignature: timeSignature || '4/4',
        keySignature: keySignature || 'C Maj',
        projectFormat: projectFormat || 'stereo',
        surroundFormat: surroundFormat || '5.1 (ITU 775)',
        spatialAudioMode: spatialAudioMode || 'Off',
        stateJson: { tracks, globalTracks, settings, currentAlternativeId, alternatives, globalSettings, environment },
      },
    });

    console.log("[SAVE OK] projectId:", savedProject.id);
    return NextResponse.json({ id: savedProject.id, success: true });

  } catch (err) {
    console.error("[SAVE ROUTE FAILED]");
    console.error(err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.stack : String(err) },
      { status: 500 }
    );
  }
}
