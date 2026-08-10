'use client';

import React, { useMemo, memo, useCallback, useState, useRef, useEffect } from 'react';
import { MidiNote } from '../../engine/midi/types';
import { ChevronDown, ZoomIn, ZoomOut } from 'lucide-react';

export type EventEditorTarget = 'velocity' | 'pan' | 'pitchbend' | 'cc1' | 'cc2' | 'cc3' | 'cc4' | 'cc5' | 'cc6' | 'cc7' | 'cc8' | 'cc9' | 'cc10' | 'cc11';

interface EventEditorProps {
  notes: MidiNote[];
  selectedNoteIds: Set<string>;
  startBeat: number;
  endBeat: number;
  pixelPerBeat: number;
  gridDivision: number;
  height: number;
  onVelocityChange: (noteId: string, velocity: number) => void;
  onVelocityChangeSelected: (velocity: number) => void;
  onPanChange?: (noteId: string, value: number) => void;
  onPanChangeSelected?: (value: number) => void;
  onPitchBendChange?: (noteId: string, value: number) => void;
  onPitchBendChangeSelected?: (value: number) => void;
  onCCChange?: (noteId: string, controller: number, value: number) => void;
  onCCChangeSelected?: (controller: number, value: number) => void;
  noteCCValues?: Record<string, Record<number, number>>;
  color: string;
}

const CC_OPTIONS = [
  { value: 1, label: 'CC1 (Mod Wheel)' },
  { value: 2, label: 'CC2 (Breath)' },
  { value: 4, label: 'CC4 (Foot)' },
  { value: 5, label: 'CC5 (Porta Time)' },
  { value: 7, label: 'CC7 (Volume)' },
  { value: 8, label: 'CC8 (Balance)' },
  { value: 10, label: 'CC10 (Pan)' },
  { value: 11, label: 'CC11 (Expression)' },
];

function getCCNumber(target: EventEditorTarget): number | null {
  const m = target.match(/^cc(\d+)$/);
  return m ? parseInt(m[1]) : null;
}

function getNoteValue(note: MidiNote, target: EventEditorTarget, noteCCValues: Record<string, Record<number, number>>): number {
  if (target === 'velocity') return note.velocity;
  if (target === 'pan') return noteCCValues[note.id]?.[10] ?? 64;
  if (target === 'pitchbend') return noteCCValues[note.id]?.[128] ?? 64;
  const ccNum = getCCNumber(target);
  if (ccNum !== null) return noteCCValues[note.id]?.[ccNum] ?? 0;
  return 0;
}

export const EventEditor = memo(function EventEditor({
  notes,
  selectedNoteIds,
  startBeat,
  endBeat,
  pixelPerBeat,
  gridDivision,
  height,
  onVelocityChange,
  onVelocityChangeSelected,
  onPanChange,
  onPanChangeSelected,
  onPitchBendChange,
  onPitchBendChangeSelected,
  onCCChange,
  onCCChangeSelected,
  noteCCValues = {},
  color,
}: EventEditorProps) {
  const [target, setTarget] = useState<EventEditorTarget>('velocity');
  const [dragging, setDragging] = useState(false);
  const [selectedCC, setSelectedCC] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);
  const gridCanvasRef = useRef<HTMLCanvasElement>(null);

  const HEADER_H = 24;
  const contentHeight = height - HEADER_H;

  // ── Grid canvas ──────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = gridCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.offsetWidth || 1;
    const h = canvas.offsetHeight || 1;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    const subdivSize = 4 / gridDivision;
    const firstSub = Math.floor(startBeat / subdivSize) * subdivSize;

    for (let beat = firstSub; beat <= endBeat + subdivSize; beat += subdivSize) {
      const x = Math.round((beat - startBeat) * pixelPerBeat);
      if (x < 0 || x > w + 1) continue;

      const isBar  = Math.abs(beat % 4) < 0.0001 || Math.abs((beat % 4) - 4) < 0.0001;
      const isBeat = !isBar && Math.abs(beat % 1) < 0.0001;

      ctx.beginPath();
      if (isBar) {
        ctx.strokeStyle = 'rgba(255,255,255,0.18)';
        ctx.lineWidth = 1.5;
      } else if (isBeat) {
        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        ctx.lineWidth = 1;
      } else {
        ctx.strokeStyle = 'rgba(255,255,255,0.03)';
        ctx.lineWidth = 0.5;
      }
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }

    for (const ratio of [0.25, 0.5, 0.75]) {
      const y = Math.round(h * (1 - ratio));
      ctx.beginPath();
      if (ratio === 0.5) {
        ctx.strokeStyle = 'rgba(255,255,255,0.12)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
      } else {
        ctx.strokeStyle = 'rgba(255,255,255,0.05)';
        ctx.lineWidth = 0.5;
        ctx.setLineDash([]);
      }
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    ctx.setLineDash([]);

  }, [startBeat, endBeat, pixelPerBeat, gridDivision, contentHeight]);

  // ── Visible notes ────────────────────────────────────────────────────────
  const visibleNotes = useMemo(() =>
    notes.filter(n => n.startBeat >= startBeat && n.startBeat < endBeat),
    [notes, startBeat, endBeat]
  );

  // ── Drag handler ─────────────────────────────────────────────────────────
  const handleMouseDown = useCallback((e: React.MouseEvent, note: MidiNote) => {
    e.stopPropagation();
    setDragging(true);

    const startY = e.clientY;
    const startVal = getNoteValue(note, target, noteCCValues);

    const onMove = (me: MouseEvent) => {
      const delta = startY - me.clientY;
      const v = Math.max(0, Math.min(127, startVal + Math.round(delta / 2)));

      if (target === 'velocity') {
        if (selectedNoteIds.has(note.id)) onVelocityChangeSelected(v);
        else onVelocityChange(note.id, v);
      } else if (target === 'pan') {
        if (selectedNoteIds.has(note.id)) onPanChangeSelected?.(v);
        else onPanChange?.(note.id, v);
      } else if (target === 'pitchbend') {
        if (selectedNoteIds.has(note.id)) onPitchBendChangeSelected?.(v);
        else onPitchBendChange?.(note.id, v);
      } else {
        const ccNum = getCCNumber(target);
        if (ccNum !== null) {
          if (selectedNoteIds.has(note.id)) onCCChangeSelected?.(ccNum, v);
          else onCCChange?.(note.id, ccNum, v);
        }
      }
    };
    const onUp = () => {
      setDragging(false);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [selectedNoteIds, target, noteCCValues, onVelocityChange, onVelocityChangeSelected, onPanChange, onPanChangeSelected, onPitchBendChange, onPitchBendChangeSelected, onCCChange, onCCChangeSelected]);

  // ── Target label ─────────────────────────────────────────────────────────
  const targetLabel = useMemo(() => {
    if (target === 'velocity') return 'Velocity';
    if (target === 'pan') return 'Pan';
    if (target === 'pitchbend') return 'Pitch Bend';
    const ccNum = getCCNumber(target);
    return ccNum !== null ? `CC${ccNum}` : target;
  }, [target]);

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div
      ref={containerRef}
      className="relative flex flex-col bg-studio-sunken border-t border-studio-line overflow-hidden shrink-0"
      style={{ height }}
    >
      {/* Header */}
      <div className="h-6 shrink-0 bg-studio-panel border-b border-studio-line flex items-center px-2 gap-2 z-20">
        <div className="flex items-center gap-1 text-xs text-studio-text hover:text-white cursor-pointer relative">
          <span className="font-medium">{targetLabel}</span>
          <ChevronDown className="w-3 h-3 opacity-60" />
          <select
            value={target}
            onChange={(e) => {
              const val = e.target.value as EventEditorTarget;
              setTarget(val);
              if (val.startsWith('cc')) {
                const num = getCCNumber(val);
                if (num !== null) setSelectedCC(num);
              }
            }}
            className="absolute inset-0 opacity-0 cursor-pointer"
          >
            <option value="velocity">Velocity</option>
            <option value="pan">Pan</option>
            <option value="pitchbend">Pitch Bend</option>
            {CC_OPTIONS.map(cc => (
              <option key={cc.value} value={`cc${cc.value}`}>{cc.label}</option>
            ))}
          </select>
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-1 text-studio-text-dim">
          <ZoomOut className="w-3 h-3 hover:text-white cursor-pointer" />
          <ZoomIn  className="w-3 h-3 hover:text-white cursor-pointer" />
        </div>
      </div>

      {/* Content */}
      <div className="relative flex-1 overflow-hidden">
        <canvas
          ref={gridCanvasRef}
          className="absolute inset-0 w-full h-full pointer-events-none"
          style={{ zIndex: 1 }}
        />

        {target === 'velocity' ? (
          <div className="absolute inset-0" style={{ zIndex: 2 }}>
            {visibleNotes.map(note => {
              const x       = (note.startBeat - startBeat) * pixelPerBeat;
              const barH    = Math.max(2, (note.velocity / 127) * contentHeight);
              const barW    = Math.max(6, note.duration * pixelPerBeat);
              const isSel   = selectedNoteIds.has(note.id);
              const barColor = isSel ? color : `${color}88`;

              return (
                <div
                  key={note.id}
                  className={`absolute bottom-0 cursor-ns-resize ${dragging ? 'pointer-events-none' : ''}`}
                  style={{ left: x, width: barW, height: barH }}
                  onMouseDown={(e) => handleMouseDown(e, note)}
                >
                  <div
                    className="absolute inset-0 rounded-t-sm"
                    style={{ background: `linear-gradient(to top, ${barColor}55, ${barColor})` }}
                  />
                  <div
                    className="absolute top-0 left-0 right-0 h-[3px] rounded-t-sm"
                    style={{ backgroundColor: isSel ? '#ffffff' : color }}
                  />
                  {isSel && (
                    <div className="absolute inset-0 ring-1 ring-white/50 rounded-t-sm pointer-events-none" />
                  )}
                  {barH > 22 && barW > 12 && (
                    <span className="absolute top-1.5 left-0 right-0 text-center text-[9px] text-white/70 font-semibold select-none leading-none">
                      {note.velocity}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        ) : target === 'pan' ? (
          <div className="absolute inset-0" style={{ zIndex: 2 }}>
            {(() => {
              const centerY = contentHeight / 2;
              return (<>
                {visibleNotes.map(note => {
              const x     = (note.startBeat - startBeat) * pixelPerBeat;
              const barW  = Math.max(6, note.duration * pixelPerBeat);
              const isSel = selectedNoteIds.has(note.id);
              const panVal = noteCCValues[note.id]?.[10] ?? 64;
              const centerY = contentHeight / 2;
              const barH = Math.max(2, (panVal / 127) * contentHeight);
              const barTop = contentHeight - barH;

              return (
                <div
                  key={note.id}
                  className={`absolute cursor-ns-resize ${dragging ? 'pointer-events-none' : ''}`}
                  style={{ left: x, width: barW, top: barTop, height: barH }}
                  onMouseDown={(e) => handleMouseDown(e, note)}
                >
                  <div
                    className="absolute inset-0 rounded-t-sm"
                    style={{ background: `linear-gradient(to top, #f9731655, #f97316)` }}
                  />
                  <div className="absolute top-0 left-0 right-0 h-[3px] rounded-t-sm bg-orange-400" />
                  {isSel && (
                    <div className="absolute inset-0 ring-1 ring-white/50 rounded-t-sm pointer-events-none" />
                  )}
                  {barH > 22 && barW > 12 && (
                    <span className="absolute top-1.5 left-0 right-0 text-center text-[9px] text-white/70 font-semibold select-none leading-none">
                      {panVal}
                    </span>
                  )}
                </div>
              );
            })}
              {/* Center line */}
              <div
                className="absolute left-0 right-0 h-px bg-orange-500/30 pointer-events-none"
                style={{ top: centerY, zIndex: 3 }}
              />
            </>);
            })()}
          </div>
        ) : target === 'pitchbend' ? (
          <div className="absolute inset-0" style={{ zIndex: 2 }}>
            <svg className="w-full h-full pointer-events-none" style={{ position: 'absolute', inset: 0 }}>
              <polyline
                fill="none"
                stroke="#22c55e"
                strokeWidth="2"
                strokeLinejoin="round"
                points={visibleNotes
                  .sort((a, b) => a.startBeat - b.startBeat)
                  .map(n => {
                    const x = (n.startBeat - startBeat) * pixelPerBeat + Math.max(6, n.duration * pixelPerBeat) / 2;
                    const pbVal = noteCCValues[n.id]?.[128] ?? 64;
                    const y = contentHeight - (pbVal / 127) * contentHeight;
                    return `${x},${y}`;
                  })
                  .join(' ')}
              />
            </svg>
            {visibleNotes.map(note => {
              const x     = (note.startBeat - startBeat) * pixelPerBeat;
              const barW  = Math.max(6, note.duration * pixelPerBeat);
              const isSel = selectedNoteIds.has(note.id);
              const pbVal = noteCCValues[note.id]?.[128] ?? 64;
              const y = contentHeight - (pbVal / 127) * contentHeight - 6;

              return (
                <div
                  key={note.id}
                  className={`absolute cursor-ns-resize ${dragging ? 'pointer-events-none' : ''}`}
                  style={{ left: x, width: barW, top: y, height: 12 }}
                  onMouseDown={(e) => handleMouseDown(e, note)}
                >
                  <div
                    className="mx-auto w-2 h-2 rounded-full"
                    style={{ backgroundColor: isSel ? '#fff' : '#22c55e' }}
                  />
                  {isSel && (
                    <div className="absolute inset-0 ring-1 ring-white/30 rounded pointer-events-none" />
                  )}
                </div>
              );
            })}
            {/* Center line */}
            <div
              className="absolute left-0 right-0 h-px bg-green-500/30 pointer-events-none"
              style={{ top: '50%', zIndex: 3 }}
            />
          </div>
        ) : (
          <div className="absolute inset-0" style={{ zIndex: 2 }}>
            {visibleNotes.map(note => {
              const x     = (note.startBeat - startBeat) * pixelPerBeat;
              const barW  = Math.max(6, note.duration * pixelPerBeat);
              const isSel = selectedNoteIds.has(note.id);
              const ccNum = getCCNumber(target);
              const ccVal = ccNum !== null ? (noteCCValues[note.id]?.[ccNum] ?? 0) : 0;
              const barH  = Math.max(2, (ccVal / 127) * contentHeight);
              const barTop = contentHeight - barH;

              return (
                <div
                  key={note.id}
                  className={`absolute cursor-ns-resize ${dragging ? 'pointer-events-none' : ''}`}
                  style={{ left: x, width: barW, top: barTop, height: barH }}
                  onMouseDown={(e) => handleMouseDown(e, note)}
                >
                  <div
                    className="absolute inset-0 rounded-t-sm"
                    style={{ background: `linear-gradient(to top, #a855f755, #a855f7)` }}
                  />
                  <div className="absolute top-0 left-0 right-0 h-[3px] rounded-t-sm bg-purple-400" />
                  {isSel && (
                    <div className="absolute inset-0 ring-1 ring-white/50 rounded-t-sm pointer-events-none" />
                  )}
                  {barH > 22 && barW > 12 && (
                    <span className="absolute top-1.5 left-0 right-0 text-center text-[9px] text-white/70 font-semibold select-none leading-none">
                      {ccVal}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
});

export default EventEditor;