"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { Plus, User, LogOut, Music, RefreshCw, Sparkles, Loader2 } from "lucide-react";
import { ProjectCard } from "@/components/ProjectCard";
import { DeleteConfirmModal } from "@/components/DeleteConfirmModal";
import BackgroundVideo from "@/components/marketing/BackgroundVideo";
import { onboardingStore } from "@/store/onboardingStore";
import { mediaConfig } from "@/lib/mediaConfig";

/**
 * Loaded on demand.
 *
 * `NewProjectScreen` imports the audio engine and the project store at module
 * scope, so a static import puts the whole DAW in the dashboard's first load
 * for a dialog most visits never open. `ssr: false` because it is only ever
 * shown in response to a click.
 */
const NewProjectScreen = dynamic(
  () => import("@/components/NewProjectScreen").then(m => m.NewProjectScreen),
  {
    ssr: false,
    loading: () => (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
        <Loader2 className="h-6 w-6 animate-spin text-white" />
      </div>
    ),
  },
);

interface ProjectSummary {
  id: string;
  name: string;
  tempo: number;
  timeSignature?: string;
  keySignature?: string;
  updatedAt: string;
  lastOpenedAt?: string | null;
  isPublic?: boolean;
  shareId?: string | null;
}

function SkeletonCard({ index = 0 }: { index?: number }) {
  return (
    <div
      style={{ animationDelay: `${index * 80}ms` }}
      className="animate-in fade-in fill-mode-backwards overflow-hidden rounded-xl border border-daw-border bg-daw-panel"
    >
      <div className="h-40 animate-pulse bg-gray-800/50" />
      <div className="space-y-2 p-4">
        <div className="h-4 w-3/4 animate-pulse rounded bg-gray-700/50" />
        <div className="h-3 w-1/2 animate-pulse rounded bg-gray-700/30" />
      </div>
    </div>
  );
}

/** Time-of-day greeting — small touch, makes the page feel addressed to you. */
function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 5) return "Working late";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default function Dashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [showNewProject, setShowNewProject] = useState(false);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchProjects = useCallback(() => {
    setLoadingProjects(true);
    fetch("/api/projects")
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setProjects(data); })
      .catch((e) => console.error('[Dashboard] Failed to fetch projects:', e))
      .finally(() => setLoadingProjects(false));
  }, []);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    }
  }, [status, router]);

  useEffect(fetchProjects, [fetchProjects]);

  const handleRename = useCallback(async (id: string, name: string) => {
    const res = await fetch(`/api/project/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (res.ok) {
      setProjects((prev) => prev.map((p) => p.id === id ? { ...p, name } : p));
    }
  }, []);

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const res = await fetch(`/api/project/${deleteTarget.id}`, { method: "DELETE" });
    if (res.ok) {
      setProjects((prev) => prev.filter((p) => p.id !== deleteTarget.id));
    }
    setDeleting(false);
    setDeleteTarget(null);
  }, [deleteTarget]);

  if (status === "loading") {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-daw-bg text-gray-400">
        Loading…
      </div>
    );
  }

  if (status === "unauthenticated") {
    return null;
  }

  const name = session?.user?.name || session?.user?.email?.split("@")[0] || "there";

  return (
    <div className="min-h-screen bg-daw-bg select-text">
      {showNewProject && <NewProjectScreen onClose={() => setShowNewProject(false)} />}

      <DeleteConfirmModal
        open={!!deleteTarget}
        projectName={deleteTarget?.name ?? ""}
        deleting={deleting}
        onConfirm={handleDelete}
        onCancel={() => { if (!deleting) setDeleteTarget(null); }}
      />

      {/* ── Header ───────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b border-daw-border bg-daw-bg/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-daw-surface">
              <User className="h-5 w-5 text-gray-300" />
            </div>
            <div className="leading-tight">
              <p className="font-display text-sm font-semibold text-white">
                {session?.user?.name || "Your studio"}
              </p>
              <p className="text-xs text-gray-500">{session?.user?.email}</p>
            </div>
          </div>

          <nav className="flex items-center gap-4">
            <button
              onClick={() => { onboardingStore.reset(); router.push('/welcome'); }}
              className="flex items-center gap-2 text-sm text-gray-500 transition hover:text-white"
              title="Show onboarding again"
            >
              <RefreshCw className="h-4 w-4" />
              <span className="hidden sm:inline">Onboarding</span>
            </button>
            {session && (
              <button
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="flex items-center gap-2 text-sm text-gray-400 transition hover:text-white"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            )}
          </nav>
        </div>
      </header>

      {/* ── Greeting strip ───────────────────────────────────────────── */}
      <BackgroundVideo
        src={mediaConfig.dashboardLoopUrl}
        overlay="light"
        kenBurns
        className="border-b border-daw-border"
      >
        <div className="mx-auto flex max-w-6xl flex-col gap-5 px-6 py-12 sm:flex-row sm:items-end sm:justify-between">
          <div className="animate-in fade-in slide-in-from-bottom-3 duration-500">
            <h1 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
              {greeting()}, {name}
            </h1>
            <p className="mt-2 text-sm text-gray-300">
              {loadingProjects
                ? "Loading your projects…"
                : projects.length > 0
                  ? `${projects.length} project${projects.length === 1 ? "" : "s"} in your studio.`
                  : "Nothing here yet — let's fix that."}
            </p>
          </div>

          <button
            onClick={() => setShowNewProject(true)}
            className="group relative flex shrink-0 items-center gap-2 self-start rounded-xl bg-daw-primary px-5 py-3 font-medium text-white shadow-lg shadow-daw-primary/30 transition hover:brightness-110 sm:self-auto"
          >
            <span className="absolute -inset-1 -z-10 rounded-xl bg-daw-primary/40 blur-lg animate-pulse-glow" />
            <Plus className="h-4 w-4 transition-transform group-hover:rotate-90" />
            New Project
          </button>
        </div>
      </BackgroundVideo>

      {/* ── Projects ─────────────────────────────────────────────────── */}
      <main className="mx-auto max-w-6xl px-6 py-10">
        <h2 className="font-display text-xl font-semibold text-white">Recent Projects</h2>

        <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {loadingProjects && [0, 1, 2, 3].map(i => <SkeletonCard key={i} index={i} />)}

          {!loadingProjects && projects.length === 0 && (
            <div className="col-span-full animate-in fade-in duration-500">
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-daw-border bg-daw-panel/40 px-6 py-20 text-center">
                <div className="relative mb-6">
                  <div className="absolute -inset-4 rounded-full bg-daw-primary/20 blur-2xl animate-pulse-glow" />
                  <Music className="relative h-12 w-12 text-gray-500" />
                </div>
                <p className="font-display text-lg text-white">No projects yet</p>
                <p className="mb-6 mt-1 max-w-sm text-sm text-gray-400">
                  Start from a template and you will have something playing in
                  about thirty seconds.
                </p>
                <button
                  onClick={() => setShowNewProject(true)}
                  className="flex items-center gap-2 rounded-lg bg-daw-primary px-5 py-2.5 font-medium text-white transition hover:brightness-110"
                >
                  <Sparkles className="h-4 w-4" />
                  Create Your First Beat
                </button>
              </div>
            </div>
          )}

          {projects.map((proj, index) => (
            <div
              key={proj.id}
              style={{ animationDelay: `${Math.min(index, 8) * 60}ms` }}
              className="animate-in fade-in slide-in-from-bottom-3 fill-mode-backwards duration-500"
            >
              <ProjectCard
                project={proj}
                onRename={handleRename}
                onDelete={(id) => {
                  const p = projects.find((x) => x.id === id);
                  if (p) setDeleteTarget({ id: p.id, name: p.name });
                }}
              />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
