'use client';

/**
 * Clip Context Menu - Right-click menu for clip operations
 * 
 * Provides:
 * - Split at playhead
 * - Duplicate
 * - Delete
 * - Reverse
 * - Normalize
 * - Rename
 * - Mute/Unmute
 * - Cut/Copy/Paste
 */

import React, { useCallback, useEffect, useRef } from 'react';
import {
  Scissors,
  Copy,
  Trash2,
  RotateCcw,
  Volume2,
  VolumeX,
  Edit3,
  Activity,
  Type,
  Link,
  Lock,
  Unlock,
  Music,
  Palette,
} from 'lucide-react';
import { Clip, ContextMenuItem } from '../engine/timeline/types';
import { useProjectStore } from '@/store/projectStore';
import { generateDrummerPattern, DEFAULT_DRUMMER_SETTINGS } from '@/lib/drummerPattern';

// =============================================================================
// Props
// =============================================================================

interface ClipContextMenuProps {
  visible: boolean;
  x: number;
  y: number;
  clipId: string | null;
  clip?: Clip;
  playheadBeat: number;
  onSplit: (clipId: string, splitTime: number) => void;
  onDuplicate: (clipId: string) => void;
  onDelete: (clipId: string) => void;
  onReverse: (clipId: string) => void;
  onNormalize: (clipId: string) => void;
  onRename: (clipId: string) => void;
  onToggleMute: (clipId: string) => void;
  onSetColor: (clipId: string, color: string) => void;
  onLock: (clipId: string) => void;
  onUnlock: (clipId: string) => void;
  onClose: () => void;
}

// =============================================================================
// Component
// =============================================================================

export function ClipContextMenu({
  visible,
  x,
  y,
  clipId,
  clip,
  playheadBeat,
  onSplit,
  onDuplicate,
  onDelete,
  onReverse,
  onNormalize,
  onRename,
  onToggleMute,
  onSetColor,
  onLock,
  onUnlock,
  onClose,
}: ClipContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!visible) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [visible, onClose]);

  // Position adjustment to keep menu in viewport
  const adjustedPosition = useCallback(() => {
    if (typeof window === 'undefined') return { x, y };

    const menuWidth = 220;
    const menuHeight = 400;
    const padding = 10;

    let adjustedX = x;
    let adjustedY = y;

    // Adjust horizontal position
    if (x + menuWidth > window.innerWidth - padding) {
      adjustedX = x - menuWidth;
    }

    // Adjust vertical position
    if (y + menuHeight > window.innerHeight - padding) {
      adjustedY = y - menuHeight;
    }

    return { x: Math.max(padding, adjustedX), y: Math.max(padding, adjustedY) };
  }, [x, y]);

  const pos = adjustedPosition();

  // Check if playhead is within clip
  const canSplit = clip ? 
    playheadBeat > clip.startTime && playheadBeat < clip.startTime + clip.duration 
    : false;

  // Handle menu item click
  /*
   * Which of the two Convert rows applies here.
   *
   * A Session Player region is one carrying `drummerSettings` — the settings
   * are what make it regenerate, so dropping them is the whole conversion. A
   * plain MIDI region on a drummer track is the one that can be handed back.
   */
  const drummerTrack = useProjectStore(s =>
    s.tracks.some(t => t.id === clip?.trackId && t.type === 'drummer'));
  const isSessionPlayerRegion = !!(clip as any)?.drummerSettings;
  const isDrummerMidiRegion = drummerTrack && !isSessionPlayerRegion
    && (clip as any)?.type === 'midi';

  const handleItemClick = useCallback((action: string) => {
    if (!clipId) return;

    switch (action) {
      /*
       * The manual: a Session Player region cannot have its individual notes
       * edited in the editor, so converting it to a plain MIDI region is how
       * you get at them. All this does is drop `drummerSettings` — the notes
       * are already there — which is precisely what makes it a MIDI region:
       * nothing regenerates over the top of your edits any more.
       */
      case 'convertToMidi':
        useProjectStore.getState().updateClip(clipId, {
          drummerSettings: undefined,
          name: (clip?.name ?? 'Drummer').replace(/^Drummer\b/, 'MIDI Region'),
        } as never);
        onClose();
        return;

      /*
       * And back again. The manual is explicit that this does not preserve
       * MIDI edits, and it cannot: the settings are the score and the notes
       * are the render, so handing the region back to the player means the
       * player writes the notes.
       */
      case 'replaceWithSessionPlayer': {
        const st = useProjectStore.getState();
        const beatsPerBar = Number(st.timeSignature?.split('/')[0]) || 4;
        const bars = Math.max(1, Math.round((clip?.duration || beatsPerBar) / beatsPerBar));
        const notes = generateDrummerPattern(DEFAULT_DRUMMER_SETTINGS, {
          bars, beatsPerBar, tempo: st.tempo,
        }).map((n, i) => ({
          id: `drum-${clipId}-${i}`,
          pitch: n.pitch,
          start: n.start,
          duration: n.duration,
          velocity: Math.round(n.velocity * 127),
        }));
        st.updateClip(clipId, {
          drummerSettings: DEFAULT_DRUMMER_SETTINGS, notes, name: 'Drummer',
        } as never);
        onClose();
        return;
      }

      case 'split':
        if (canSplit && clip) {
          onSplit(clipId, playheadBeat);
        }
        break;
      case 'duplicate':
        onDuplicate(clipId);
        break;
      case 'delete':
        onDelete(clipId);
        break;
      case 'reverse':
        onReverse(clipId);
        break;
      case 'normalize':
        onNormalize(clipId);
        break;
      case 'rename':
        onRename(clipId);
        break;
      case 'mute':
        onToggleMute(clipId);
        break;
      case 'lock':
        onLock(clipId);
        break;
      case 'unlock':
        onUnlock(clipId);
        break;
    }

    onClose();
  }, [clipId, canSplit, clip, playheadBeat, onSplit, onDuplicate, onDelete, onReverse, onNormalize, onRename, onToggleMute, onLock, onUnlock, onClose]);

  // Color options
  const colors = [
    { name: 'Blue', value: '#3B82F6' },
    { name: 'Green', value: '#10B981' },
    { name: 'Yellow', value: '#F59E0B' },
    { name: 'Red', value: '#EF4444' },
    { name: 'Purple', value: '#8B5CF6' },
    { name: 'Pink', value: '#EC4899' },
    { name: 'Cyan', value: '#06B6D4' },
    { name: 'Orange', value: '#F97316' },
  ];

  if (!visible || !clipId) return null;

  return (
    <div
      ref={menuRef}
      className="fixed z-[9999] bg-[#1a1a1a] border border-gray-700 rounded-lg shadow-2xl overflow-hidden min-w-[200px] select-none"
      style={{ left: pos.x, top: pos.y }}
    >
      {/* Header - Clip name */}
      <div className="px-3 py-2 bg-[#252525] border-b border-gray-700">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          {clip?.name ?? 'Clip'}
        </span>
      </div>

      {/* Menu items */}
      <div className="py-1">
        {/* Split */}
        <button
          className={`w-full px-3 py-2 flex items-center gap-2 text-left text-sm transition-colors ${
            canSplit 
              ? 'text-white hover:bg-blue-600' 
              : 'text-gray-500 cursor-not-allowed'
          }`}
          onClick={() => handleItemClick('split')}
          disabled={!canSplit}
        >
          <Scissors className="w-4 h-4" />
          <span>Split at Playhead</span>
          <span className="ml-auto text-xs text-gray-500">⌘+E</span>
        </button>

        {/* Convert — only offered on the kind of region it applies to. */}
        {isSessionPlayerRegion && (
          <button
            data-clip-convert-midi
            className="w-full px-3 py-2 flex items-center gap-2 text-left text-sm text-white hover:bg-blue-600 transition-colors"
            title="Drop the Session Player and keep the notes, so you can edit them in the piano roll"
            onClick={() => handleItemClick('convertToMidi')}
          >
            <Music className="w-4 h-4" />
            <span>Convert to MIDI Region</span>
          </button>
        )}
        {isDrummerMidiRegion && (
          <button
            data-clip-replace-session
            className="w-full px-3 py-2 flex items-center gap-2 text-left text-sm text-white hover:bg-blue-600 transition-colors"
            title="Hand the region back to the Session Player. Any note edits are lost — the player writes the notes."
            onClick={() => handleItemClick('replaceWithSessionPlayer')}
          >
            <Music className="w-4 h-4" />
            <span>Replace with Session Player Region</span>
          </button>
        )}

        {/* Duplicate */}
        <button
          className="w-full px-3 py-2 flex items-center gap-2 text-left text-sm text-white hover:bg-blue-600 transition-colors"
          onClick={() => handleItemClick('duplicate')}
        >
          <Copy className="w-4 h-4" />
          <span>Duplicate</span>
          <span className="ml-auto text-xs text-gray-500">⌘+D</span>
        </button>

        <div className="my-1 border-t border-gray-700" />

        {/* Reverse */}
        <button
          className="w-full px-3 py-2 flex items-center gap-2 text-left text-sm text-white hover:bg-blue-600 transition-colors"
          onClick={() => handleItemClick('reverse')}
        >
          <RotateCcw className="w-4 h-4" />
          <span>Reverse</span>
        </button>

        {/* Normalize */}
        <button
          className="w-full px-3 py-2 flex items-center gap-2 text-left text-sm text-white hover:bg-blue-600 transition-colors"
          onClick={() => handleItemClick('normalize')}
        >
          <Activity className="w-4 h-4" />
          <span>Normalize</span>
        </button>

        <div className="my-1 border-t border-gray-700" />

        {/* Mute/Unmute */}
        <button
          className="w-full px-3 py-2 flex items-center gap-2 text-left text-sm text-white hover:bg-blue-600 transition-colors"
          onClick={() => handleItemClick('mute')}
        >
          {clip?.muted ? (
            <>
              <Volume2 className="w-4 h-4" />
              <span>Unmute</span>
            </>
          ) : (
            <>
              <VolumeX className="w-4 h-4" />
              <span>Mute</span>
            </>
          )}
        </button>

        {/* Rename */}
        <button
          className="w-full px-3 py-2 flex items-center gap-2 text-left text-sm text-white hover:bg-blue-600 transition-colors"
          onClick={() => handleItemClick('rename')}
        >
          <Edit3 className="w-4 h-4" />
          <span>Rename</span>
          <span className="ml-auto text-xs text-gray-500">F2</span>
        </button>

        <div className="my-1 border-t border-gray-700" />

        {/* Color picker */}
        <div className="px-3 py-2">
          <div className="flex items-center gap-2 mb-2">
            <Palette className="w-4 h-4 text-gray-400" />
            <span className="text-xs text-gray-400">Color</span>
          </div>
          <div className="grid grid-cols-4 gap-1">
            {colors.map((color) => (
              <button
                key={color.value}
                className="w-8 h-6 rounded hover:scale-110 transition-transform"
                style={{ backgroundColor: color.value }}
                onClick={() => {
                  onSetColor(clipId, color.value);
                  onClose();
                }}
                title={color.name}
              />
            ))}
          </div>
        </div>

        <div className="my-1 border-t border-gray-700" />

        {/* Lock/Unlock */}
        <button
          className="w-full px-3 py-2 flex items-center gap-2 text-left text-sm text-white hover:bg-blue-600 transition-colors"
          onClick={() => handleItemClick(clip && (clip as any).isLocked ? 'unlock' : 'lock')}
        >
          {clip && (clip as any).isLocked ? (
            <>
              <Unlock className="w-4 h-4" />
              <span>Unlock</span>
            </>
          ) : (
            <>
              <Lock className="w-4 h-4" />
              <span>Lock</span>
            </>
          )}
        </button>

        <div className="my-1 border-t border-gray-700" />

        {/* Delete */}
        <button
          className="w-full px-3 py-2 flex items-center gap-2 text-left text-sm text-red-400 hover:bg-red-900/50 transition-colors"
          onClick={() => handleItemClick('delete')}
        >
          <Trash2 className="w-4 h-4" />
          <span>Delete</span>
          <span className="ml-auto text-xs text-gray-500">Del</span>
        </button>
      </div>

      {/* Footer info */}
      <div className="px-3 py-2 bg-[#252525] border-t border-gray-700 text-xs text-gray-500">
        <div className="flex justify-between">
          <span>Start: {clip?.startTime?.toFixed(2)}b</span>
          <span>Dur: {clip?.duration?.toFixed(2)}b</span>
        </div>
          {(clip as any)?.playbackRate !== 1 && clip && (
          <div className="mt-1 text-yellow-400">
            Rate: {(clip as any).playbackRate.toFixed(2)}x
          </div>
        )}
      </div>
    </div>
  );
}

export default ClipContextMenu;
