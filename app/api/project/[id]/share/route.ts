import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateShareId } from "@/lib/shareId";

interface RouteContext {
  params: { id: string };
}

export async function POST(_request: Request, { params }: RouteContext) {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const project = await prisma.project.findUnique({
    where: { id: params.id },
    select: { id: true, userId: true, shareId: true, isPublic: true, shareCreatedAt: true },
  });

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  if (project.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const shareId = project.shareId || generateShareId();

  await prisma.project.update({
    where: { id: params.id },
    data: {
      shareId,
      isPublic: true,
      shareCreatedAt: project.shareCreatedAt || new Date(),
    },
  });

  const origin = process.env.NEXTAUTH_URL || "http://localhost:3000";
  const url = `${origin}/p/${shareId}`;

  return NextResponse.json({ shareId, url, isPublic: true });
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const project = await prisma.project.findUnique({
    where: { id: params.id },
    select: { id: true, userId: true },
  });

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  if (project.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.project.update({
    where: { id: params.id },
    data: { isPublic: false, shareId: null, shareCreatedAt: null },
  });

  return NextResponse.json({ isPublic: false });
}
