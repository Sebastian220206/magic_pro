'use client';

import React, { useRef, useEffect, useState, useCallback, memo, useMemo } from 'react';
import { PianoKeyboard } from './PianoKeyboard';
import { subscribeToActiveNotes } from '@/engine/midi/liveMidiInput';
import { EventEditor } from './EventEditor';
import { GoToBeatDialog } from './GoToBeatDialog';
import { LocateNoteDialog } from './LocateNoteDialog';
import { useMidiStore } from '../../store/midiStore';
import { useProjectStore } from '../../store/projectStore';
import { MidiRecorder } from '../../engine/midi/MidiRecorder';
import { PianoRollTool, ScaleType, getScalePitches, pitchToNoteName } from '../../engine/midi/types';
import { pianoRollNavigation } from '../../engine/navigation/NavigationEngine';
import { PianoRollLinkMode } from '../../engine/pianoRoll/projectSync';
import { RendererScheduler } from '../../engine/rendering/contracts/RendererScheduler';
import { PitchGridRenderer } from '../../engine/midi/grid/PitchGridRenderer';
import { MidiRenderer } from '../../engine/midi/MidiRenderer';
import { globalSpatialNoteCache } from '../../engine/midi/cache/SpatialNoteCache';
import StepInputKeyboard from './StepInputKeyboard';
import { StepSequencer } from './StepSequencer';
import NoteEditPopover from './NoteEditPopover';
import { detectChord, pitchToNoteName as chordPitchToNoteName } from '../../engine/midi/chordDetection';
import { ChevronDown, ChevronRight, Link as LinkIcon, MousePointer2, Pencil, LogIn, LogOut, ArrowRightToLine, ZoomIn, ZoomOut, ArrowUpDown, Maximize2, Search, Circle, GitMerge, Repeat, KeyboardMusic, FoldHorizontal, Play, SkipBack, Palette, Eraser, Hand, Scissors, VolumeX, Activity, Paintbrush, Check } from 'lucide-react';

type PianoRollTab = 'piano-roll' | 'score' | 'step-sequencer' | 'smart-tempo';
type DropdownMenu = 'edit' | 'functions' | 'view' | 'tool' | null;

interface PianoRollProps {
  clipId: string;
  width?: number;
  height?: number;
  onNoteOn?: (pitch: number) => void;
  onNoteOff?: (pitch: number) => void;
  linkMode?: PianoRollLinkMode;
  onLinkModeChange?: (mode: PianoRollLinkMode) => void;
}

const KEYBOARD_WIDTH = 60;
const SPLITTER_H = 8;

const pianoRollScheduler = new RendererScheduler();

export const PianoRoll = memo(function PianoRoll({
  clipId,
  width: propWidth,
  height: propHeight,
  onNoteOn,
  onNoteOff,
  linkMode = 'single',
  onLinkModeChange,
}: PianoRollProps) {
  const canvasRef      = useRef<HTMLCanvasElement>(null);
  const rulerCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef   = useRef<HTMLDivElement>(null);

  // Recorder ref
  const recorderRef = useRef<MidiRecorder | null>(null);

  // Note drag refs
  const isDraggingRef  = useRef(false);
  const dragNoteIdRef  = useRef<string | null>(null);

  // Lasso state
  const [lassoSelection, setLassoSelection] = useState<{
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
  } | null>(null);
  const [lassoStartBeat, setLassoStartBeat] = useState<number>(0);
  const [lassoEndBeat, setLassoEndBeat] = useState<number>(0);

  const [containerSize, setContainerSize]     = useState({ width: 800, height: 384 });
  const [splitterOffset, setSplitterOffset] = useState(0);

  // ── UI state ─────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<PianoRollTab>('piano-roll');
  const [openDropdown, setOpenDropdown] = useState<DropdownMenu>(null);
  const [inspectorVelocity, setInspectorVelocity] = useState(100);

  // Close dropdown on outside click
  useEffect(() => {
    if (!openDropdown) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-dropdown]')) {
        setOpenDropdown(null);
      }
    };
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, [openDropdown]);

  // ── Container resize observer ──────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width: w, height: h } = entry.contentRect;
        if (w > 0 && h > 0) setContainerSize({ width: Math.round(w), height: Math.round(h) });
      }
    });
    ro.observe(el);
    const rect = el.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0)
      setContainerSize({ width: Math.round(rect.width), height: Math.round(rect.height) });
    return () => ro.disconnect();
  }, []);

  const width  = propWidth  ?? containerSize.width;
  const height = propHeight ?? containerSize.height;

  // ── Recorder cleanup on unmount ────────────────────────────────────────
  useEffect(() => {
    return () => {
      recorderRef.current?.dispose();
      recorderRef.current = null;
    };
  }, []);

  // ── Store ──────────────────────────────────────────────────────────────
  const [showGoToBeatDialog, setShowGoToBeatDialog] = useState(false);
  const [showLocateNoteDialog, setShowLocateNoteDialog] = useState(false);
  const [showStepKeyboard, setShowStepKeyboard] = useState(false);
  const [editPopoverNote, setEditPopoverNote] = useState<{ note: any; position: { x: number; y: number } } | null>(null);

  const timeSignature = useProjectStore(state => state.timeSignature);
  const [num, den] = timeSignature.split('/').map(Number);
  const beatsPerBar = num;
  const beatUnit = den;

  const {
    currentClipId,
    currentBeat,
    currentTool,
    gridSettings,
    selectedNoteIds,
    isPlaying,
    showVelocityLane,
    openClip,
    setTool,
    setGridDivision,
    toggleSnapToGrid,
    toggleVelocityLane,
    quantizeSelected,
    setSelectedNotesVelocity,
    getCurrentClip,
    undo,
    redo,
    undoStack,
    redoStack,
    activeChannel,
    channelFilter,
    slideMode,
    portaMode,
    setActiveChannel,
    setChannelFilter,
    setSlideMode,
    setPortaMode,
    addNote,
    selectNote,
    selectNotesById,
    deselectAllNotes,
    deleteNote,
    startDrag,
    updateDrag,
    endDrag,
    hitTest,
    splitNote,
    joinNotes,
    isRecording,
    mergeMode,
    setIsRecording,
    setMergeMode,
    recordNote,
    loopStart,
    loopEnd,
    loopEnabled,
    setLoopStart,
    setLoopEnd,
    setLoopEnabled,
    setLoopRange,
    setCurrentBeat,
    snapBeatToGrid,
    setDrawDuration,
    drawDuration,
    toggleStepInput,
    stepInputEnabled,
    swing,
    scaleKey,
    scaleType,
    scaleQuantizeEnabled,
    setSwing,
    setScaleKey,
    setScaleType,
    setScaleQuantizeEnabled,
    scaleQuantizeSelected,
    zoomToSelection,
    seekToBeat,
    scrollToBeat,
    showFoldMode,
    toggleFoldMode,
    showRulerSeconds,
    toggleRulerSeconds,
    play,
    stop,
    autoScrollEnabled,
    toggleAutoScroll,
    midiOutEnabled,
    toggleMidiOut,
    colorMode,
    setColorMode,
    muteSelectedNotes,
    unmuteSelectedNotes,
    setSelectedNotesArticulation,
  } = useMidiStore();

  useEffect(() => {
    if (clipId && clipId !== currentClipId) openClip(clipId);
  }, [clipId, currentClipId, openClip]);

  const clip = getCurrentClip();

  // ── Computed playhead position ────────────────────────────────────────────
  const playheadText = useMemo(() => {
    const tempo = useMidiStore.getState().tempo || 120;
    const [tsNum, tsDen] = timeSignature.split('/').map(Number);
    const bpb = tsNum || 4;
    const beatInMeasure = currentBeat % bpb;
    const measure = Math.floor(currentBeat / bpb);
    const beat = Math.floor(beatInMeasure);
    const subBeat = Math.round((beatInMeasure - beat) * 4) + 1;
    return `B${measure + 1} ${beat + 1} ${subBeat} 1`;
  }, [currentBeat, timeSignature]);

  // ── Computed layout values ─────────────────────────────────────────────
  const viewportState = pianoRollNavigation.getState();
  const noteMinusOnePos = (viewportState.maxVisiblePitch + 1) * viewportState.pixelsPerPitch;
  const gridHeight    = showVelocityLane
    ? Math.max(40, Math.min(height - 28, noteMinusOnePos + splitterOffset))
    : height;
  const editorHeight  = height - gridHeight - 4;
  const cw            = Math.max(1, width - 180 - KEYBOARD_WIDTH); // 180 is the left Inspector width
  const lowPitch      = Math.max(0,   Math.floor(viewportState.maxVisiblePitch - gridHeight / viewportState.pixelsPerPitch));
  const highPitch     = Math.min(127, Math.ceil(viewportState.maxVisiblePitch));

  // ── Live MIDI input highlighting ────────────────────────────────────────
  //
  // Mirrors the notes currently held on a connected MIDI keyboard so the
  // matching keys light up as they are played.
  const [activeMidiNotes, setActiveMidiNotes] = useState<Set<number>>(() => new Set());

  useEffect(() => subscribeToActiveNotes(setActiveMidiNotes), []);

  // ── Scale highlighting ──────────────────────────────────────────────────
  const highlightedKeys = useMemo(() => {
    const keys = new Set<number>();
    if (!scaleQuantizeEnabled || !clip) return keys;
    for (let p = lowPitch; p <= highPitch; p++) {
      const normalized = p % 12;
      const scalePitches = getScalePitches(scaleKey, scaleType as ScaleType);
      if (scalePitches.some(sp => sp % 12 === normalized)) {
        keys.add(p);
      }
    }
    return keys;
  }, [scaleQuantizeEnabled, scaleKey, scaleType, lowPitch, highPitch, clip]);

  // ── Canvas renderer ────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const gridRenderer = new PitchGridRenderer(ctx);
    const noteRenderer = new MidiRenderer(ctx);
    pianoRollScheduler.register(gridRenderer);
    pianoRollScheduler.register(noteRenderer);

    const dpr = window.devicePixelRatio || 1;
    // cw is already correctly computed with -180 - KEYBOARD_WIDTH
    const ch  = gridHeight;

    canvas.width  = cw * dpr;
    canvas.height = ch * dpr;
    ctx.scale(dpr, dpr);

    const renderCanvas = () => {
      const state    = useMidiStore.getState();
      const clipData = state.getCurrentClip();
      if (clipData?.notes) globalSpatialNoteCache.buildCache(clipData.notes);

      const vs = pianoRollNavigation.getState();
      ctx.clearRect(0, 0, cw, ch);

      // Sync grid settings to the renderer
      const projectState = useProjectStore.getState();
      const timeSignature = projectState.timeSignature || '4/4';
      const [tsNum] = timeSignature.split('/').map(Number);
      gridRenderer.gridDivision = state.gridSettings?.division || 4;
      gridRenderer.beatsPerBar = tsNum || 4;

      gridRenderer.renderFull(ctx, vs);
      noteRenderer.renderFull(ctx, vs);

      const beatsPerBar = tsNum || 4;
      const den = parseInt(timeSignature.split('/')[1]) || 4;

      if (lassoSelection && currentTool === 'select') {
        const lx = Math.min(lassoSelection.startX, lassoSelection.currentX);
        const ly = Math.min(lassoSelection.startY, lassoSelection.currentY);
        const lw = Math.abs(lassoSelection.currentX - lassoSelection.startX);
        const lh = Math.abs(lassoSelection.currentY - lassoSelection.startY);
        ctx.strokeStyle = 'rgba(59, 130, 246, 0.8)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(lx, ly, lw, lh);
        ctx.fillStyle = 'rgba(59, 130, 246, 0.1)';
        ctx.fillRect(lx, ly, lw, lh);
        ctx.setLineDash([]);
      }

      // Main Grid Loop Shaded Overlay
      if (state.loopEnabled && state.loopEnd > state.loopStart) {
        const lX1 = (state.loopStart - vs.startBeat) * vs.pixelsPerBeat;
        const lX2 = (state.loopEnd - vs.startBeat) * vs.pixelsPerBeat;
        const rW = lX2 - lX1;

        ctx.fillStyle = 'rgba(34, 197, 94, 0.08)';
        ctx.fillRect(Math.max(0, lX1), 0, Math.min(cw, lX2) - Math.max(0, lX1), ch);

        ctx.strokeStyle = 'rgba(34, 197, 94, 0.4)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        if (lX1 >= 0 && lX1 <= cw) {
          ctx.beginPath(); ctx.moveTo(lX1, 0); ctx.lineTo(lX1, ch); ctx.stroke();
        }
        if (lX2 >= 0 && lX2 <= cw) {
          ctx.beginPath(); ctx.moveTo(lX2, 0); ctx.lineTo(lX2, ch); ctx.stroke();
        }
        ctx.setLineDash([]);
      }

      // Ruler drawing
      const rCanvas = rulerCanvasRef.current;
      if (rCanvas) {
        const rCtx = rCanvas.getContext('2d');
        if (rCtx) {
          // Setup ruler canvas resolution (do this once per render frame to match container)
          rCanvas.width = cw * dpr;
          rCanvas.height = 24 * dpr;
          rCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
          rCtx.clearRect(0, 0, cw, 24);

          // Background
          rCtx.fillStyle = '#0d141d';
          rCtx.fillRect(0, 0, cw, 24);

          // Render Loop Cycle Bar on Ruler
          if (state.loopEnabled && state.loopEnd > state.loopStart) {
            const lX1 = (state.loopStart - vs.startBeat) * vs.pixelsPerBeat;
            const lX2 = (state.loopEnd - vs.startBeat) * vs.pixelsPerBeat;
            const rWidth = lX2 - lX1;

            rCtx.fillStyle = '#22c55e';
            rCtx.globalAlpha = 0.35;
            rCtx.fillRect(lX1, 0, rWidth, 14);
            rCtx.globalAlpha = 1.0;

            rCtx.fillStyle = '#4ade80';
            rCtx.fillRect(lX1, 0, rWidth, 3);

            // Left handle flag
            if (lX1 >= -10 && lX1 <= cw + 10) {
              rCtx.fillStyle = '#22c55e';
              rCtx.beginPath();
              rCtx.moveTo(lX1, 0);
              rCtx.lineTo(lX1 + 6, 0);
              rCtx.lineTo(lX1, 12);
              rCtx.closePath();
              rCtx.fill();
            }

            // Right handle flag
            if (lX2 >= -10 && lX2 <= cw + 10) {
              rCtx.fillStyle = '#22c55e';
              rCtx.beginPath();
              rCtx.moveTo(lX2, 0);
              rCtx.lineTo(lX2 - 6, 0);
              rCtx.lineTo(lX2, 12);
              rCtx.closePath();
              rCtx.fill();
            }
          }

          const startB = vs.startBeat;
          const pPerBeat = vs.pixelsPerBeat;
          const endB = startB + cw / pPerBeat;

          if (showRulerSeconds) {
            // Seconds display
            const tempo = useMidiStore.getState().tempo || 120;
            const secondsPerBeat = 60 / tempo;
            const startSec = startB * secondsPerBeat;
            const endSec = endB * secondsPerBeat;
            const firstSec = Math.floor(startSec);
            rCtx.fillStyle = '#9db4c6';
            rCtx.font = 'bold 10px sans-serif';
            rCtx.textAlign = 'left';
            rCtx.textBaseline = 'top';
            for (let s = firstSec; s <= endSec; s += 1) {
              const b = s / secondsPerBeat;
              const x = (b - startB) * pPerBeat;
              rCtx.fillStyle = 'rgba(34, 211, 238, 0.20)';
              rCtx.fillRect(Math.floor(x), 0, 1, 24);
              rCtx.fillStyle = '#9db4c6';
              const label = s % 5 === 0 ? `${s}s` : '';
              if (label) rCtx.fillText(label, Math.floor(x) + 4, 4);
            }
          } else {
            // Beat/bar display with per-clip time sig support
            const clipTimeSigs = useMidiStore.getState().getClipTimeSignatures(clipId);
            // Build beat-to-bpb map
            const timeSigMap = new Map<number, number>();
            if (clipTimeSigs && clipTimeSigs.length > 0) {
              for (const ts of clipTimeSigs) {
                timeSigMap.set(ts.beat, ts.numerator);
              }
            }

            rCtx.fillStyle = '#9db4c6';
            rCtx.font = 'bold 10px sans-serif';
            rCtx.textAlign = 'left';
            rCtx.textBaseline = 'top';

            // Determine effective bpb for each bar
            const getEffectiveBpb = (barStartBeat: number): number => {
              let bpb = beatsPerBar;
              for (const [tsBeat, tsNum] of timeSigMap) {
                if (tsBeat <= barStartBeat) bpb = tsNum;
                else break;
              }
              return bpb;
            };

            const firstBar = Math.floor(startB / beatsPerBar) * beatsPerBar;
            let barB = firstBar;
            while (barB <= endB) {
              const bpb = getEffectiveBpb(barB);
              const barNum = Math.floor(barB / bpb);
              const x = (barB - startB) * pPerBeat;
              // Bar line
              rCtx.fillStyle = 'rgba(34, 211, 238, 0.20)';
              rCtx.fillRect(Math.floor(x), 0, 1, 24);
              rCtx.fillStyle = '#9db4c6';
              rCtx.fillText(`${barNum + 1}`, Math.floor(x) + 4, 4);
              // Beat lines within bar
              for (let beat = 1; beat < bpb; beat++) {
                const bx = (barB + beat - startB) * pPerBeat;
                rCtx.fillStyle = '#444';
                rCtx.fillRect(Math.floor(bx), 14, 1, 10);
              }
              // Show time sig label if changed at this beat
              if (timeSigMap.has(barB)) {
                const tsNumerator = timeSigMap.get(barB)!;
                const tsLabel = `${tsNumerator}/${den}`;
                rCtx.fillStyle = '#f59e0b';
                rCtx.font = 'bold 8px sans-serif';
                rCtx.fillText(tsLabel, Math.floor(x) + 4, 14);
                rCtx.font = 'bold 10px sans-serif';
              }
              barB += bpb;
            }

            // Also render beat subdivisions from original grid
            for (let b = firstBar; b <= endB; b += 1) {
              const bpb = getEffectiveBpb(b);
              if (b % bpb !== 0) {
                const x = (b - startB) * pPerBeat;
                // Already drawn beat lines above, skip duplicates
              }
            }
          }
          
          // Ruler Playback cursor
          if (state.isPlaying || state.currentBeat > 0) {
            const cursorX = (state.currentBeat - vs.startBeat) * vs.pixelsPerBeat;
            if (cursorX >= 0 && cursorX <= cw) {
              rCtx.fillStyle = '#e8fbff';
              rCtx.beginPath();
              rCtx.moveTo(cursorX - 4, 0);
              rCtx.lineTo(cursorX + 4, 0);
              rCtx.lineTo(cursorX + 4, 16);
              rCtx.lineTo(cursorX, 24);
              rCtx.lineTo(cursorX - 4, 16);
              rCtx.fill();
            }
          }
        }
      }

      // Playback cursor
      if (state.isPlaying || state.currentBeat > 0) {
        const cursorX = (state.currentBeat - vs.startBeat) * vs.pixelsPerBeat;
        if (cursorX >= 0 && cursorX <= cw) {
          ctx.strokeStyle = '#e8fbff';
          ctx.lineWidth   = 2;
          ctx.shadowColor = '#22d3ee';
          ctx.shadowBlur  = 8;
          ctx.beginPath();
          ctx.moveTo(cursorX, 0);
          ctx.lineTo(cursorX, ch);
          ctx.stroke();
          ctx.shadowBlur = 0;
        }
      }
    };

    renderCanvas();

    const unsubscribeNav = pianoRollNavigation.subscribe(() => {
      const navState  = pianoRollNavigation.getState();
      const currentCh = gridHeight;
      const idealMin  = (currentCh / navState.pixelsPerPitch) - 1;
      const minMax    = Math.min(127, idealMin);
      if (navState.maxVisiblePitch < minMax - 0.001) {
        pianoRollNavigation.setViewport({ maxVisiblePitch: minMax });
        return;
      }
      const midiState = useMidiStore.getState();
      midiState.setZoomLevel({ x: navState.pixelsPerBeat, y: navState.pixelsPerPitch });
      midiState.setScrollPosition({ x: navState.startBeat * navState.pixelsPerBeat, y: (127 - navState.maxVisiblePitch) * navState.pixelsPerPitch });
      renderCanvas();
    });

    const unsubscribeStore = useMidiStore.subscribe(() => renderCanvas());

    return () => { unsubscribeNav(); unsubscribeStore(); };
  }, [width, gridHeight, showVelocityLane, clipId]);

  // ── Auto-scroll to follow the playhead ─────────────────────────────────
  //
  // The beat itself is no longer advanced here. This component used to run its
  // own requestAnimationFrame timer that incremented midiStore.currentBeat,
  // giving the piano roll a second, independent transport — one that never
  // started, because nothing ever set midiStore.isPlaying. The project
  // transport is now mirrored in by ProjectPianoRollAdapter, so this effect
  // only has to keep the viewport following it.
  useEffect(() => {
    if (!isPlaying) return;
    if (!useMidiStore.getState().autoScrollEnabled) return;

    const vs = pianoRollNavigation.getState();
    const cw = width - KEYBOARD_WIDTH;
    const cursorX = (currentBeat - vs.startBeat) * vs.pixelsPerBeat;

    if (cursorX > cw * 0.8 || cursorX < cw * 0.1) {
      pianoRollNavigation.setViewport({
        startBeat: Math.max(0, vs.startBeat + (cursorX - cw * 0.3) / vs.pixelsPerBeat),
      });
    }
  }, [isPlaying, currentBeat, width]);

  // ── Vertical scrollbar ─────────────────────────────────────────────────
  const visiblePitches      = Math.max(1, gridHeight / viewportState.pixelsPerPitch);
  const scrollbarThumbHeight = Math.max(20, (visiblePitches / 128) * gridHeight);
  const maxThumbTop          = Math.max(0, gridHeight - scrollbarThumbHeight);
  const maxPitchScroll       = Math.max(0, 127 - visiblePitches);
  const currentPitchScroll   = 127 - viewportState.maxVisiblePitch;
  const thumbTop             = maxPitchScroll > 0 ? (currentPitchScroll / maxPitchScroll) * maxThumbTop : 0;

  const handleScrollbarDrag = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const startY         = e.clientY;
    const startMaxPitch  = pianoRollNavigation.getState().maxVisiblePitch;
    const onMove = (me: MouseEvent) => {
      if (maxThumbTop <= 0) return;
      const delta      = (me.clientY - startY) / maxThumbTop * maxPitchScroll;
      pianoRollNavigation.setViewport({ maxVisiblePitch: startMaxPitch - delta });
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [maxThumbTop, maxPitchScroll]);

  // ── Keyboard shortcuts ─────────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const isMod = e.metaKey || e.ctrlKey;
      if (!isMod) {
        switch (e.key.toLowerCase()) {
          case 's': setTool('select'); e.preventDefault(); return;
          case 'b': setTool('draw');   e.preventDefault(); return;
          case 'e': setTool('erase');  e.preventDefault(); return;
          case 'v': setTool('velocity'); e.preventDefault(); return;
          case 'l': setTool('lasso');  e.preventDefault(); return;
          case 'm': setTool('mute');  e.preventDefault(); return;
          case 'a': setTool('brush');  e.preventDefault(); return;
          case 'c': setTool('scissors');  e.preventDefault(); return;
          case 'q': quantizeSelected({ gridDivision: gridSettings.division, strength: 1 }); e.preventDefault(); return;
          case 'd': setDrawDuration(0.25); e.preventDefault(); return;
          case 'f': setDrawDuration(0.5); e.preventDefault(); return;
          case 'h': setDrawDuration(2); e.preventDefault(); return;
          case 'x': {
            if (currentClipId && selectedNoteIds.size === 1) {
              splitNote(Array.from(selectedNoteIds)[0], currentBeat);
            }
            e.preventDefault();
            return;
          }
          case 'j': {
            if (currentClipId && selectedNoteIds.size >= 2) {
              joinNotes(Array.from(selectedNoteIds));
            }
            e.preventDefault();
            return;
          }
          case 'r': {
            const s = useMidiStore.getState();
            if (s.isRecording) {
              recorderRef.current?.dispose();
              recorderRef.current = null;
              s.setIsRecording(false);
            } else {
              const clip = s.getCurrentClip();
              if (!clip) return;
              const recorder = new MidiRecorder(
                (note) => s.recordNote(note.pitch, note.startBeat, note.duration, note.velocity),
                () => useMidiStore.getState().currentBeat,
                (active, beat) => useMidiStore.getState().setSustainPedal(active ? 127 : 0),
              );
              recorder.start(clip.durationBeats);
              recorderRef.current = recorder;
              s.setIsRecording(true);
            }
            e.preventDefault();
            return;
          }
        }
        if (e.key === 'Backspace' || e.key === 'Delete') {
          if (selectedNoteIds.size > 0) {
            const s = useMidiStore.getState();
            for (const id of selectedNoteIds) {
              s.deleteNote(id);
            }
            s.deselectAllNotes();
            e.preventDefault();
            return;
          }
        }
      } else {
        if (e.key === 'z' && e.shiftKey)      { redo(); e.preventDefault(); }
        else if (e.key === 'z')                { undo(); e.preventDefault(); }
        else if (e.key === 'g')                { toggleSnapToGrid(); e.preventDefault(); }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setTool, quantizeSelected, gridSettings, undo, redo, toggleSnapToGrid, setDrawDuration, splitNote, joinNotes, selectedNoteIds, currentBeat, currentClipId]);

  // ── Window-level note drag handlers ───────────────────────────────────
  const handleWindowMouseMove = useCallback((e: MouseEvent) => {
    if (!isDraggingRef.current) return;
    updateDrag(e.clientX, e.clientY);
  }, [updateDrag]);

  const handleWindowMouseUp = useCallback(() => {
    if (!isDraggingRef.current) return;
    endDrag();
    isDraggingRef.current = false;
    dragNoteIdRef.current = null;
    window.removeEventListener('mousemove', handleWindowMouseMove);
    window.removeEventListener('mouseup',   handleWindowMouseUp);
  }, [endDrag, handleWindowMouseMove]);

const handleLassoMouseMove = useCallback((e: MouseEvent) => {
    if (!lassoSelection) return;
    const el = canvasRef.current?.parentElement;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const vs = pianoRollNavigation.getState();
    const beat = x / vs.pixelsPerBeat + vs.startBeat;
    setLassoSelection(prev => prev ? { ...prev, currentX: x, currentY: y } : null);
    setLassoEndBeat(beat);
  }, [lassoSelection]);

  const handleLassoMouseUp = useCallback(() => {
    if (!lassoSelection) return;
    const startBeat = Math.min(lassoStartBeat, lassoEndBeat);
    const endBeat = Math.max(lassoStartBeat, lassoEndBeat);
    const startX = Math.min(lassoSelection.startX, lassoSelection.currentX);
    const endX = Math.max(lassoSelection.startX, lassoSelection.currentX);
    if (endX - startX > 5) {
      const vs = pianoRollNavigation.getState();
      const minY = Math.min(lassoSelection.startY, lassoSelection.currentY);
      const maxY = Math.max(lassoSelection.startY, lassoSelection.currentY);
      const highPitch = Math.min(127, Math.floor(vs.maxVisiblePitch - minY / vs.pixelsPerPitch));
      const lowPitch = Math.max(0, Math.floor(vs.maxVisiblePitch - maxY / vs.pixelsPerPitch));
      deselectAllNotes();
      const clipData = getCurrentClip();
      if (clipData?.notes) {
        const selectedIds = clipData.notes
          .filter(n => n.startBeat >= startBeat && n.startBeat <= endBeat && n.pitch >= lowPitch && n.pitch <= highPitch)
          .map(n => n.id);
        if (selectedIds.length > 0) {
          selectNotesById(selectedIds, false);
        }
      }
    } else {
      // Click without dragging: deselect all
      deselectAllNotes();
    }
    setLassoSelection(null);
    window.removeEventListener('mousemove', handleLassoMouseMove);
    window.removeEventListener('mouseup', handleLassoMouseUp);
  }, [lassoSelection, lassoStartBeat, lassoEndBeat, deselectAllNotes, getCurrentClip, selectNotesById]);

  useEffect(() => {
    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup',   handleWindowMouseUp);
      window.removeEventListener('mousemove', handleLassoMouseMove);
      window.removeEventListener('mouseup', handleLassoMouseUp);
    };
  }, [handleWindowMouseMove, handleWindowMouseUp, handleLassoMouseMove, handleLassoMouseUp]);

  const handleCanvasMouseDown = useCallback((e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x    = e.clientX - rect.left;
    const y    = e.clientY - rect.top;
    const vs   = pianoRollNavigation.getState();

    // Right-click: delete note under cursor (works for any tool)
    if (e.button === 2) {
      e.preventDefault();
      e.stopPropagation();
      const beat    = x / vs.pixelsPerBeat + vs.startBeat;
      const pitch   = Math.floor(vs.maxVisiblePitch - y / vs.pixelsPerPitch);
      console.log('[RightClick] x:', x, 'y:', y, 'beat:', beat, 'pitch:', pitch);
      const hit     = hitTest(beat, pitch);
      console.log('[RightClick] hitTest result:', hit);
      if (hit.note) {
        console.log('[RightClick] Deleting note:', hit.note.id);
        deleteNote(hit.note.id);
      } else {
        console.log('[RightClick] No note found at this position');
      }
      return;
    }

    if (e.button !== 0) return;

    if (currentTool === 'draw') {
      const beatPos = x / vs.pixelsPerBeat + vs.startBeat;
      const pitch   = Math.floor(vs.maxVisiblePitch - y / vs.pixelsPerPitch);
      if (pitch < 0 || pitch > 127) return;
      
      const effectiveDrawDuration = 4 / gridSettings.division;
      // Feature 29: Check for overlapping notes before adding
      const clipData = getCurrentClip();
      if (clipData?.notes) {
        const newNoteEnd = beatPos + effectiveDrawDuration;
        const overlappingNote = clipData.notes.find(note => 
          note.pitch === pitch && 
          note.startBeat < newNoteEnd && 
          (note.startBeat + note.duration) > beatPos
        );
        
        if (overlappingNote) {
          // Show a visual warning - could be a toast or console warning
          console.warn(`Note overlap detected at pitch ${pitch} (${pitchToNoteName(pitch)}) around beat ${beatPos.toFixed(2)}`);
          // Still add the note but user is warned
        }
      }
      
      addNote(pitch, beatPos, effectiveDrawDuration);
      onNoteOn?.(pitch);
      window.setTimeout(() => onNoteOff?.(pitch), 300);
      return;
    }

    if (currentTool === 'erase') {
      const beat    = x / vs.pixelsPerBeat + vs.startBeat;
      const pitch   = Math.floor(vs.maxVisiblePitch - y / vs.pixelsPerPitch);
      const hit     = hitTest(beat, pitch);
      if (hit.note) deleteNote(hit.note.id);
      return;
    }

    if (currentTool === 'mute') {
      const beat    = x / vs.pixelsPerBeat + vs.startBeat;
      const pitch   = Math.floor(vs.maxVisiblePitch - y / vs.pixelsPerPitch);
      const hit     = hitTest(beat, pitch);
      if (hit.note) {
        useMidiStore.getState().toggleMuteNote(hit.note.id);
      }
      return;
    }

    if (currentTool === 'brush') {
      const beatPos = x / vs.pixelsPerBeat + vs.startBeat;
      const pitch   = Math.floor(vs.maxVisiblePitch - y / vs.pixelsPerPitch);
      if (pitch < 0 || pitch > 127) return;
      const gridSize = 4 / gridSettings.division;
      const snappedBeat = Math.floor(beatPos / gridSize) * gridSize;
      useMidiStore.getState().brushNotes(pitch, snappedBeat, 4, gridSize, gridSize);
      return;
    }

    if (currentTool === 'scissors') {
      const beat    = x / vs.pixelsPerBeat + vs.startBeat;
      const pitch   = Math.floor(vs.maxVisiblePitch - y / vs.pixelsPerPitch);
      const hit     = hitTest(beat, pitch);
      if (hit.note) {
        splitNote(hit.note.id, beat);
      }
      return;
    }

    if (currentTool === 'glue') {
      const beat    = x / vs.pixelsPerBeat + vs.startBeat;
      const pitch   = Math.floor(vs.maxVisiblePitch - y / vs.pixelsPerPitch);
      const hit     = hitTest(beat, pitch);
      if (hit.note) {
        const clipData = getCurrentClip();
        if (clipData?.notes) {
          const overlapping = clipData.notes.find(n =>
            n.id !== hit.note!.id &&
            n.pitch === hit.note!.pitch &&
            Math.abs(n.startBeat + n.duration - hit.note!.startBeat) < 0.01
          );
          if (overlapping) {
            joinNotes([overlapping.id, hit.note!.id]);
          }
        }
      }
      return;
    }

    if (currentTool === 'select') {
      const beat  = x / vs.pixelsPerBeat + vs.startBeat;
      const pitch = Math.floor(vs.maxVisiblePitch - y / vs.pixelsPerPitch);
      const hit   = hitTest(beat, pitch);

      // Double-click on a note → open edit popover
      if (e.detail === 2 && hit.type !== 'none' && hit.note) {
        selectNote(hit.note.id, false);
        setEditPopoverNote({
          note: hit.note,
          position: { x: e.clientX, y: e.clientY }
        });
        return;
      }

      if (hit.type !== 'none' && hit.note) {
        const dragMode = hit.type === 'note' ? 'move' : hit.type;
        selectNote(hit.note.id, e.shiftKey);
        onNoteOn?.(hit.note.pitch);
        window.setTimeout(() => onNoteOff?.(hit.note!.pitch), 300);
        startDrag(dragMode as 'move' | 'resize-left' | 'resize-right' | 'velocity', hit.note.id, e.clientX, e.clientY);
        isDraggingRef.current = true;
        dragNoteIdRef.current = hit.note.id;
        window.addEventListener('mousemove', handleWindowMouseMove);
        window.addEventListener('mouseup',   handleWindowMouseUp);
      } else {
        setLassoSelection({ startX: x, startY: y, currentX: x, currentY: y });
        setLassoStartBeat(beat);
        setLassoEndBeat(beat);
        window.addEventListener('mousemove', handleLassoMouseMove);
        window.addEventListener('mouseup', handleLassoMouseUp);
      }
    }
  }, [currentTool, addNote, deleteNote, selectNote, deselectAllNotes, startDrag, updateDrag, endDrag, hitTest, onNoteOn, onNoteOff, handleWindowMouseMove, handleWindowMouseUp, gridSettings, drawDuration, splitNote, joinNotes]);

  const handleCanvasMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDraggingRef.current) return; // Don't change cursor while dragging
    const el = e.currentTarget as HTMLElement;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const vs = pianoRollNavigation.getState();
    const beat = x / vs.pixelsPerBeat + vs.startBeat;
    const pitch = Math.floor(vs.maxVisiblePitch - y / vs.pixelsPerPitch);

    if (currentTool === 'select') {
      const hit = hitTest(beat, pitch);
      if (hit.type === 'resize-left' || hit.type === 'resize-right') {
        el.style.cursor = 'ew-resize';
      } else if (hit.type === 'note') {
        el.style.cursor = 'grab';
      } else {
        el.style.cursor = 'default';
      }
    } else if (currentTool === 'draw') {
      el.style.cursor = 'crosshair';
    } else if (currentTool === 'erase') {
      el.style.cursor = 'pointer';
    } else {
      el.style.cursor = 'default';
    }
  }, [currentTool, hitTest]);

  const handleRulerMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const vs = pianoRollNavigation.getState();
    const clickedBeat = clickX / vs.pixelsPerBeat + vs.startBeat;
    const snappedBeat = Math.max(0, snapBeatToGrid(clickedBeat));

    const state = useMidiStore.getState();
    const lStartBeatX = (state.loopStart - vs.startBeat) * vs.pixelsPerBeat;
    const lEndBeatX = (state.loopEnd - vs.startBeat) * vs.pixelsPerBeat;

    let mode: 'seek' | 'loop-start' | 'loop-end' | 'loop-range' = 'seek';
    let anchorBeat = snappedBeat;

    if (state.loopEnabled && Math.abs(clickX - lStartBeatX) <= 10) {
      mode = 'loop-start';
    } else if (state.loopEnabled && Math.abs(clickX - lEndBeatX) <= 10) {
      mode = 'loop-end';
    } else if (e.shiftKey) {
      mode = 'loop-range';
      anchorBeat = snappedBeat;
      state.setLoopRange(snappedBeat, Math.max(snappedBeat + 1, state.loopEnd));
      state.setLoopEnabled(true);
    } else {
      seekToBeat(snappedBeat);
    }

    const startClientX = e.clientX;

    const onMove = (me: MouseEvent) => {
      const moveX = me.clientX - rect.left;
      const currentVs = pianoRollNavigation.getState();
      const rawBeat = moveX / currentVs.pixelsPerBeat + currentVs.startBeat;
      const currentSnappedBeat = Math.max(0, snapBeatToGrid(rawBeat));
      const currentState = useMidiStore.getState();

      if (mode === 'loop-start') {
        const newStart = Math.min(currentSnappedBeat, currentState.loopEnd - 0.25);
        currentState.setLoopStart(Math.max(0, newStart));
      } else if (mode === 'loop-end') {
        const newEnd = Math.max(currentSnappedBeat, currentState.loopStart + 0.25);
        currentState.setLoopEnd(newEnd);
      } else if (mode === 'loop-range') {
        const start = Math.min(anchorBeat, currentSnappedBeat);
        const end = Math.max(anchorBeat, currentSnappedBeat);
        if (end > start) {
          currentState.setLoopRange(start, end);
        }
      } else {
        if (Math.abs(me.clientX - startClientX) > 5) {
          mode = 'loop-range';
          const start = Math.min(anchorBeat, currentSnappedBeat);
          const end = Math.max(anchorBeat, currentSnappedBeat);
          if (end > start) {
            currentState.setLoopRange(start, end);
            currentState.setLoopEnabled(true);
          }
        } else {
          seekToBeat(currentSnappedBeat);
        }
      }
    };

    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [seekToBeat, snapBeatToGrid]);

  // ── Early return (no clip) ─────────────────────────────────────────────
  if (!clip) {
    return (
      <div ref={containerRef} className="flex items-center justify-center h-full text-studio-text-dim">
        No MIDI clip selected
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div ref={containerRef} className="flex flex-col h-full w-full bg-studio-panel overflow-hidden text-xs">

      {/* ── Top Tabs ── */}
      <div className="flex items-center justify-center h-7 bg-studio-control border-b border-studio-line">
        <div className="flex h-full items-center">
          <button
            className={`px-5 py-1 border-r border-l border-studio-line text-xs shadow-inner rounded-sm h-6 transition-colors ${
              activeTab === 'piano-roll' ? 'bg-studio-control text-studio-text' : 'text-studio-text-mid hover:text-studio-text'
            }`}
            onClick={() => setActiveTab('piano-roll')}
          >Piano Roll</button>
          <button
            className={`px-5 py-1 border-r border-studio-line text-xs h-6 transition-colors ${
              activeTab === 'score' ? 'bg-studio-control text-studio-text' : 'text-studio-text-mid hover:text-studio-text'
            }`}
            onClick={() => setActiveTab('score')}
          >Score</button>
          <button
            className={`px-5 py-1 border-r border-studio-line text-xs h-6 transition-colors ${
              activeTab === 'step-sequencer' ? 'bg-studio-control text-studio-text' : 'text-studio-text-mid hover:text-studio-text'
            }`}
            onClick={() => setActiveTab('step-sequencer')}
          >Step Sequencer</button>
          <button
            className={`px-5 py-1 text-xs h-6 transition-colors ${
              activeTab === 'smart-tempo' ? 'bg-studio-control text-studio-text' : 'text-studio-text-mid hover:text-studio-text'
            }`}
            onClick={() => setActiveTab('smart-tempo')}
          >Smart Tempo</button>
        </div>
      </div>

      {/* ── Secondary Toolbar ── */}
      <div className="flex items-center h-8 bg-studio-control border-b border-studio-line px-2 text-studio-text gap-4 shrink-0 shadow-sm z-10">
        {/* Dropdown Menus */}
        <div className="flex gap-3 font-medium text-[11px] relative" data-dropdown>
          <div className="relative">
            <button
              data-dropdown
              className={`hover:text-white flex items-center ${openDropdown === 'edit' ? 'text-white bg-studio-control rounded px-1' : ''}`}
              onClick={() => setOpenDropdown(openDropdown === 'edit' ? null : 'edit')}
            >Edit <ChevronDown className="w-3 h-3 ml-0.5 opacity-70" /></button>
            {openDropdown === 'edit' && (
              <div className="absolute top-full left-0 mt-1 bg-studio-control border border-studio-line-strong rounded shadow-lg z-50 min-w-[160px] py-1">
                <button className="w-full px-3 py-1 text-left hover:bg-accent-cyan text-studio-text text-[11px]" onClick={() => { undo(); setOpenDropdown(null); }}>Undo <span className="float-right text-studio-text-dim">⌘Z</span></button>
                <button className="w-full px-3 py-1 text-left hover:bg-accent-cyan text-studio-text text-[11px]" onClick={() => { redo(); setOpenDropdown(null); }}>Redo <span className="float-right text-studio-text-dim">⌘⇧Z</span></button>
                <div className="border-t border-studio-line-strong my-1" />
                <button className="w-full px-3 py-1 text-left hover:bg-accent-cyan text-studio-text text-[11px]" onClick={() => { quantizeSelected({ gridDivision: gridSettings.division, strength: 1 }); setOpenDropdown(null); }}>Quantize <span className="float-right text-studio-text-dim">Q</span></button>
                <div className="border-t border-studio-line-strong my-1" />
                <button className="w-full px-3 py-1 text-left hover:bg-accent-cyan text-studio-text text-[11px]" onClick={() => {
                  const clipData = getCurrentClip();
                  if (clipData) {
                    for (const id of selectedNoteIds) deleteNote(id);
                  }
                  setOpenDropdown(null);
                }}>Delete Selected <span className="float-right text-studio-text-dim">Del</span></button>
                <button className="w-full px-3 py-1 text-left hover:bg-accent-cyan text-studio-text text-[11px]" onClick={() => {
                  deselectAllNotes();
                  setOpenDropdown(null);
                }}>Deselect All <span className="float-right text-studio-text-dim">Esc</span></button>
              </div>
            )}
          </div>
          <div className="relative">
            <button
              data-dropdown
              className={`hover:text-white flex items-center ${openDropdown === 'functions' ? 'text-white bg-studio-control rounded px-1' : ''}`}
              onClick={() => setOpenDropdown(openDropdown === 'functions' ? null : 'functions')}
            >Functions <ChevronDown className="w-3 h-3 ml-0.5 opacity-70" /></button>
            {openDropdown === 'functions' && (
              <div className="absolute top-full left-0 mt-1 bg-studio-control border border-studio-line-strong rounded shadow-lg z-50 min-w-[160px] py-1">
                <button className="w-full px-3 py-1 text-left hover:bg-accent-cyan text-studio-text text-[11px]" onClick={() => {
                  const clipData = getCurrentClip();
                  if (clipData?.notes && selectedNoteIds.size >= 2) {
                    joinNotes(Array.from(selectedNoteIds));
                  }
                  setOpenDropdown(null);
                }}>Join Notes <span className="float-right text-studio-text-dim">J</span></button>
                <button className="w-full px-3 py-1 text-left hover:bg-accent-cyan text-studio-text text-[11px]" onClick={() => {
                  if (currentClipId && selectedNoteIds.size === 1) {
                    splitNote(Array.from(selectedNoteIds)[0], currentBeat);
                  }
                  setOpenDropdown(null);
                }}>Split Note <span className="float-right text-studio-text-dim">X</span></button>
                <div className="border-t border-studio-line-strong my-1" />
                <button className="w-full px-3 py-1 text-left hover:bg-accent-cyan text-studio-text text-[11px]" onClick={() => {
                  const clipData = getCurrentClip();
                  if (clipData?.notes) {
                    const vel = useMidiStore.getState().selectedNoteIds.size > 0 ? 100 : 100;
                    setSelectedNotesVelocity(vel);
                  }
                  setOpenDropdown(null);
                }}>Velocity 100</button>
                <button className="w-full px-3 py-1 text-left hover:bg-accent-cyan text-studio-text text-[11px]" onClick={() => {
                  const clipData = getCurrentClip();
                  if (clipData?.notes) {
                    for (const note of clipData.notes) {
                      if (selectedNoteIds.has(note.id)) {
                        useMidiStore.getState().setNoteVelocity(note.id, Math.min(127, note.velocity + 10));
                      }
                    }
                  }
                  setOpenDropdown(null);
                }}>Velocity +10</button>
                <button className="w-full px-3 py-1 text-left hover:bg-accent-cyan text-studio-text text-[11px]" onClick={() => {
                  const clipData = getCurrentClip();
                  if (clipData?.notes) {
                    for (const note of clipData.notes) {
                      if (selectedNoteIds.has(note.id)) {
                        useMidiStore.getState().setNoteVelocity(note.id, Math.max(1, note.velocity - 10));
                      }
                    }
                  }
                  setOpenDropdown(null);
                }}>Velocity -10</button>
                <div className="border-t border-studio-line-strong my-1" />
                <button className="w-full px-3 py-1 text-left hover:bg-accent-cyan text-studio-text text-[11px]" onClick={() => {
                  useMidiStore.getState().humanizeSelected({ timingVariance: 0.02, velocityVariance: 5 });
                  setOpenDropdown(null);
                }}>Humanize</button>
                <button className="w-full px-3 py-1 text-left hover:bg-accent-cyan text-studio-text text-[11px]" onClick={() => {
                  useMidiStore.getState().transposeSelected(12);
                  setOpenDropdown(null);
                }}>Transpose +1 Octave</button>
                <button className="w-full px-3 py-1 text-left hover:bg-accent-cyan text-studio-text text-[11px]" onClick={() => {
                  useMidiStore.getState().transposeSelected(-12);
                  setOpenDropdown(null);
                }}>Transpose -1 Octave</button>
              </div>
            )}
          </div>
          <div className="relative">
            <button
              data-dropdown
              className={`hover:text-white flex items-center ${openDropdown === 'view' ? 'text-white bg-studio-control rounded px-1' : ''}`}
              onClick={() => setOpenDropdown(openDropdown === 'view' ? null : 'view')}
            >View <ChevronDown className="w-3 h-3 ml-0.5 opacity-70" /></button>
            {openDropdown === 'view' && (
              <div className="absolute top-full left-0 mt-1 bg-studio-control border border-studio-line-strong rounded shadow-lg z-50 min-w-[160px] py-1">
                <button className="w-full px-3 py-1 text-left hover:bg-accent-cyan text-studio-text text-[11px]" onClick={() => { toggleVelocityLane(); setOpenDropdown(null); }}>
                  {showVelocityLane ? '✓ ' : '  '}Velocity Lane
                </button>
                <button className="w-full px-3 py-1 text-left hover:bg-accent-cyan text-studio-text text-[11px]" onClick={() => { toggleFoldMode(); setOpenDropdown(null); }}>
                  {showFoldMode ? '✓ ' : '  '}Fold Mode
                </button>
                <button className="w-full px-3 py-1 text-left hover:bg-accent-cyan text-studio-text text-[11px]" onClick={() => { toggleRulerSeconds(); setOpenDropdown(null); }}>
                  {showRulerSeconds ? '✓ ' : '  '}Ruler in Seconds
                </button>
                <div className="border-t border-studio-line-strong my-1" />
                <button className="w-full px-3 py-1 text-left hover:bg-accent-cyan text-studio-text text-[11px]" onClick={() => { zoomToSelection(); setOpenDropdown(null); }}>Zoom to Selection</button>
              </div>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            className="p-1 hover:bg-studio-control rounded text-studio-text-mid"
            onClick={() => seekToBeat(0)}
            title="Go to Start"
          ><SkipBack className="w-3.5 h-3.5" /></button>
          <button
            className={`p-1 rounded ${isPlaying ? 'bg-[#4CAF50] text-black' : 'hover:bg-studio-control text-studio-text-mid'}`}
            onClick={() => {
              if (isPlaying) {
                stop();
              } else {
                play();
              }
            }}
            title={isPlaying ? 'Stop' : 'Play'}
          ><Play className="w-3.5 h-3.5" /></button>
          
          {/* Loop toggle */}
          <button
            className={`p-1 rounded ${loopEnabled ? 'bg-green-600 text-white font-bold' : 'hover:bg-studio-control text-studio-text-mid'}`}
            onClick={() => setLoopEnabled(!loopEnabled)}
            title={loopEnabled ? 'Disable Loop (L)' : 'Enable Loop (L)'}
          >
            <Repeat className="w-3.5 h-3.5" />
          </button>

          {/* Loop Range Inputs */}
          <div className="flex items-center gap-1 text-[10px] bg-studio-panel px-1.5 py-0.5 rounded border border-studio-line">
            <span className="text-green-500 font-bold">L:</span>
            <input
              type="number"
              value={loopStart}
              step={1}
              min={0}
              onChange={(e) => setLoopStart(Math.max(0, Number(e.target.value)))}
              className="w-7 bg-transparent text-studio-text text-center font-mono focus:outline-none"
              title="Loop Start Beat"
            />
            <span className="text-studio-text-dim">-</span>
            <span className="text-green-500 font-bold">R:</span>
            <input
              type="number"
              value={loopEnd}
              step={1}
              min={loopStart + 1}
              onChange={(e) => setLoopEnd(Math.max(loopStart + 1, Number(e.target.value)))}
              className="w-7 bg-transparent text-studio-text text-center font-mono focus:outline-none"
              title="Loop End Beat"
            />
          </div>

          {/* Record toggle */}
          <button
            className={`p-1 rounded ${isRecording ? 'bg-red-600 text-white animate-pulse' : 'hover:bg-studio-control text-studio-text-mid'}`}
            onClick={() => {
              if (isRecording) {
                recorderRef.current?.dispose();
                recorderRef.current = null;
                setIsRecording(false);
              } else {
                const clip = getCurrentClip();
                if (!clip) return;
                const recorder = new MidiRecorder(
                  (note) => recordNote(note.pitch, note.startBeat, note.duration, note.velocity),
                  () => useMidiStore.getState().currentBeat,
                  (active, beat) => useMidiStore.getState().setSustainPedal(active ? 127 : 0),
                );
                recorder.start(clip.durationBeats);
                recorderRef.current = recorder;
                setIsRecording(true);
              }
            }}
            title={isRecording ? 'Stop Recording (R)' : 'Record MIDI (R)'}
          >
            <Circle className="w-3.5 h-3.5" />
          </button>
          
          {/* Merge mode toggle */}
          <button
            className={`p-1 rounded ${mergeMode ? 'bg-accent-cyan text-white' : 'hover:bg-studio-control text-studio-text-mid'}`}
            onClick={() => setMergeMode(!mergeMode)}
            title={mergeMode ? 'Merge Mode (Overdub)' : 'Replace Mode'}
          >
            <GitMerge className="w-3.5 h-3.5" />
          </button>
        </div>
        
        <div className="w-px h-4 bg-studio-control" />
        
        {/* Tools */}
        <div className="flex items-center gap-1 relative" data-dropdown>
          <button
            className={`p-1 rounded flex items-center gap-1 hover:bg-studio-control text-studio-text transition-colors ${openDropdown === 'tool' ? 'bg-studio-control text-white shadow-inner' : ''}`}
            onClick={() => setOpenDropdown(openDropdown === 'tool' ? null : 'tool')}
            title="Tool Selector"
          >
            {(() => {
              switch (currentTool) {
                case 'select': return <MousePointer2 className="w-4 h-4" />;
                case 'draw': return <Pencil className="w-4 h-4" />;
                case 'erase': return <Eraser className="w-4 h-4" />;
                case 'finger': return <Hand className="w-4 h-4" />;
                case 'scissors': return <Scissors className="w-4 h-4" />;
                case 'glue': return <LinkIcon className="w-4 h-4" />;
                case 'mute': return <VolumeX className="w-4 h-4" />;
                case 'quantize': return <span className="font-bold w-4 h-4 text-center leading-4" style={{fontSize: '11px'}}>Q</span>;
                case 'velocity': return <Activity className="w-4 h-4" />;
                case 'zoom': return <ZoomIn className="w-4 h-4" />;
                case 'automation-select': return <MousePointer2 className="w-4 h-4" />;
                case 'automation-curve': return <MousePointer2 className="w-4 h-4" />;
                case 'brush': return <Paintbrush className="w-4 h-4" />;
                default: return <MousePointer2 className="w-4 h-4" />;
              }
            })()}
            <ChevronDown className="w-3 h-3 opacity-50" />
          </button>

          {openDropdown === 'tool' && (
            <div className="absolute top-full left-0 mt-1 bg-studio-control border border-studio-line rounded-md shadow-xl z-50 min-w-[220px] py-1.5" style={{boxShadow: '0 4px 12px rgba(0,0,0,0.5)'}}>
              {[
                { id: 'select', label: 'Pointer Tool', icon: <MousePointer2 className="w-3.5 h-3.5" /> },
                { id: 'draw', label: 'Pencil Tool', icon: <Pencil className="w-3.5 h-3.5" /> },
                { id: 'erase', label: 'Eraser Tool', icon: <Eraser className="w-3.5 h-3.5" /> },
                { id: 'finger', label: 'Finger Tool', icon: <Hand className="w-3.5 h-3.5" /> },
                { id: 'scissors', label: 'Scissors Tool', icon: <Scissors className="w-3.5 h-3.5" /> },
                { id: 'glue', label: 'Join Tool', icon: <LinkIcon className="w-3.5 h-3.5" /> },
                { id: 'mute', label: 'Mute Tool', icon: <VolumeX className="w-3.5 h-3.5" /> },
                { id: 'quantize', label: 'Quantize Tool', icon: <span className="font-bold w-3.5 h-3.5 text-center leading-[14px]" style={{fontSize: '10px'}}>Q</span> },
                { id: 'velocity', label: 'Velocity Tool', icon: <Activity className="w-3.5 h-3.5" /> },
                { id: 'zoom', label: 'Zoom Tool', icon: <ZoomIn className="w-3.5 h-3.5" /> },
                { id: 'automation-select', label: 'Automation Select Tool', icon: <MousePointer2 className="w-3.5 h-3.5" /> },
                { id: 'automation-curve', label: 'Automation Curve Tool', icon: <MousePointer2 className="w-3.5 h-3.5" /> },
                { id: 'brush', label: 'Brush Tool', icon: <Paintbrush className="w-3.5 h-3.5" /> },
              ].map((tool) => (
                <button
                  key={tool.id}
                  className="w-full flex items-center px-2 py-1 text-left hover:bg-accent-cyan hover:text-white text-studio-text text-[13px] group"
                  onClick={() => {
                    setTool(tool.id as any);
                    setOpenDropdown(null);
                  }}
                >
                  <div className="w-5 flex justify-center shrink-0">
                    {currentTool === tool.id && <Check className="w-3.5 h-3.5 text-white" />}
                  </div>
                  <div className="text-studio-text-mid group-hover:text-white flex justify-center w-5 shrink-0">
                    {tool.icon}
                  </div>
                  <span className="ml-1 tracking-wide">{tool.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="w-px h-4 bg-studio-control" />
        
        {/* Channel Filter */}
        <div className="flex items-center gap-1">
          <select
            value={channelFilter !== null ? channelFilter : ''}
            onChange={(e) => setChannelFilter(e.target.value === '' ? null : Number(e.target.value))}
            className="bg-studio-panel border border-studio-line rounded shadow-inner px-1 py-0.5 text-studio-text text-[11px]"
            title="Channel Filter"
          >
            <option value="">All Channels</option>
            {Array.from({ length: 16 }).map((_, i) => (
              <option key={i} value={i}>Ch {i + 1}</option>
            ))}
          </select>
        </div>

        {/* Fold mode toggle */}
        <button
          className={`p-1 rounded ${showFoldMode ? 'bg-accent-cyan text-white' : 'hover:bg-studio-control text-studio-text-mid'}`}
          onClick={() => toggleFoldMode()}
          title={showFoldMode ? 'Fold Mode (show used notes only)' : 'Fold Mode (show used notes only)'}
        >
          <FoldHorizontal className="w-3.5 h-3.5" />
        </button>

        {/* Ruler seconds toggle */}
        <button
          className={`p-1 rounded ${showRulerSeconds ? 'bg-accent-cyan text-white' : 'hover:bg-studio-control text-studio-text-mid'}`}
          onClick={() => toggleRulerSeconds()}
          title={showRulerSeconds ? 'Ruler: Seconds' : 'Ruler: Bar/Beat'}
        >
          <span className="text-[10px] font-bold px-1">{showRulerSeconds ? 'Sec' : 'Beat'}</span>
        </button>

        {/* Step Input Keyboard toggle */}
        <button
          className={`p-1 rounded ${showStepKeyboard ? 'bg-accent-cyan text-white' : 'hover:bg-studio-control text-studio-text-mid'}`}
          onClick={() => setShowStepKeyboard(!showStepKeyboard)}
          title="Step Input Keyboard"
        >
          <KeyboardMusic className="w-3.5 h-3.5" />
        </button>

        {/* Catch Playhead (Auto-Scroll) */}
        <button
          className={`p-1 rounded ${autoScrollEnabled ? 'bg-accent-cyan text-white' : 'hover:bg-studio-control text-studio-text-mid'}`}
          onClick={toggleAutoScroll}
          title={autoScrollEnabled ? 'Catch Playhead: ON' : 'Catch Playhead: OFF'}
        >
          <span className="text-[10px] font-bold px-1">{autoScrollEnabled ? 'Catch' : 'Free'}</span>
        </button>

        {/* Color By Menu */}
        <div className="relative" data-dropdown>
          <button
            className={`p-1 rounded ${colorMode !== 'none' ? 'bg-accent-cyan text-white' : 'hover:bg-studio-control text-studio-text-mid'}`}
            onClick={() => {
              const modes: Array<'none' | 'velocity' | 'pitch' | 'channel'> = ['none', 'velocity', 'pitch', 'channel'];
              const currentIndex = modes.indexOf(colorMode);
              const nextMode = modes[(currentIndex + 1) % modes.length];
              setColorMode(nextMode);
            }}
            title={`Color By: ${colorMode}`}
          >
            <Palette className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* MIDI Out Toggle */}
        <button
          className={`p-1 rounded ${midiOutEnabled ? 'bg-accent-cyan text-white' : 'hover:bg-studio-control text-studio-text-mid'}`}
          onClick={toggleMidiOut}
          title={midiOutEnabled ? 'MIDI Out: ON' : 'MIDI Out: OFF'}
        >
          <span className="text-[10px] font-bold px-1">MIDI</span>
        </button>

        <button
          className="p-1 bg-[#d4a017] rounded text-black"
          onClick={() => {
            if (!onLinkModeChange) return;
            const modes: PianoRollLinkMode[] = ['single', 'selected', 'folder', 'project'];
            const currentIndex = modes.indexOf(linkMode);
            const nextMode = modes[(currentIndex + 1) % modes.length];
            onLinkModeChange(nextMode);
          }}
          title={`Link Mode: ${linkMode}`}
        ><LinkIcon className="w-3.5 h-3.5" /></button>

        <div className="flex-1" />
        
        {/* Playhead info */}
        <div className="bg-studio-panel px-3 py-1 rounded shadow-inner text-studio-text-mid font-mono text-[10px] tabular-nums tracking-widest border border-studio-line">
          {playheadText}
        </div>
        
        {/* Snap */}
        <div className="flex items-center gap-1 text-[11px] ml-4">
          <span className="text-studio-text-dim">Snap:</span>
          <span className="font-medium">{gridSettings.snap ? 'On' : 'Off'}</span>
        </div>

        <div className="flex-1" />

        {/* Zoom */}
        <div className="flex items-center gap-1 mr-2">
          <button
            className="p-1 hover:bg-studio-control rounded text-studio-text-mid"
            onClick={zoomToSelection}
            title="Zoom to Selection"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
          <button
            className="p-1 hover:bg-studio-control rounded text-studio-text-mid"
            onClick={() => setShowGoToBeatDialog(true)}
            title="Go to Beat/Measure..."
          >
            <ArrowRightToLine className="w-3.5 h-3.5" />
          </button>
          <button
            className="p-1 hover:bg-studio-control rounded text-studio-text-mid"
            onClick={() => setShowLocateNoteDialog(true)}
            title="Locate Note..."
          >
            <Search className="w-3.5 h-3.5" />
          </button>
          <button className="p-1 hover:bg-studio-control rounded text-studio-text-mid" onClick={() => pianoRollNavigation.queueInput(new WheelEvent('wheel', { deltaY: 100, ctrlKey: true, clientX: 400, clientY: 200 }))}><ZoomOut className="w-3 h-3" /></button>
          <button className="p-1 hover:bg-studio-control rounded text-studio-text-mid" onClick={() => pianoRollNavigation.queueInput(new WheelEvent('wheel', { deltaY: -100, ctrlKey: true, clientX: 400, clientY: 200 }))}><ZoomIn className="w-3 h-3" /></button>
          <button className="p-1 hover:bg-studio-control rounded text-studio-text-mid ml-2" onClick={() => pianoRollNavigation.queueInput(new WheelEvent('wheel', { deltaY: -100, ctrlKey: true, shiftKey: true, clientX: 400, clientY: 200 }))}><ArrowUpDown className="w-3 h-3" /></button>
        </div>
      </div>

      {/* ── Main Layout (Sidebar + Canvas) ── */}
      {activeTab === 'step-sequencer' ? (
        <StepSequencer />
      ) : (
      <div className="flex flex-1 overflow-hidden">
        
        {/* ── Left Inspector Sidebar ── */}
        <div className="w-[180px] bg-studio-control border-r border-studio-line flex flex-col shrink-0 text-[11px]">
          {/* Region info */}
          <div className="p-3 border-b border-studio-line flex gap-2 items-center bg-studio-control">
            <div className="w-6 h-6 bg-studio-control rounded shadow-inner border border-studio-line shrink-0"></div>
            <div className="flex flex-col justify-center overflow-hidden">
              <div className="text-studio-text font-bold truncate">{clip.name || 'Untitled Clip'}</div>
              <div className="text-studio-text-dim text-[9px] truncate">
                {selectedNoteIds.size > 0
                  ? `${selectedNoteIds.size} note${selectedNoteIds.size > 1 ? 's' : ''} selected`
                  : clip.notes?.length > 0
                    ? `${clip.notes.length} notes`
                    : 'No notes'
                }
              </div>
            </div>
            <div className="w-4 h-4 rounded bg-studio-control text-white flex items-center justify-center shrink-0 ml-auto">
               <ChevronDown className="w-3 h-3" />
            </div>
          </div>
          
          {/* Time Quantize */}
          <div className="p-3 border-b border-studio-line">
            <div className="text-studio-text-mid font-bold mb-2">Time Quantize</div>
            <div className="flex items-center justify-between mb-2">
               <select
                 value={gridSettings.division}
                 onChange={(e) => setGridDivision(Number(e.target.value))}
                 className="bg-studio-panel border border-studio-line rounded shadow-inner px-1 py-0.5 text-studio-text w-24"
               >
                 <option value={4}>1/4 Note</option>
                 <option value={8}>1/8 Note</option>
                 <option value={16}>1/16 Note</option>
                 <option value={32}>1/32 Note</option>
               </select>
               <button
                 onClick={() => quantizeSelected({ gridDivision: gridSettings.division, strength: 1, swing })}
                 className="w-6 h-5 bg-studio-control hover:bg-studio-raised rounded border border-studio-line text-studio-text font-medium text-center"
               >Q</button>
            </div>
            <div className="flex justify-between items-center mb-1 mt-3">
              <span className="text-studio-text-dim">Strength</span>
              <span className="text-studio-text-mid">100</span>
            </div>
            <div className="h-1.5 bg-studio-panel rounded-full overflow-hidden mb-2 border border-studio-line"><div className="w-full h-full bg-accent-cyan/50"></div></div>

            <div className="flex justify-between items-center mb-1 mt-3">
              <span className="text-studio-text-dim">Swing</span>
              <span className="text-studio-text-mid">{Math.round(swing * 100)}</span>
            </div>
            <div
              className="h-1.5 bg-studio-panel rounded-full overflow-hidden border border-studio-line cursor-pointer relative"
              onMouseDown={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                setSwing(pct);
                const onMove = (me: MouseEvent) => {
                  const p = Math.max(0, Math.min(1, (me.clientX - rect.left) / rect.width));
                  setSwing(p);
                };
                const onUp = () => {
                  window.removeEventListener('mousemove', onMove);
                  window.removeEventListener('mouseup', onUp);
                };
                window.addEventListener('mousemove', onMove);
                window.addEventListener('mouseup', onUp);
              }}
            >
              <div className="h-full bg-accent-cyan/50 transition-all" style={{ width: `${swing * 100}%` }} />
            </div>
          </div>

          {/* Scale Quantize */}
          <div className="p-3 border-b border-studio-line">
            <div className="text-studio-text-mid font-bold mb-2">Scale Quantize</div>
            <div className="flex items-center gap-1">
              <select
                value={scaleQuantizeEnabled ? scaleKey : 'off'}
                onChange={(e) => {
                  if (e.target.value === 'off') {
                    setScaleQuantizeEnabled(false);
                  } else {
                    setScaleQuantizeEnabled(true);
                    setScaleKey(Number(e.target.value));
                  }
                }}
                className="bg-studio-panel border border-studio-line rounded shadow-inner px-1 py-0.5 text-studio-text w-[45px]"
              >
                <option value="off">Off</option>
                {['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'].map((name, i) => (
                  <option key={i} value={i}>{name}</option>
                ))}
              </select>
              <select
                value={scaleType}
                onChange={(e) => setScaleType(e.target.value)}
                className="bg-studio-panel border border-studio-line rounded shadow-inner px-1 py-0.5 text-studio-text flex-1"
              >
                {['major','minor','dorian','mixolydian','natural-minor','harmonic-minor','pentatonic','blues','chromatic'].map(s => (
                  <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1).replace('-', ' ')}</option>
                ))}
              </select>
              <button
                onClick={() => scaleQuantizeSelected(scaleKey, scaleType)}
                className="w-6 h-5 bg-studio-control hover:bg-studio-raised rounded border border-studio-line text-studio-text font-medium text-center"
              >Q</button>
            </div>
          </div>

          {/* Velocity */}
          <div className="p-3">
            <div className="text-studio-text-mid font-bold mb-2 mt-2">Velocity</div>
            <div className="flex items-center gap-2">
              <div
                className="flex-1 h-1.5 bg-studio-panel rounded-full overflow-hidden border border-studio-line cursor-pointer relative"
                onMouseDown={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                  const vel = Math.round(pct * 127);
                  setInspectorVelocity(vel);
                  if (selectedNoteIds.size > 0) {
                    for (const id of selectedNoteIds) {
                      useMidiStore.getState().setNoteVelocity(id, vel);
                    }
                  }
                  const onMove = (me: MouseEvent) => {
                    const p = Math.max(0, Math.min(1, (me.clientX - rect.left) / rect.width));
                    const v = Math.round(p * 127);
                    setInspectorVelocity(v);
                    if (selectedNoteIds.size > 0) {
                      for (const id of selectedNoteIds) {
                        useMidiStore.getState().setNoteVelocity(id, v);
                      }
                    }
                  };
                  const onUp = () => {
                    window.removeEventListener('mousemove', onMove);
                    window.removeEventListener('mouseup', onUp);
                  };
                  window.addEventListener('mousemove', onMove);
                  window.addEventListener('mouseup', onUp);
                }}
              >
                <div className="h-full bg-green-500/50 transition-all" style={{ width: `${(inspectorVelocity / 127) * 100}%` }} />
              </div>
              <span className="text-studio-text-mid w-6 text-right tabular-nums">{inspectorVelocity}</span>
            </div>
          </div>

          {/* Chord Detection */}
          {selectedNoteIds.size >= 2 && (
            <div className="p-3 border-t border-studio-line">
              <div className="text-studio-text-mid font-bold mb-2">Chord</div>
              <div className="text-studio-text text-sm font-mono">
                {(() => {
                  const clipData = getCurrentClip();
                  if (!clipData?.notes) return '—';
                  const selectedNotes = clipData.notes.filter(n => selectedNoteIds.has(n.id));
                  const pitches = selectedNotes.map(n => n.pitch);
                  const { detectChord } = require('@/engine/midi/chordDetection');
                  return detectChord(pitches) || '—';
                })()}
              </div>
            </div>
          )}

          {/* Note Properties (when single note selected) */}
          {selectedNoteIds.size === 1 && (() => {
            const clipData = getCurrentClip();
            const note = clipData?.notes.find(n => selectedNoteIds.has(n.id));
            if (!note) return null;
            return (
              <div className="p-3 border-t border-studio-line">
                <div className="text-studio-text-mid font-bold mb-2">Note</div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-studio-text-dim">Pitch</span>
                    <input
                      type="number"
                      value={note.pitch}
                      min={0}
                      max={127}
                      onChange={(e) => {
                        const newPitch = Math.max(0, Math.min(127, Number(e.target.value)));
                        useMidiStore.getState().moveNote(note.id, 0, newPitch - note.pitch);
                      }}
                      className="w-12 bg-studio-panel border border-studio-line rounded px-1 py-0.5 text-studio-text text-center font-mono"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-studio-text-dim">Start</span>
                    <input
                      type="text"
                      value={`${Math.floor(note.startBeat / 4) + 1} ${Math.floor(note.startBeat % 4) + 1} 1`}
                      onChange={(e) => {
                        const parts = e.target.value.split(' ').map(Number);
                        if (parts.length === 3 && parts[0] && parts[1]) {
                          const newBeat = (parts[0] - 1) * 4 + (parts[1] - 1) + (parts[2] - 1) / 4;
                          useMidiStore.getState().moveNote(note.id, newBeat - note.startBeat, 0);
                        }
                      }}
                      className="w-20 bg-studio-panel border border-studio-line rounded px-1 py-0.5 text-studio-text text-center font-mono"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-studio-text-dim">Length</span>
                    <input
                      type="text"
                      value={`${Math.floor(note.duration)} beat${Math.floor(note.duration) !== 1 ? 's' : ''}`}
                      onChange={(e) => {
                        const match = e.target.value.match(/(\d+(?:\.\d+)?)/);
                        if (match) {
                          const newDuration = parseFloat(match[1]);
                          if (newDuration > 0) {
                            useMidiStore.getState().resizeNote(note.id, newDuration);
                          }
                        }
                      }}
                      className="w-20 bg-studio-panel border border-studio-line rounded px-1 py-0.5 text-studio-text text-center font-mono"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-studio-text-dim">Velocity</span>
                    <input
                      type="number"
                      value={note.velocity}
                      min={1}
                      max={127}
                      onChange={(e) => {
                        const newVel = Math.max(1, Math.min(127, Number(e.target.value)));
                        useMidiStore.getState().setNoteVelocity(note.id, newVel);
                        setInspectorVelocity(newVel);
                      }}
                      className="w-12 bg-studio-panel border border-studio-line rounded px-1 py-0.5 text-studio-text text-center font-mono"
                    />
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Articulation */}
          {selectedNoteIds.size > 0 && (
            <div className="p-3 border-t border-studio-line">
              <div className="text-studio-text-mid font-bold mb-2">Articulation</div>
              <select
                value={(() => {
                  const clipData = getCurrentClip();
                  const note = clipData?.notes.find(n => selectedNoteIds.has(n.id));
                  return note?.articulationId ?? 0;
                })()}
                onChange={(e) => setSelectedNotesArticulation(Number(e.target.value))}
                className="w-full bg-studio-panel border border-studio-line rounded shadow-inner px-1 py-0.5 text-studio-text"
              >
                <option value={0}>Normal</option>
                <option value={1}>Staccato</option>
                <option value={2}>Staccatissimo</option>
                <option value={3}>Marcato</option>
                <option value={4}>Tenuto</option>
                <option value={5}>Legato</option>
                <option value={6}>Pizzicato</option>
                <option value={7}>Tremolo</option>
                <option value={8}>Trill</option>
                <option value={9}>Harmonics</option>
                <option value={10}>Mute</option>
                <option value={11}>Open</option>
                <option value={12}>Flutter</option>
                <option value={13}>Sul Pont</option>
                <option value={14}>Sul Tasto</option>
                <option value={15}>Col Legno</option>
              </select>
            </div>
          )}

          {/* Mute Controls */}
          {selectedNoteIds.size > 0 && (
            <div className="p-3 border-t border-studio-line">
              <div className="flex gap-2">
                <button
                  onClick={muteSelectedNotes}
                  className="flex-1 px-2 py-1 bg-studio-control hover:bg-studio-raised rounded border border-studio-line text-studio-text text-[10px]"
                >
                  Mute
                </button>
                <button
                  onClick={unmuteSelectedNotes}
                  className="flex-1 px-2 py-1 bg-studio-control hover:bg-studio-raised rounded border border-studio-line text-studio-text text-[10px]"
                >
                  Unmute
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Main area: keyboard + grid column ── */}
        <div className="flex flex-1 overflow-hidden relative">

        {/* Piano keyboard — spans only the grid area, not the splitter or event editor */}
        <div className="flex flex-col shrink-0" style={{ width: KEYBOARD_WIDTH }}>
          {/* Spacer to match the ruler height */}
          <div className="h-6 shrink-0 bg-studio-control border-b border-studio-line border-r border-studio-line" />
          
          <div style={{ height: gridHeight, overflow: 'hidden' }}>
            <PianoKeyboard
              lowPitch={lowPitch}
              highPitch={highPitch}
              maxVisiblePitch={viewportState.maxVisiblePitch}
              pixelPerSemitone={viewportState.pixelsPerPitch}
              width={KEYBOARD_WIDTH}
              onNoteOn={onNoteOn}
              onNoteOff={onNoteOff}
              highlightedKeys={highlightedKeys}
              activeKeys={activeMidiNotes}
              keyLimitLow={scaleQuantizeEnabled ? scaleKey : undefined}
              keyLimitHigh={scaleQuantizeEnabled ? (scaleKey + 11) % 12 + 12 * Math.floor((highPitch - scaleKey) / 12) : undefined}
              showKeyLimits={scaleQuantizeEnabled}
            />
          </div>
          {/* Keyboard column fills the splitter + event editor rows with a plain bg */}
          {showVelocityLane && (
            <>
              <div style={{ height: SPLITTER_H }} className="bg-studio-panel border-y border-studio-line shrink-0" />
              <div className="flex-1 bg-studio-sunken border-r border-studio-line" />
            </>
          )}
        </div>

        {/* ── Right column: grid canvas + splitter + event editor ── */}
        <div className="flex-1 flex flex-col relative overflow-hidden">

          {/* ── Ruler ── */}
          <div className="h-6 shrink-0 bg-studio-control border-b border-studio-line">
            <canvas
              ref={rulerCanvasRef}
              className="w-full h-full pointer-events-auto cursor-pointer"
              onMouseDown={handleRulerMouseDown}
            />
          </div>

          {/* Grid canvas area */}
          <div
            className="relative overflow-hidden shrink-0"
            style={{ height: gridHeight }}
            onWheel={(e) => pianoRollNavigation.queueInput(e.nativeEvent)}
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onContextMenu={(e) => e.preventDefault()}
          >
            <canvas
              ref={canvasRef}
              className="absolute inset-0 pointer-events-none"
              style={{ zIndex: 10 }}
            />

            {/* Vertical scrollbar */}
            <div
              className="absolute right-0 top-0 w-3 bg-studio-sunken/50 hover:bg-studio-panel/80 transition-colors z-20 pointer-events-auto"
              style={{ height: gridHeight }}
            >
              <div
                className="absolute w-full bg-studio-control rounded-full cursor-pointer hover:bg-studio-control active:bg-white/[0.14]"
                style={{ top: `${thumbTop}px`, height: `${scrollbarThumbHeight}px` }}
                onMouseDown={handleScrollbarDrag}
              />
            </div>
          </div>

          {/* ── Splitter handle ── */}
          {showVelocityLane && (
            <>
              <div
                className="group relative shrink-0 z-30 cursor-ns-resize select-none"
                style={{ height: SPLITTER_H }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  const startY = e.clientY;
                  const startOffset = splitterOffset;
                  console.log('[Splitter] mousedown startY:', startY, 'gridHeight:', gridHeight, 'noteMinusOnePos:', noteMinusOnePos, 'editorHeight:', editorHeight);
                  const onMove = (me: MouseEvent) => {
                    const delta = me.clientY - startY;
                    console.log('[Splitter] drag delta:', delta, 'clientY:', me.clientY);
                    setSplitterOffset(Math.max(-noteMinusOnePos + 40, Math.min(height - 28 - noteMinusOnePos, startOffset + delta)));
                  };
                  const onUp = () => {
                    console.log('[Splitter] mouseup');
                    window.removeEventListener('mousemove', onMove);
                    window.removeEventListener('mouseup', onUp);
                  };
                  window.addEventListener('mousemove', onMove);
                  window.addEventListener('mouseup', onUp);
                }}
              >
                {/* Track background */}
                <div className="absolute inset-0 bg-studio-panel group-hover:bg-studio-raised transition-colors" />
                {/* Top accent line */}
                <div className="absolute top-0 left-0 right-0 h-px bg-studio-control group-hover:bg-accent-cyan transition-colors" />
                {/* Bottom accent line */}
                <div className="absolute bottom-0 left-0 right-0 h-px bg-studio-raised group-hover:bg-accent-cyan/40 transition-colors" />
                {/* Centre grip dots */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="flex gap-[3px]">
                    {[0, 1, 2, 3, 4].map(i => (
                      <div
                        key={i}
                        className="w-[14px] h-[1.5px] rounded-full bg-studio-control group-hover:bg-accent-cyan transition-colors"
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* ── Event Editor ── */}
              <EventEditor
                notes={clip.notes}
                selectedNoteIds={selectedNoteIds}
                startBeat={viewportState.startBeat}
                endBeat={viewportState.startBeat + cw / viewportState.pixelsPerBeat}
                pixelPerBeat={viewportState.pixelsPerBeat}
                gridDivision={gridSettings.division}
                height={editorHeight}
                onVelocityChange={(noteId, velocity) => useMidiStore.getState().setNoteVelocity(noteId, velocity)}
                onVelocityChangeSelected={(velocity) => useMidiStore.getState().setSelectedNotesVelocity(velocity)}
                onPanChange={(noteId, value) => useMidiStore.getState().setNoteCCValue(noteId, 10, value)}
                onPanChangeSelected={(value) => {
                  const s = useMidiStore.getState();
                  for (const id of s.selectedNoteIds) s.setNoteCCValue(id, 10, value);
                }}
                onPitchBendChange={(noteId, value) => useMidiStore.getState().setNoteCCValue(noteId, 128, value)}
                onPitchBendChangeSelected={(value) => {
                  const s = useMidiStore.getState();
                  for (const id of s.selectedNoteIds) s.setNoteCCValue(id, 128, value);
                }}
                onCCChange={(noteId, controller, value) => useMidiStore.getState().setNoteCCValue(noteId, controller, value)}
                onCCChangeSelected={(controller, value) => {
                  const s = useMidiStore.getState();
                  for (const id of s.selectedNoteIds) s.setNoteCCValue(id, controller, value);
                }}
                noteCCValues={useMidiStore.getState().noteCCValues}
                color="#22d3ee"
              />
            </>
          )}
        </div>
        </div>
      </div>
      )}

      <StepInputKeyboard
        isOpen={showStepKeyboard}
        onClose={() => setShowStepKeyboard(false)}
        onNoteInput={(pitch: number, velocity: number, duration: number) => {
          const s = useMidiStore.getState();
          s.addNote(pitch, s.currentBeat, duration, velocity);
        }}
      />

      <NoteEditPopover
        note={editPopoverNote?.note ?? null}
        position={editPopoverNote?.position ?? null}
        isOpen={editPopoverNote !== null}
        onClose={() => setEditPopoverNote(null)}
        onUpdateNote={(id: string, updates: Partial<import('../../engine/midi/types').MidiNote>) => {
          const s = useMidiStore.getState();
          if (updates.pitch !== undefined) {
            s.moveNote(id, 0, updates.pitch - (editPopoverNote?.note.pitch ?? 0));
          }
          if (updates.velocity !== undefined) {
            s.setNoteVelocity(id, updates.velocity);
          }
          if (updates.duration !== undefined) {
            s.resizeNote(id, updates.duration);
          }
          if (updates.startBeat !== undefined) {
            s.moveNote(id, updates.startBeat - (editPopoverNote?.note.startBeat ?? 0), 0);
          }
        }}
        onDeleteNote={(id: string) => deleteNote(id)}
      />

      <GoToBeatDialog
        isOpen={showGoToBeatDialog}
        onClose={() => setShowGoToBeatDialog(false)}
        onGoToBeat={(beat) => { seekToBeat(beat); scrollToBeat(beat); }}
        currentBeat={currentBeat}
      />
      <LocateNoteDialog
        isOpen={showLocateNoteDialog}
        onClose={() => setShowLocateNoteDialog(false)}
        onLocateNote={(pitch, beat) => {
          if (beat !== undefined) {
            seekToBeat(beat);
            scrollToBeat(beat);
          }
          // Scroll to the pitch
          const { zoomLevel } = useMidiStore.getState();
          useMidiStore.getState().setScrollPosition({
            y: (127 - pitch) * zoomLevel.y - height / 2
          });
        }}
        currentClip={clip}
      />
    </div>
  );
});

export default PianoRoll;
