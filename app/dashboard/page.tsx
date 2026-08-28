"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback, useMemo } from "react";
import {
  Plus, Clock, Grid, GraduationCap, Folder, FileType, User,
  ChevronRight, Loader2, LogOut, RefreshCw, Trash2, Pencil, AlertCircle,
} from "lucide-react";
import { starterTemplates, templateCatalog } from "@/templates/catalog";
import { DeleteConfirmModal } from "@/components/DeleteConfirmModal";
import { onboardingStore } from "@/store/onboardingStore";
import BackgroundVideo from "@/components/marketing/BackgroundVideo";
import { mediaConfig } from "@/lib/mediaConfig";
import {
  DASHBOARD_SECTIONS, defaultSection, sectionById,
  type DashboardSectionId,
} from "@/lib/dashboardSections";

/**
 * The project chooser, as the dashboard.
 *
 * Laid out like Logic's "Choose a Project": categories down the left, tiles in
 * the middle, a Details strip describing whatever is selected, and the actions
 * along the bottom. It keeps the studio's own palette rather than the light
 * macOS chrome of the reference — a white sheet opening out of a neon studio
 * reads as a different application.
 *
 * There is no Cancel: this is the page, not a dialog over one, and a button
 * that cancels nothing is the kind of control this codebase keeps finding.
 *
 * Two categories are dimmed and say why. See `lib/dashboardSections`.
 */

interface ProjectSummary {
  id: string;
  name: string;
  tempo: number;
  timeSignature?: string;
  keySignature?: string;
  updatedAt: string;
  lastOpenedAt?: string | null;
}

const ICONS: Record<DashboardSectionId, typeof Plus> = {
  new: Plus,
  recent: Clock,
  liveLoops: Grid,
  tutorials: GraduationCap,
  demos: Folder,
  templates: FileType,
  account: User,
};

/** A tile the middle pane can show. */
interface Tile {
  id: string;
  label: string;
  description: string;
  art: React.ReactNode;
  onOpen: () => void;
}

function EmptyProjectArt() {
  return (
    <div className="relative flex h-full w-full flex-col gap-[3px] rounded-md bg-studio-control p-2.5">
      <div className="h-1/4 w-1/2 rounded-sm bg-studio-text-dim/50" />
      <div className="h-1/4 w-full rounded-sm bg-studio-text-dim/50" />
      <div className="h-1/4 w-3/4 rounded-sm bg-studio-text-dim/50" />
      <span className="absolute bottom-2 right-2 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white/80">
        <Plus className="h-3 w-3 text-white/80" />
      </span>
    </div>
  );
}

function LiveLoopsArt() {
  return (
    <div className="relative grid h-full w-full grid-cols-4 grid-rows-3 gap-[3px] rounded-md bg-studio-control p-2.5">
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} className="rounded-[2px] bg-studio-text-dim/50" />
      ))}
      <span className="absolute bottom-2 right-2 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white/80">
        <Plus className="h-3 w-3 text-white/80" />
      </span>
    </div>
  );
}

function relativeTime(iso?: string | null): string {
  if (!iso) return "never opened";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "never opened";
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

export default function Dashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [section, setSection] = useState<DashboardSectionId>(defaultSection());
  const [selected, setSelected] = useState<string | null>("empty");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchProjects = useCallback(() => {
    setLoadingProjects(true);
    fetch("/api/projects")
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setProjects(data); })
      .catch(e => console.error("[Dashboard] Failed to fetch projects:", e))
      .finally(() => setLoadingProjects(false));
  }, []);

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

  useEffect(fetchProjects, [fetchProjects]);

  /*
   * Creating a project pulls the audio engine and the whole project store, so
   * it is imported at the moment of the click rather than at module scope —
   * the same reason the old dashboard loaded `NewProjectScreen` dynamically.
   */
  const createBlank = useCallback(async (openLiveLoops: boolean) => {
    setCreating(true);
    try {
      const [{ audioEngine }, { useProjectStore }] = await Promise.all([
        import("@/engine/AudioEngineAdapter"),
        import("@/store/projectStore"),
      ]);
      await audioEngine.waitForReady();
      const store = useProjectStore.getState();
      store.initializeProject({ tempo: 90, keySignature: "C Major", timeSignature: "4/4" });
      // One update, not two: autosave persists between separate `addTrack`
      // calls and the studio then restores the trackless snapshot over it.
      useProjectStore.getState().addTracks([
        { name: "Drums", type: "drummer", color: "#f59e0b" },
        { name: "Piano", type: "software-instrument", color: "#34d399", instrument: "piano" },
      ] as never);
      if (openLiveLoops) useProjectStore.getState().toggleLiveLoops();
      router.push(`/project/${useProjectStore.getState().id}`);
    } catch (e) {
      console.error("[Dashboard] Could not create the project:", e);
      setCreating(false);
    }
  }, [router]);

  const createFromTemplate = useCallback(async (templateId: string) => {
    setCreating(true);
    try {
      const { createProjectFromTemplate } = await import("@/templates");
      const template = templateCatalog.find(t => t.id === templateId);
      if (!template) return;
      const proj = await createProjectFromTemplate(template);
      router.push(`/project/${proj.id}`);
    } catch (e) {
      console.error("[Dashboard] Template creation failed:", e);
      setCreating(false);
    }
  }, [router]);

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const res = await fetch(`/api/project/${deleteTarget.id}`, { method: "DELETE" });
    if (res.ok) setProjects(prev => prev.filter(p => p.id !== deleteTarget.id));
    setDeleting(false);
    setDeleteTarget(null);
  }, [deleteTarget]);

  const handleRename = useCallback(async (id: string, name: string) => {
    const res = await fetch(`/api/project/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (res.ok) setProjects(prev => prev.map(p => (p.id === id ? { ...p, name } : p)));
  }, []);

  // ── Tiles per section ───────────────────────────────────────────────────
  const tiles: Tile[] = useMemo(() => {
    if (section === "new") {
      return [
        {
          id: "empty", label: "Empty Project",
          description: "Create an empty project, with a drum track and a piano to start on.",
          art: <EmptyProjectArt />, onOpen: () => void createBlank(false),
        },
        {
          id: "liveloops", label: "Live Loops",
          description: "Create a project with the Live Loops grid open, for triggering cells rather than a timeline.",
          art: <LiveLoopsArt />, onOpen: () => void createBlank(true),
        },
      ];
    }
    if (section === "templates") {
      return templateCatalog.map(t => ({
        id: t.id,
        label: t.name,
        description: `${t.description} — ${t.bpm} BPM, ${t.tracks.length} track${t.tracks.length === 1 ? "" : "s"}, ${t.keySignature}.`,
        art: (
          <div
            className="flex h-full w-full items-center justify-center rounded-md text-4xl"
            style={{ background: `linear-gradient(135deg, ${t.accentColor}44, transparent 70%)` }}
          >
            {t.previewIcon}
          </div>
        ),
        onOpen: () => void createFromTemplate(t.id),
      }));
    }
    return [];
  }, [section, createBlank, createFromTemplate]);

  const selectedTile = tiles.find(t => t.id === selected);

  /** Most recently opened first; one never opened falls back to its save. */
  const orderedProjects = useMemo(() => [...projects].sort((a, b) =>
    new Date(b.lastOpenedAt ?? b.updatedAt).getTime() -
    new Date(a.lastOpenedAt ?? a.updatedAt).getTime()), [projects]);

  /*
   * What the primary button does here, if anything. On Recent it opens the
   * highlighted project; elsewhere it creates the highlighted tile.
   */
  const openSelectedProject = () => { if (selected) router.push(`/project/${selected}`); };
  const canChoose = section === "recent"
    ? !!selected && projects.some(p => p.id === selected)
    : !!selectedTile;
  const chooseAction = section === "recent" ? openSelectedProject : () => selectedTile?.onOpen();

  const chooseSection = (id: DashboardSectionId) => {
    setSection(id);
    // Arrive with something highlighted, so the Details strip and the button
    // in the footer have a subject the moment the section opens.
    setSelected(
      id === "new" ? "empty"
        : id === "templates" ? (starterTemplates[0]?.id ?? null)
          : id === "recent" ? (orderedProjects[0]?.id ?? null)
            : null,
    );
  };

  /*
   * The first project may arrive after Recent was opened. Highlight it then,
   * rather than leaving the section with no selection and an empty footer.
   */
  useEffect(() => {
    if (section === "recent" && !selected && orderedProjects.length > 0) {
      setSelected(orderedProjects[0].id);
    }
  }, [section, selected, orderedProjects]);

  if (status === "loading") {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-studio-void text-studio-text-dim">
        Loading…
      </div>
    );
  }
  if (status === "unauthenticated") return null;

  const current = sectionById(section);

  return (
    <div className="flex h-screen flex-col bg-studio-void text-studio-text select-text">
      <DeleteConfirmModal
        open={!!deleteTarget}
        projectName={deleteTarget?.name ?? ""}
        deleting={deleting}
        onConfirm={handleDelete}
        onCancel={() => { if (!deleting) setDeleteTarget(null); }}
      />

      {creating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center gap-3 bg-black/70 backdrop-blur-sm">
          <Loader2 className="h-5 w-5 animate-spin text-accent-cyan" />
          <span className="text-sm">Starting the audio engine…</span>
        </div>
      )}

      <header className="flex h-11 shrink-0 items-center justify-center border-b border-studio-line bg-studio-raised">
        <h1 className="text-[13px] font-bold tracking-wide">{current?.heading ?? "Choose a Project"}</h1>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* ── Categories ─────────────────────────────────────────────── */}
        <nav className="w-[210px] shrink-0 overflow-y-auto border-r border-studio-line bg-studio-panel py-2">
          {DASHBOARD_SECTIONS.map(s => {
            const Icon = ICONS[s.id];
            const active = s.id === section;
            return (
              <button
                key={s.id}
                data-section={s.id}
                onClick={() => chooseSection(s.id)}
                title={s.unavailable ?? undefined}
                className={`flex w-full items-center gap-2.5 px-4 py-2 text-left text-[13px] transition-colors ${
                  active
                    ? "bg-accent-cyan/15 text-accent-cyan"
                    : s.unavailable
                      ? "text-studio-text-dim/45 hover:bg-white/[0.03]"
                      : "text-studio-text hover:bg-white/[0.04]"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{s.label}</span>
              </button>
            );
          })}
        </nav>

        {/* ── Content ────────────────────────────────────────────────── */}
        <main className="relative flex min-w-0 flex-1 flex-col">
          {/*
            The loop from the old dashboard, kept.

            It used to sit behind a greeting strip that this layout does not
            have, so it backs the chooser itself. Laid in as a sibling rather
            than wrapped around the content: `BackgroundVideo` puts its children
            in a `relative z-10 w-full` box, which would take over the sizing of
            a pane that has to be `flex-1` and scroll on its own.

            One scrim, not two. `overlay="heavy"` is black/60 under a gradient
            that reaches full opacity at the bottom — stacked with a scrim of
            our own it left the footage effectively invisible, which is not
            keeping it. `none` plus a single tuned layer keeps the motion
            readable underneath while tile labels and the dimmed categories'
            explanations stay legible over any frame.
          */}
          {/*
            Positioned by a wrapper, not by a class on the component.

            `BackgroundVideo`'s root is `relative isolate overflow-hidden
            ${className}`, and passing `absolute` there does not win: Tailwind
            emits `.absolute` before `.relative` in the stylesheet, so with
            equal specificity `relative` takes it whatever order the class
            attribute is in. The element then laid out as a relative block with
            no children — full width, **zero height** — and the loop played at
            opacity 1, readyState 4, in a box nobody could see.
          */}
          <div className="pointer-events-none absolute inset-0 z-0">
            <BackgroundVideo
              src={mediaConfig.dashboardLoopUrl}
              overlay="none"
              className="h-full w-full"
            />
          </div>
          <div
            data-backdrop-scrim
            className="pointer-events-none absolute inset-0 z-0 bg-gradient-to-b from-studio-void/80 via-studio-void/70 to-studio-void/85"
            aria-hidden="true"
          />

          <div className="relative z-10 flex-1 overflow-y-auto p-8">
            {current?.unavailable ? (
              /* On its own surface: a paragraph of dim text directly over
                 moving footage is legible on some frames and not others. */
              <div
                data-unavailable
                className="mx-auto mt-16 flex max-w-md flex-col items-center gap-3 rounded-lg border border-studio-line bg-studio-panel/90 px-6 py-8 text-center backdrop-blur-sm"
              >
                <AlertCircle className="h-8 w-8 text-studio-text-dim/60" />
                <p className="text-[13px] leading-relaxed text-studio-text">{current.unavailable}</p>
              </div>
            ) : section === "recent" ? (
              <RecentList
                projects={orderedProjects}
                loading={loadingProjects}
                selected={selected}
                onSelect={setSelected}
                onOpen={id => router.push(`/project/${id}`)}
                onRename={handleRename}
                onDelete={(id, name) => setDeleteTarget({ id, name })}
                onStartNew={() => chooseSection("new")}
              />
            ) : section === "tutorials" ? (
              <Tutorials onRun={() => { onboardingStore.reset(); router.push("/welcome"); }} />
            ) : section === "account" ? (
              <Account
                name={session?.user?.name ?? null}
                email={session?.user?.email ?? null}
                image={session?.user?.image ?? null}
                projectCount={loadingProjects ? null : projects.length}
                onReplayOnboarding={() => { onboardingStore.reset(); router.push("/welcome"); }}
                onSignOut={() => signOut({ callbackUrl: "/login" })}
              />
            ) : (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(148px,1fr))] gap-x-8 gap-y-7">
                {tiles.map(tile => (
                  <button
                    key={tile.id}
                    data-tile={tile.id}
                    onClick={() => setSelected(tile.id)}
                    onDoubleClick={tile.onOpen}
                    className="group flex flex-col items-center gap-2 focus:outline-none"
                  >
                    <span
                      className={`aspect-[4/3] w-full overflow-hidden rounded-lg border-2 transition-all ${
                        selected === tile.id
                          ? "border-accent-cyan shadow-[0_0_0_3px_rgba(34,211,238,0.18)]"
                          : "border-transparent group-hover:border-studio-line-strong"
                      }`}
                    >
                      {tile.art}
                    </span>
                    <span
                      className={`max-w-full truncate rounded px-2 py-0.5 text-[12px] ${
                        selected === tile.id ? "bg-accent-cyan text-[#04070b] font-semibold" : "text-studio-text"
                      }`}
                    >
                      {tile.label}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── Details ────────────────────────────────────────────────── */}
          {tiles.length > 0 && (
            <div className="relative z-10 shrink-0 border-t border-studio-line bg-studio-raised/95 backdrop-blur-sm">
              <button
                onClick={() => setDetailsOpen(v => !v)}
                className="flex h-9 w-full items-center gap-2 px-4 transition-colors hover:bg-white/[0.03]"
              >
                <ChevronRight className={`h-3.5 w-3.5 text-studio-text-dim transition-transform ${detailsOpen ? "rotate-90" : ""}`} />
                <span className="text-[11px] font-bold uppercase tracking-wider text-studio-text-dim">Details</span>
                <span data-details className="flex-1 truncate px-4 text-center text-[12px] text-studio-text-dim">
                  {selectedTile?.description ?? "Select a project to start from."}
                </span>
              </button>
              {detailsOpen && selectedTile && (
                <div className="border-t border-studio-line px-4 py-3 text-[12px] leading-relaxed text-studio-text-dim">
                  {selectedTile.description}
                  <p className="mt-2 text-studio-text-dim/70">
                    Double-click the tile, or press Choose, to create it.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ── Actions ────────────────────────────────────────────────── */}
          <footer className="relative z-10 flex h-14 shrink-0 items-center justify-between gap-3 border-t border-studio-line bg-studio-panel/95 px-4 backdrop-blur-sm">
            <button
              onClick={() => chooseSection("recent")}
              className="rounded-md border border-studio-line bg-studio-control px-4 py-1.5 text-[13px] transition-colors hover:bg-white/[0.05]"
            >
              Open an existing project…
            </button>
            {/*
              Choose only where there is something to choose.
              On Recent it opens the highlighted project; on New Project and
              Project Templates it creates the highlighted one. Tutorials,
              Account and the two dimmed sections have no such thing, and a
              button that can never do anything is the exact kind of control
              this codebase keeps having to remove.
            */}
            {canChoose && (
              <button
                data-choose
                onClick={chooseAction}
                disabled={creating}
                className="rounded-md bg-accent-cyan px-6 py-1.5 text-[13px] font-semibold text-[#04070b] transition-colors hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {section === "recent" ? "Open" : "Choose"}
              </button>
            )}
          </footer>
        </main>
      </div>
    </div>
  );
}

/* ── Recent ──────────────────────────────────────────────────────────────── */

function RecentList({
  projects, loading, selected, onSelect, onOpen, onRename, onDelete, onStartNew,
}: {
  projects: ProjectSummary[];
  loading: boolean;
  selected: string | null;
  onSelect: (id: string) => void;
  onOpen: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string, name: string) => void;
  onStartNew: () => void;
}) {
  if (loading) {
    return (
      <div className="flex items-center gap-3 pt-16 justify-center text-studio-text-dim">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading your projects…
      </div>
    );
  }
  if (projects.length === 0) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-3 pt-16 text-center">
        <p className="text-[13px] text-studio-text-dim">
          Nothing here yet. Start one from New Project and it will appear in this list.
        </p>
        <button
          onClick={onStartNew}
          className="rounded-md bg-accent-cyan px-4 py-1.5 text-[13px] font-semibold text-[#04070b]"
        >
          New Project
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0.5">
      {projects.map(p => (
        <div
          key={p.id}
          data-project={p.id}
          onClick={() => onSelect(p.id)}
          onDoubleClick={() => onOpen(p.id)}
          className={`group flex cursor-default items-center gap-3 rounded-md px-3 py-2 transition-colors ${
            selected === p.id ? "bg-accent-cyan/15" : "hover:bg-white/[0.04]"
          }`}
        >
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px]">{p.name}</p>
            <p className="text-[11px] text-studio-text-dim">
              {relativeTime(p.lastOpenedAt ?? p.updatedAt)} · {p.tempo} BPM
              {p.timeSignature ? ` · ${p.timeSignature}` : ""}
            </p>
          </div>

          <button
            onClick={e => {
              e.stopPropagation();
              const next = prompt("Project name:", p.name);
              if (next && next.trim() && next !== p.name) onRename(p.id, next.trim());
            }}
            title="Rename"
            aria-label={`Rename ${p.name}`}
            className="rounded p-1.5 text-studio-text-dim opacity-0 transition hover:bg-white/10 hover:text-white group-hover:opacity-100"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={e => { e.stopPropagation(); onDelete(p.id, p.name); }}
            title="Delete"
            aria-label={`Delete ${p.name}`}
            className="rounded p-1.5 text-studio-text-dim opacity-0 transition hover:bg-red-500/15 hover:text-red-400 group-hover:opacity-100"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={e => { e.stopPropagation(); onOpen(p.id); }}
            className="rounded-md border border-studio-line bg-studio-control px-3 py-1 text-[12px] transition-colors hover:bg-white/[0.06]"
          >
            Open
          </button>
        </div>
      ))}
    </div>
  );
}

/* ── Tutorials ───────────────────────────────────────────────────────────── */

/**
 * The guided tour that already exists.
 *
 * `OnboardingOverlay` walks four steps in the studio and is driven by
 * `onboardingStore`; this is a way back to it once it has been dismissed,
 * which there previously was not except for a small icon in the old header.
 */
function Tutorials({ onRun }: { onRun: () => void }) {
  const steps = [
    { title: "Press Play", body: "Start the transport and hear the project running." },
    { title: "Click the Piano Roll", body: "Open a region and see the notes inside it." },
    { title: "Add a Loop", body: "Drag something in from the library." },
    { title: "You made your first beat", body: "Where to go next." },
  ];
  return (
    <div className="mx-auto max-w-lg">
      <p className="rounded-md bg-studio-panel/85 px-3 py-2 text-[13px] text-studio-text backdrop-blur-sm">
        A four-step tour that runs inside the studio and points at the controls as it goes.
      </p>
      <ol className="mt-5 space-y-2">
        {steps.map((s, i) => (
          <li key={s.title} className="flex gap-3 rounded-md border border-studio-line bg-studio-panel px-3 py-2.5">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-cyan/15 text-[11px] font-bold text-accent-cyan">
              {i + 1}
            </span>
            <span>
              <span className="block text-[13px]">{s.title}</span>
              <span className="block text-[11px] text-studio-text-dim">{s.body}</span>
            </span>
          </li>
        ))}
      </ol>
      <button
        data-run-tutorial
        onClick={onRun}
        className="mt-6 rounded-md bg-accent-cyan px-5 py-2 text-[13px] font-semibold text-[#04070b] transition-colors hover:bg-cyan-300"
      >
        Start the tour
      </button>
    </div>
  );
}

/* ── Account ─────────────────────────────────────────────────────────────── */

function Account({
  name, email, image, projectCount, onReplayOnboarding, onSignOut,
}: {
  name: string | null;
  email: string | null;
  image: string | null;
  projectCount: number | null;
  onReplayOnboarding: () => void;
  onSignOut: () => void;
}) {
  return (
    <div className="mx-auto max-w-lg">
      <div className="flex items-center gap-4 rounded-lg border border-studio-line bg-studio-panel p-5">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt="" className="h-14 w-14 rounded-full object-cover" />
        ) : (
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-studio-control">
            <User className="h-6 w-6 text-studio-text-dim" />
          </div>
        )}
        <div className="min-w-0">
          <p data-account-name className="truncate text-[15px] font-semibold">
            {name || email?.split("@")[0] || "Signed in"}
          </p>
          <p data-account-email className="truncate text-[12px] text-studio-text-dim">{email ?? "—"}</p>
        </div>
      </div>

      <dl className="mt-4 divide-y divide-studio-line overflow-hidden rounded-lg border border-studio-line bg-studio-panel text-[13px]">
        <div className="flex items-center justify-between px-5 py-3">
          <dt className="text-studio-text-dim">Projects</dt>
          <dd>{projectCount === null ? "…" : projectCount}</dd>
        </div>
        <div className="flex items-center justify-between px-5 py-3">
          <dt className="text-studio-text-dim">Signed in with</dt>
          <dd>{email ? "Email" : "—"}</dd>
        </div>
        {/*
          Audio is held in this browser and never uploaded, so an account is
          not the whole picture of where someone's work lives. Said here rather
          than discovered on another machine.
        */}
        <div className="flex items-start justify-between gap-6 px-5 py-3">
          <dt className="text-studio-text-dim">Audio files</dt>
          <dd className="text-right text-[12px] text-studio-text-dim">
            Kept in this browser, not on your account
          </dd>
        </div>
      </dl>

      <div className="mt-4 flex flex-col gap-2">
        <button
          onClick={onReplayOnboarding}
          className="flex items-center justify-center gap-2 rounded-md border border-studio-line bg-studio-control px-4 py-2 text-[13px] transition-colors hover:bg-white/[0.05]"
        >
          <RefreshCw className="h-4 w-4" />
          Replay the introduction
        </button>
        <button
          data-sign-out
          onClick={onSignOut}
          className="flex items-center justify-center gap-2 rounded-md border border-red-500/30 bg-red-500/[0.07] px-4 py-2 text-[13px] text-red-300 transition-colors hover:bg-red-500/15"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </div>
  );
}
