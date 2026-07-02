'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { VideoEngine } from '@/engine/video';
import type { VideoPlaybackState } from '@/engine/video';
import type { Clip } from '@/models/Clip';
import { Play, Pause, Volume2, VolumeX, Maximize2 } from 'lucide-react';

interface VideoTrackProps {
  clip: Clip;
  projectBpm?: number;
  projectPlayhead?: number;
  isPlaying?: boolean;
  onTimeUpdate?: (time: number) => void;
}

export function VideoTrack({
  clip,
  projectBpm = 120,
  projectPlayhead = 0,
  isPlaying = false,
  onTimeUpdate,
}: VideoTrackProps) {
  const engineRef = useRef<VideoEngine | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<VideoPlaybackState>({
    playing: false, currentTime: 0, duration: 0,
    volume: 1, muted: false, loop: false,
  });
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    const engine = new VideoEngine();
    engineRef.current = engine;

    if (clip.videoUrl) {
      engine.loadClip(clip)
        .then(() => setLoaded(true))
        .catch((err) => setError(err.message));

      engine.setSyncOptions({ projectBpm, videoOffsetBeats: clip.start });
    }

    const unsub = engine.subscribe((s) => {
      setState(s);
      onTimeUpdate?.(s.currentTime);
    });

    return () => {
      unsub();
      engine.dispose();
    };
  }, [clip.id, clip.videoUrl]);

  useEffect(() => {
    if (!engineRef.current || clip.type !== 'video') return;
    if (isPlaying) {
      const targetBeat = projectPlayhead;
      engineRef.current.seekToBeat(targetBeat);
      engineRef.current.play();
    } else {
      engineRef.current.pause();
    }
  }, [isPlaying]);

  const togglePlay = useCallback(() => {
    const eng = engineRef.current;
    if (!eng) return;
    state.playing ? eng.pause() : eng.play();
  }, [state.playing]);

  const toggleMute = useCallback(() => {
    const eng = engineRef.current;
    if (!eng) return;
    eng.setMuted(!state.muted);
  }, [state.muted]);

  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const eng = engineRef.current;
    if (!eng) return;
    eng.seek(parseFloat(e.target.value));
  }, []);

  const toggleFullscreen = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen();
      setFullscreen(true);
    } else {
      document.exitFullscreen();
      setFullscreen(false);
    }
  }, []);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  if (error) {
    return (
      <div className="bg-[#1a1a1a] rounded border border-red-900/50 p-4 text-center text-red-400 text-sm">
        Video error: {error}
      </div>
    );
  }

  return (
    <div ref={containerRef} className={`bg-black rounded overflow-hidden border border-gray-800 ${fullscreen ? 'fixed inset-0 z-50' : ''}`}>
      <div className="relative bg-black/90" style={{ aspectRatio: '16/9', maxHeight: 360 }}>
        {loaded && engineRef.current?.video && (
          <>
            <video
              ref={(el) => {
                if (el && engineRef.current?.video) {
                  const vid = engineRef.current.video;
                  el.srcObject = (vid as any).srcObject;
                }
              }}
              className="w-full h-full object-contain"
              playsInline
            />
            <canvas
              ref={(el) => {
                if (el && engineRef.current?.video) {
                  const vid = engineRef.current.video;
                  el.getContext('2d')?.drawImage(vid, 0, 0, el.width, el.height);
                }
              }}
              className="hidden"
            />
          </>
        )}
        {!loaded && (
          <div className="flex items-center justify-center h-full text-gray-600 text-sm">
            Loading video...
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 px-3 py-1.5 bg-[#111] border-t border-gray-800">
        <button onClick={togglePlay} className="text-gray-400 hover:text-white transition-colors p-0.5" title={state.playing ? 'Pause' : 'Play'}>
          {state.playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
        </button>

        <span className="text-[10px] font-mono text-gray-500 w-14 tabular-nums">
          {formatTime(state.currentTime)}
        </span>

        <input
          type="range"
          min={0}
          max={state.duration || 1}
          value={state.currentTime}
          step={0.01}
          onChange={handleSeek}
          className="flex-1 accent-amber-500 h-1 cursor-pointer"
        />

        <span className="text-[10px] font-mono text-gray-500 w-14 tabular-nums text-right">
          {formatTime(state.duration)}
        </span>

        <button onClick={toggleMute} className="text-gray-400 hover:text-white transition-colors p-0.5" title={state.muted ? 'Unmute' : 'Mute'}>
          {state.muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
        </button>

        <button onClick={toggleFullscreen} className="text-gray-400 hover:text-white transition-colors p-0.5" title="Fullscreen">
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
