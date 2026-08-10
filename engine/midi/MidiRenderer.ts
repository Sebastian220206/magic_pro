import { RendererContract } from '../rendering/contracts/RendererScheduler';
import { ViewportState } from '../navigation/types';
import { BoundingBox } from '../rendering/invalidation/DirtyRegionManager';
import { globalSpatialNoteCache } from './cache/SpatialNoteCache';
import { useMidiStore } from '@/store/midiStore';
import { getScalePitches, ScaleType } from './types';

/** Ghost (other-clip) notes, drawn behind the editable ones at low alpha. */
export const GHOST_NOTE_COLOR = '#4b5f73';
/** A muted note keeps its shape but loses its colour. */
export const MUTED_NOTE_COLOR = '#475b6e';
/** Selection stays red — it must never be confused with a velocity band. */
export const SELECTED_NOTE_COLOR = '#EF4444';

/**
 * Velocity ramp, cool to warm. Deliberately starts at violet rather than red:
 * red is the selection colour, and a soft note used to be indistinguishable
 * from a selected one.
 */
function velocityToColor(velocity: number): string {
  if (velocity < 31) return '#a78bfa';      // Soft: violet
  if (velocity < 64) return '#22d3ee';      // Med-low: cyan
  if (velocity < 96) return '#4ade80';      // Med-high: green
  return '#fb923c';                          // Hard: amber
}

/**
 * Decide how a single note is painted.
 *
 * `baseColor` is null when the clip carries no colour of its own — that is the
 * only signal that velocity colouring applies. It used to be inferred by
 * comparing against the literal `#3B82F6`, which meant a clip the user had
 * deliberately coloured blue was silently treated as uncoloured.
 */
export function resolveNoteAppearance(opts: {
  velocity: number;
  baseColor: string | null;
  isGhost: boolean;
  isSelected: boolean;
  isMuted: boolean;
}): { color: string; velocityGradient: boolean } {
  const { velocity, baseColor, isGhost, isSelected, isMuted } = opts;

  let normal: string;
  if (isGhost) normal = GHOST_NOTE_COLOR;
  else if (baseColor) normal = baseColor;
  else normal = velocityToColor(velocity);

  return {
    color: isSelected ? SELECTED_NOTE_COLOR : (isMuted ? MUTED_NOTE_COLOR : normal),
    // A steeper bevel on velocity-coloured notes, so the ramp reads as depth too.
    velocityGradient: !isGhost && !baseColor,
  };
}

function darkenColor(hex: string, amount: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, (num >> 16) - amount);
  const g = Math.max(0, ((num >> 8) & 0x00FF) - amount);
  const b = Math.max(0, (num & 0x0000FF) - amount);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

function lightenColor(hex: string, amount: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, (num >> 16) + amount);
  const g = Math.min(255, ((num >> 8) & 0x00FF) + amount);
  const b = Math.min(255, (num & 0x0000FF) + amount);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

export class MidiRenderer implements RendererContract {
  public priority = 25; // Draws on top of grid (10), below overlays (40)

  constructor(private ctx: CanvasRenderingContext2D) {}

  public renderFull(ctx: CanvasRenderingContext2D, viewport: Readonly<ViewportState>) {
    const state = useMidiStore.getState();
    const clip = state.getCurrentClip();
    if (!clip || !clip.notes) return;

    const endBeat = viewport.startBeat + (ctx.canvas.width / viewport.pixelsPerBeat);
    const minPitch = viewport.maxVisiblePitch - (ctx.canvas.height / viewport.pixelsPerPitch);
    
    // O(1) query
    let visibleNotes = globalSpatialNoteCache.getNotesInRegion(viewport.startBeat, endBeat, minPitch, viewport.maxVisiblePitch);

    // Fold mode: only show notes that are on the current scale
    if (state.showFoldMode) {
      const scalePitches = getScalePitches(state.scaleKey, state.scaleType as ScaleType);
      const pitchSet = new Set(scalePitches);
      visibleNotes = visibleNotes.filter(n => pitchSet.has(n.pitch % 12));
    }

    // Render Ghost Notes first
    const ghostNotes = Object.values(state.activeGhostNotes).filter(n => 
      n.startBeat < endBeat && (n.startBeat + n.duration) > viewport.startBeat &&
      n.pitch >= minPitch && n.pitch <= viewport.maxVisiblePitch
    );
    if (ghostNotes.length > 0) {
      this.drawNotes(ctx, ghostNotes, viewport, new Set(), null, true, state.channelFilter, state.noteCCValues);
    }

    this.drawNotes(ctx, visibleNotes, viewport, state.selectedNoteIds, clip.color ?? null, false, state.channelFilter, state.noteCCValues);
  }

  public renderRegion(ctx: CanvasRenderingContext2D, viewport: Readonly<ViewportState>, region: BoundingBox) {
    const state = useMidiStore.getState();
    const clip = state.getCurrentClip();
    if (!clip || !clip.notes) return;

    const startBeat = viewport.startBeat + (region.x / viewport.pixelsPerBeat);
    const endBeat = viewport.startBeat + ((region.x + region.width) / viewport.pixelsPerBeat);
    
    const maxPitch = viewport.maxVisiblePitch - (region.y / viewport.pixelsPerPitch);
    const minPitch = viewport.maxVisiblePitch - ((region.y + region.height) / viewport.pixelsPerPitch);

    const regionNotes = globalSpatialNoteCache.getNotesInRegion(startBeat, endBeat, minPitch, maxPitch);

    this.drawNotes(ctx, regionNotes, viewport, state.selectedNoteIds, clip.color ?? null, false, state.channelFilter, state.noteCCValues);
  }

  private drawNotes(ctx: CanvasRenderingContext2D, notes: any[], viewport: Readonly<ViewportState>, selectedIds: Set<string>, baseColor: string | null, isGhost: boolean, channelFilter: number | null = null, noteCCValues: Record<string, Record<number, number>> = {}) {
    const { pixelsPerBeat, startBeat, maxVisiblePitch, pixelsPerPitch } = viewport;

    ctx.save();
    
    // Filter notes by channel if filter is set
    const filteredNotes = channelFilter !== null 
      ? notes.filter(note => note.channel === channelFilter)
      : notes;
    
    // Pre-compute overlap detection for non-ghost notes
    const overlappingNotes = new Set<string>();
    if (!isGhost) {
      for (let i = 0; i < filteredNotes.length; i++) {
        const noteA = filteredNotes[i];
        const endA = noteA.startBeat + noteA.duration;
        for (let j = i + 1; j < filteredNotes.length; j++) {
          const noteB = filteredNotes[j];
          const endB = noteB.startBeat + noteB.duration;
          // Check time overlap AND same pitch
          if (noteA.pitch === noteB.pitch && noteA.startBeat < endB && endA > noteB.startBeat) {
            overlappingNotes.add(noteA.id);
            overlappingNotes.add(noteB.id);
          }
        }
      }
    }

    // Build a map of notes by pitch for slide/portamento connector lines
    const notesByPitch = new Map<number, any[]>();
    for (const note of filteredNotes) {
      if (!notesByPitch.has(note.pitch)) {
        notesByPitch.set(note.pitch, []);
      }
      notesByPitch.get(note.pitch)!.push(note);
    }
    // Sort notes by startBeat for each pitch
    for (const [pitch, pitchNotes] of notesByPitch) {
      pitchNotes.sort((a, b) => a.startBeat - b.startBeat);
    }

    for (const note of filteredNotes) {
      const x = (note.startBeat - startBeat) * pixelsPerBeat;
      const y = (maxVisiblePitch - note.pitch) * pixelsPerPitch;
      const w = note.duration * pixelsPerBeat;
      const h = pixelsPerPitch - 1;

      const isSelected = selectedIds.has(note.id);
      const isMuted = note.muted;
      const isOverlapping = overlappingNotes.has(note.id);
      
      const { color: renderColor, velocityGradient } = resolveNoteAppearance({
        velocity: note.velocity,
        baseColor,
        isGhost,
        isSelected,
        isMuted,
      });

      ctx.globalAlpha = isGhost ? 0.3 : 1.0;

      // Subtle vertical bevel, steeper when the colour is carrying velocity.
      const gradient = ctx.createLinearGradient(x, y, x, y + h);
      const bevel = velocityGradient ? 30 : 20;
      gradient.addColorStop(0, lightenColor(renderColor, bevel));
      gradient.addColorStop(1, darkenColor(renderColor, bevel));
      
      ctx.fillStyle = gradient;
      
      // Shadow / Glow
      if (isSelected) {
        ctx.shadowColor = '#EF4444';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
      } else {
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 3;
        ctx.shadowOffsetY = 2;
      }

      ctx.beginPath();
      // Tight rounded corners
      ctx.roundRect(x, y, Math.max(2, w), h, 3);
      ctx.fill();
      
      // Turn off shadow for inner drawing
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
      
      // Highlight top edge
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + 3, y + 1);
      ctx.lineTo(x + Math.max(2, w) - 3, y + 1);
      ctx.stroke();

      // Border around the note
      ctx.strokeStyle = isSelected ? '#FCA5A5' : (isGhost ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.75)');
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(x, y, Math.max(2, w), h, 3);
      ctx.stroke();

      // Overlap indicator - red bar on left edge
      if (!isGhost && isOverlapping && w > 4) {
        ctx.fillStyle = 'rgba(239, 68, 68, 0.6)';
        ctx.fillRect(x, y, 3, h);
      }

      if (!isGhost) {
        // Slide indicator (triangle on the right)
        if (note.slide && w > 10) {
          ctx.fillStyle = 'rgba(0,0,0,0.4)';
          ctx.beginPath();
          ctx.moveTo(x + w - 2, y + 2);
          ctx.lineTo(x + w - 2, y + h - 2);
          ctx.lineTo(x + w - 8, y + h - 2);
          ctx.fill();
        }
        
        // Portamento indicator (slash)
        if (note.portamento && w > 10) {
          ctx.strokeStyle = 'rgba(0,0,0,0.5)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(x + w - 4, y + 2);
          ctx.lineTo(x + w - 10, y + h - 2);
          ctx.stroke();
        }

        // Velocity indicator (dark bar inside the note at the bottom)
        if (h > 6 && w > 6 && !note.slide && !note.portamento) {
          const velRatio = note.velocity / 127;
          const velWidth = Math.max(1, (w - 4) * velRatio);
          ctx.fillStyle = 'rgba(0,0,0,0.3)';
          ctx.fillRect(x + 2, y + (h / 2) - 1, velWidth, 2);
        }

        // Velocity bar overlay (vertical bar on left edge of note - Logic Pro style)
        if (w > 8 && h > 4) {
          const velRatio = note.velocity / 127;
          const barHeight = Math.max(2, h * velRatio);
          const barWidth = Math.min(4, w * 0.15);
          ctx.fillStyle = 'rgba(255,255,255,0.6)';
          ctx.fillRect(x + 1, y + h - barHeight, barWidth, barHeight);
        }

        // Feature 26: Pitch Bend indicator (small arc/curve on the note)
        const ccValues = noteCCValues[note.id] || {};
        const pitchBendValue = ccValues[128]; // Pitch bend controller
        if (pitchBendValue !== undefined && w > 12) {
          const bendAmount = (pitchBendValue - 8192) / 8192; // -1 to 1
          if (Math.abs(bendAmount) > 0.01) {
            ctx.strokeStyle = bendAmount > 0 ? 'rgba(34, 197, 94, 0.8)' : 'rgba(239, 68, 68, 0.8)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            const centerX = x + w / 2;
            const centerY = y + h / 2;
            const radius = Math.min(w, h) * 0.3;
            ctx.arc(centerX, centerY, radius, -Math.PI / 2, -Math.PI / 2 + bendAmount * Math.PI);
            ctx.stroke();
          }
        }

        // Feature 26: Modulation Wheel indicator (small wave on the note)
        const modWheelValue = ccValues[1]; // Modulation wheel controller
        if (modWheelValue !== undefined && modWheelValue > 0 && w > 12) {
          ctx.strokeStyle = 'rgba(59, 130, 246, 0.6)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          const waveCount = 3;
          const waveHeight = h * 0.3;
          for (let i = 0; i <= waveCount; i++) {
            const wx = x + (w / waveCount) * i;
            const wy = y + h - waveHeight * Math.sin((i / waveCount) * Math.PI * 2) * (modWheelValue / 127);
            if (i === 0) ctx.moveTo(wx, wy);
            else ctx.lineTo(wx, wy);
          }
          ctx.stroke();
        }

        // Feature 27: Slide/Portamento connector lines to next note on same pitch
        const pitchNotes = notesByPitch.get(note.pitch) || [];
        const noteIndex = pitchNotes.findIndex(n => n.id === note.id);
        if (noteIndex >= 0 && noteIndex < pitchNotes.length - 1) {
          const nextNote = pitchNotes[noteIndex + 1];
          const hasSlide = note.slide || nextNote.slide;
          const hasPortamento = note.portamento || nextNote.portamento;
          
          if ((hasSlide || hasPortamento) && w > 4) {
            const nextX = (nextNote.startBeat - startBeat) * pixelsPerBeat;
            const nextY = (maxVisiblePitch - nextNote.pitch) * pixelsPerPitch;
            const nextW = nextNote.duration * pixelsPerBeat;
            
            // Draw connector line from right edge of current note to left edge of next note
            ctx.strokeStyle = hasSlide ? 'rgba(34, 197, 94, 0.6)' : 'rgba(249, 115, 22, 0.6)';
            ctx.lineWidth = 2;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(x + w, y + h / 2);
            ctx.lineTo(nextX, nextY + h / 2);
            ctx.stroke();
            ctx.setLineDash([]);
            
            // Draw small arrowhead at the end
            const arrowSize = 6;
            const angle = Math.atan2((nextY + h / 2) - (y + h / 2), nextX - (x + w));
            ctx.fillStyle = ctx.strokeStyle;
            ctx.beginPath();
            ctx.moveTo(nextX, nextY + h / 2);
            ctx.lineTo(nextX - arrowSize * Math.cos(angle - Math.PI / 6), nextY + h / 2 - arrowSize * Math.sin(angle - Math.PI / 6));
            ctx.lineTo(nextX - arrowSize * Math.cos(angle + Math.PI / 6), nextY + h / 2 - arrowSize * Math.sin(angle + Math.PI / 6));
            ctx.fill();
          }
        }
      }
    }

    ctx.globalAlpha = 1.0;
    ctx.restore();
  }
}
