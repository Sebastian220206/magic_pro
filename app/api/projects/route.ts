import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateShareId } from "@/lib/shareId";

export async function GET() {
  try {
    const session = await getSession();
    const userId = session?.user?.id || 'user-1';

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
  } catch (error) {
    console.error("[Projects] Error fetching projects:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getSession();
  const userId = session?.user?.id || 'user-1';

  try {
    const body = await request.json();
    const { name, tempo, timeSignature, keySignature, templateId } = body;

    const project = await prisma.project.create({
      data: {
        userId,
        name: name || "Untitled",
        tempo: tempo || 120,
        timeSignature: timeSignature || "4/4",
        keySignature: keySignature || "C Major",
        projectFormat: "stereo",
        surroundFormat: "5.1 (ITU 775)",
        spatialAudioMode: "Off",
        lastOpenedAt: new Date(),
      },
    });

    return NextResponse.json(project, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create project" }, { status: 500 });
  }
}
