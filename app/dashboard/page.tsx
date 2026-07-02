"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { Plus, User, LogOut, Music, Loader2, RefreshCw } from "lucide-react";
import { signOut } from "next-auth/react";
import { NewProjectScreen } from "@/components/NewProjectScreen";
import { ProjectCard } from "@/components/ProjectCard";
import { DeleteConfirmModal } from "@/components/DeleteConfirmModal";
import { onboardingStore } from "@/store/onboardingStore";

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

function SkeletonCard() {
  return (
    <div className="bg-daw-panel border border-daw-border rounded-xl overflow-hidden animate-pulse">
      <div className="h-40 bg-gray-800/50" />
      <div className="p-4 space-y-2">
        <div className="h-4 bg-gray-700/50 rounded w-3/4" />
        <div className="h-3 bg-gray-700/30 rounded w-1/2" />
      </div>
    </div>
  );
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
  }, [status]);

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
      <div className="h-screen w-full flex items-center justify-center bg-daw-bg text-gray-400">
        Loading...
      </div>
    );
  }

  if (status === "unauthenticated") {
    return null;
  }

  return (
    <div className="min-h-screen p-8 max-w-6xl mx-auto overflow-y-auto">
      {showNewProject && (
        <NewProjectScreen onClose={() => setShowNewProject(false)} />
      )}

      <DeleteConfirmModal
        open={!!deleteTarget}
        projectName={deleteTarget?.name ?? ""}
        deleting={deleting}
        onConfirm={handleDelete}
        onCancel={() => { if (!deleting) setDeleteTarget(null); }}
      />

      <header className="flex justify-between items-center mb-12 py-4 border-b border-daw-border">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-daw-surface flex items-center justify-center">
            <User className="text-gray-300 w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white leading-tight">{session?.user?.name || 'Demo User'}</h1>
            <p className="text-xs text-gray-500">{session?.user?.email || 'demo@magicpro.app'}</p>
          </div>
        </div>
        <nav className="flex items-center gap-4">
          <button
            onClick={() => { onboardingStore.reset(); router.push('/welcome'); }}
            className="text-gray-500 hover:text-white transition flex items-center gap-2 text-sm"
            title="Show onboarding again"
          >
            <RefreshCw className="w-4 h-4" />
            Onboarding
          </button>
          {session && (
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="text-gray-400 hover:text-white transition flex items-center gap-2 text-sm"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          )}
        </nav>
      </header>

      <div className="flex justify-between items-end mb-8">
        <h2 className="text-2xl font-bold text-white">Recent Projects</h2>
        <button
          onClick={() => setShowNewProject(true)}
          className="bg-daw-primary px-5 py-2.5 rounded-lg text-white font-medium hover:bg-blue-600 transition flex items-center gap-2 shadow-lg shadow-blue-500/20"
        >
          <Plus className="w-4 h-4" />
          New Project
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {loadingProjects && (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        )}

        {!loadingProjects && projects.length === 0 && (
          <div className="col-span-full flex flex-col items-center justify-center py-20 text-gray-400">
            <Music className="w-12 h-12 mb-4 opacity-20" />
            <p className="text-lg mb-1">No projects yet</p>
            <p className="text-sm mb-6">Click &quot;New Project&quot; to create your first one</p>
            <button
              onClick={() => setShowNewProject(true)}
              className="bg-daw-primary px-5 py-2.5 rounded-lg text-white font-medium hover:bg-blue-600 transition"
            >
              Create Your First Beat
            </button>
          </div>
        )}

        {projects.map((proj) => (
          <ProjectCard
            key={proj.id}
            project={proj}
            onRename={handleRename}
            onDelete={(id) => {
              const p = projects.find((x) => x.id === id);
              if (p) setDeleteTarget({ id: p.id, name: p.name });
            }}
          />
        ))}
      </div>
    </div>
  );
}
