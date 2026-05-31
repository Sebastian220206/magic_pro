"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Play, Square, RotateCcw, Music, Loader2, Share2 } from "lucide-react";
import { audioEngine } from "@/engine/AudioEngineAdapter";

interface NoteData {
  pitch: number;
  velocity: number;
  start: number;
  duration: number;
}

interface ClipData {
  id: string;
  type: string;
  name: string;
  start: number;
  startBeat?: number;
  duration: number;
  color: string;
  fileUrl?: string | null;
  notes?: NoteData[];
}

interface TrackData {
  id: string;
  name: string;
  type: string;
  volume: number;
  pan: number;
  muted: boolean;
  color: string;
  clips: ClipData[];
}

interface ProjectSnapshot {
  id: string;
  name: string;
  tempo: number;
  timeSignature: string;
  keySignature: string;
  tracks: TrackData[];
  createdAt: string;
  updatedAt: string;
}

export default function PublicProjectPage({
  params,
}: {
  params: { shareId: string };
}) {
  const [project, setProject] = useState<ProjectSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [playing, setPlaying] = useState(false);
  const [playhead, setPlayhead] = useState(0);
  const [copied, setCopied] = useState(false);
  const schedulerRef = useRef<number | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    fetch(`/api/public/${params.shareId}`)
      .then((r) => {
        if (!r.ok) throw new Error("Project not found");
        return r.json();
      })
      .then((data) => {
        setProject(data);
        setLoading(false);
      })
      .catch(() => {
        setError("Project not found or is private");
        setLoading(false);
      });
  }, [params.shareId]);

  useEffect(() => {
    audioEngine.init().catch((e: any) => console.error('[SharePage] Audio init failed:', e));
    return () => {
      if (schedulerRef.current) cancelAnimationFrame(schedulerRef.current);
      audioEngine.stop();
    };
  }, []);

  const togglePlay = useCallback(async () => {
    if (playing) {
      audioEngine.stop();
      setPlaying(false);
      if (schedulerRef.current) cancelAnimationFrame(schedulerRef.current);
      return;
    }

    const ctx = audioEngine.getContext();
    if (ctx?.state === "suspended") await ctx.resume();
    ctxRef.current = ctx;

    if (project) {
      audioEngine.setTempo(project.tempo);

      const clips = project.tracks.flatMap((t) =>
        t.clips.map((c) => ({
          id: c.id,
          trackId: t.id,
          type: c.type as "audio" | "midi",
          name: c.name,
          startBeat: c.start,
          duration: c.duration,
          color: c.color,
          muted: t.muted || false,
          fileUrl: c.fileUrl || undefined,
          notes: (c.notes || []).map((n) => ({
            id: `note-${n.pitch}-${n.start}`,
            pitch: n.pitch,
            velocity: n.velocity,
            start: n.start,
            duration: n.duration,
          })),
        }))
      );

      const tracks = project.tracks.map((t) => ({
        id: t.id,
        name: t.name,
        volume: t.volume,
        pan: t.pan,
        muted: t.muted,
        type: t.type as "audio" | "midi",
      }));

      audioEngine.play(clips as any, tracks as any, 0, project.tempo);
    }

    setPlaying(true);

    const startTime = ctx?.currentTime || 0;
    const tick = () => {
      const elapsed = (ctx?.currentTime || 0) - startTime;
      const beats = elapsed * (project!.tempo / 60);
      setPlayhead(beats);
      schedulerRef.current = requestAnimationFrame(tick);
    };
    schedulerRef.current = requestAnimationFrame(tick);
  }, [playing, project]);

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-daw-bg text-gray-400">
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
        Loading project...
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-daw-bg text-gray-400 gap-4">
        <Music className="w-16 h-16 opacity-20" />
        <h1 className="text-xl font-bold text-white">{error || "Project not found"}</h1>
        <p className="text-sm text-gray-500">This shared project may have been made private or deleted.</p>
      </div>
    );
  }

  const totalBeats = Math.max(
    ...project.tracks.flatMap((t) =>
      t.clips.map((c) => c.start + c.duration)
    ),
    16
  );

  return (
    <div className="min-h-screen bg-daw-bg flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-daw-border">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-daw-primary/20 flex items-center justify-center">
            <Music className="w-4 h-4 text-daw-primary" />
          </div>
          <h1 className="text-white font-semibold text-sm">{project.name}</h1>
          <span className="text-xs text-gray-500 bg-daw-surface px-2 py-0.5 rounded">
            {project.tempo} BPM
          </span>
          <span className="text-xs text-gray-500">Read-only</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={copyLink}
            className="flex items-center gap-2 text-xs text-gray-400 hover:text-white bg-daw-surface hover:bg-daw-panel px-3 py-1.5 rounded-lg transition"
          >
            <Share2 className="w-3.5 h-3.5" />
            {copied ? "Copied!" : "Copy Link"}
          </button>
        </div>
      </header>

      {/* Transport */}
      <div className="flex items-center justify-center gap-4 px-6 py-3 border-b border-daw-border bg-daw-panel/50">
        <button
          onClick={togglePlay}
          className="w-10 h-10 rounded-full bg-daw-primary flex items-center justify-center hover:bg-blue-600 transition shadow-lg shadow-daw-primary/20"
        >
          {playing ? (
            <Square className="w-4 h-4 text-white" />
          ) : (
            <Play className="w-4 h-4 text-white ml-0.5" />
          )}
        </button>

        <div className="text-white font-mono text-sm tabular-nums">
          0:{Math.floor(playhead)}.{String(Math.floor((playhead % 1) * 10)).padStart(1, "0")}
        </div>

        <button
          onClick={() => { setPlayhead(0); audioEngine.stop(); setPlaying(false); }}
          className="text-gray-400 hover:text-white transition p-1"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>

      {/* Tracks */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2 max-w-4xl mx-auto w-full">
        {project.tracks.map((track) => (
          <div
            key={track.id}
            className="bg-daw-panel border border-daw-border rounded-lg overflow-hidden"
          >
            {/* Track header */}
            <div className="flex items-center gap-3 px-4 py-2 border-b border-daw-border bg-daw-surface/50">
              <div
                className="w-3 h-3 rounded-sm shrink-0"
                style={{ backgroundColor: track.color }}
              />
              <span className="text-white text-sm font-medium">{track.name}</span>
              <span className="text-xs text-gray-500">{track.type}</span>
              {track.muted && (
                <span className="text-xs text-red-400 ml-auto">Muted</span>
              )}
            </div>

            {/* Clips */}
            <div className="relative overflow-x-auto" style={{ minHeight: 48 }}>
              <div
                className="relative"
                style={{
                  width: `${Math.max(totalBeats, 16) * 48}px`,
                  minHeight: 48,
                }}
              >
                {/* Beat grid */}
                {Array.from({ length: Math.ceil(totalBeats) }, (_, i) => (
                  <div
                    key={i}
                    className="absolute top-0 bottom-0 border-l border-daw-border/30"
                    style={{ left: i * 48 }}
                  />
                ))}

                {/* Playhead */}
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-daw-primary z-10 transition-none pointer-events-none"
                  style={{ left: playhead * 48 }}
                />

                {/* Clip blocks */}
                {track.clips.map((clip) => (
                  <div
                    key={clip.id}
                    className="absolute top-1 bottom-1 rounded-md px-2 py-1 flex flex-col justify-center overflow-hidden"
                    style={{
                      left: (clip.startBeat ?? clip.start ?? 0) * 48,
                      width: Math.max(clip.duration * 48, 8),
                      backgroundColor: clip.color + "40",
                      borderLeft: `3px solid ${clip.color}`,
                    }}
                  >
                    <span className="text-white text-xs font-medium truncate">
                      {clip.name}
                    </span>
                    <span className="text-gray-500 text-[10px]">
                      {clip.type} · {clip.duration.toFixed(1)} beats
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <footer className="text-center py-3 text-xs text-gray-600 border-t border-daw-border">
        Shared via Magic Pro · Read-only view
      </footer>
    </div>
  );
}
