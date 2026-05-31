"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Music, MoreHorizontal, Pencil, Trash2, Loader2 } from "lucide-react";
import { formatTimeAgo } from "@/lib/time";

interface ProjectData {
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

const GRADIENTS = [
  'from-purple-900/40 to-indigo-900/40',
  'from-emerald-900/40 to-teal-900/40',
  'from-amber-900/40 to-orange-900/40',
  'from-cyan-900/40 to-blue-900/40',
  'from-pink-900/40 to-rose-900/40',
  'from-lime-900/40 to-green-900/40',
];

function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(h);
}

interface Props {
  project: ProjectData;
  onRename: (id: string, name: string) => Promise<void>;
  onDelete: (id: string) => void;
}

export function ProjectCard({ project, onRename, onDelete }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(project.name);
  const [saving, setSaving] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const gradient = GRADIENTS[hashId(project.id) % GRADIENTS.length];
  const initials = project.name.slice(0, 2).toUpperCase();

  const handleOpen = useCallback(() => {
    fetch(`/api/project/${project.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lastOpenedAt: true }),
    }).catch((e: any) => console.error('[ProjectCard] Failed to update lastOpenedAt:', e));
    router.push(`/project/${project.id}`);
  }, [project.id, router]);

  const handleStartRename = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuOpen(false);
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 50);
  }, []);

  const handleFinishRename = useCallback(async () => {
    const trimmed = name.trim();
    if (!trimmed || trimmed === project.name) {
      setName(project.name);
      setEditing(false);
      return;
    }
    setSaving(true);
    await onRename(project.id, trimmed);
    setSaving(false);
    setEditing(false);
  }, [name, project.id, project.name, onRename]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); inputRef.current?.blur(); }
    if (e.key === 'Escape') { setName(project.name); setEditing(false); }
  }, [project.name]);

  return (
    <div className="group relative bg-daw-panel border border-daw-border rounded-xl overflow-hidden hover:border-gray-500 transition-all hover:shadow-lg cursor-pointer">
      {/* Clickable area */}
      <div onClick={handleOpen}>
        {/* Thumbnail */}
        <div className={`h-40 bg-gradient-to-br ${gradient} border-b border-daw-border flex items-center justify-center relative`}>
          <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-sm flex items-center justify-center">
            <span className="text-2xl font-bold text-white/80">{initials}</span>
          </div>
          <div className="absolute bottom-2 right-2">
            <span className="text-xs bg-black/40 text-gray-300 px-2 py-0.5 rounded-full backdrop-blur-sm">
              {project.tempo} BPM
            </span>
          </div>
        </div>

        {/* Info */}
        <div className="p-4">
          {editing ? (
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={handleFinishRename}
              onKeyDown={handleKeyDown}
              className="w-full bg-daw-surface border border-daw-primary rounded px-2 py-1 text-white text-sm font-semibold focus:outline-none"
              autoFocus
            />
          ) : (
            <h3 className="text-white font-semibold text-sm truncate group-hover:text-daw-primary transition-colors">
              {project.name}
            </h3>
          )}

          <p className="text-gray-500 text-xs mt-1.5">
            Edited {formatTimeAgo(project.updatedAt)}
          </p>
          {saving && (
            <Loader2 className="w-3 h-3 animate-spin text-daw-primary mt-1" />
          )}
        </div>
      </div>

      {/* Menu button */}
      <button
        onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
        className="absolute top-2 right-2 w-7 h-7 rounded-lg bg-black/40 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition hover:bg-black/60"
      >
        <MoreHorizontal className="w-4 h-4 text-white" />
      </button>

      {/* Dropdown */}
      {menuOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
          <div className="absolute top-10 right-2 z-50 bg-daw-panel border border-daw-border rounded-lg shadow-xl py-1 w-36">
            <button
              onClick={handleStartRename}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-daw-surface transition"
            >
              <Pencil className="w-3.5 h-3.5" />
              Rename
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onDelete(project.id); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-900/20 transition"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete
            </button>
          </div>
        </>
      )}
    </div>
  );
}
