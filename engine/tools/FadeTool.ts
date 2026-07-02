import { Tool, InteractionEvent } from '@/engine/editor/types/tools';
import { SnapEngine } from '@/engine/editor/SnapEngine';
import { CoordinateSystem } from '@/engine/editor/CoordinateSystem';
import { useProjectStore } from '@/store/projectStore';
import { getFadeProcessor } from '@/engine/audio/FadeProcessor';
import { audioEngine } from '@/engine/AudioEngineAdapter';
import { FadeCurveType, calculateFadeInGain, calculateFadeOutGain } from '@/engine/audio/FadeEnvelope';

type FadeToolState =
  | 'idle'
  | 'hoverFadeIn'
  | 'hoverFadeOut'
  | 'hoverCrossfade'
  | 'draggingFadeIn'
  | 'draggingFadeOut'
  | 'draggingCrossfade';

interface HitResult {
  clipId: string;
  type: 'fadeIn' | 'fadeOut' | 'body';
  distance: number;
}

const FADE_HANDLE_THRESHOLD = 6;

export class FadeTool implements Tool {
  readonly id = 'fade';

  private state: FadeToolState = 'idle';
  private hoveredClipId: string | null = null;
  private hoveredType: 'fadeIn' | 'fadeOut' | null = null;
  private dragStartBeat = 0;
  private originalFadeInDuration = 0;
  private originalFadeOutDuration = 0;
  private dragClipId: string | null = null;
  private dragType: 'fadeIn' | 'fadeOut' | null = null;

  private rafId: number | null = null;
  private pendingPointerMove: InteractionEvent | null = null;

  constructor(
    private snapEngine: SnapEngine,
    private coordinateSystem: CoordinateSystem
  ) {}

  get cursor(): string {
    switch (this.state) {
      case 'hoverFadeIn':
      case 'draggingFadeIn':
        return 'w-resize';
      case 'hoverFadeOut':
      case 'draggingFadeOut':
        return 'e-resize';
      case 'hoverCrossfade':
      case 'draggingCrossfade':
        return 'crosshair';
      default:
        return 'default';
    }
  }

  onPointerDown(event: InteractionEvent) {
    if (this.state === 'draggingFadeIn' || this.state === 'draggingFadeOut') return;

    const hit = this.hitTest(event);
    if (!hit || hit.type === 'body') return;

    const store = useProjectStore.getState();
    const clip = store.clips.find(c => c.id === hit.clipId);
    if (!clip) return;

    store.saveHistorySnapshot();

    this.dragClipId = hit.clipId;
    this.dragType = hit.type;
    this.dragStartBeat = event.editorPoint.beat;
    this.originalFadeInDuration = clip.fadeIn.duration;
    this.originalFadeOutDuration = clip.fadeOut.duration;

    if (hit.type === 'fadeIn') {
      this.transitionTo('draggingFadeIn');
    } else {
      this.transitionTo('draggingFadeOut');
    }
  }

  onPointerMove(event: InteractionEvent) {
    this.pendingPointerMove = event;

    if (!this.rafId) {
      this.rafId = requestAnimationFrame(() => {
        this.rafId = null;
        this.processPointerMove(this.pendingPointerMove!);
        this.pendingPointerMove = null;
      });
    }
  }

  private processPointerMove(event: InteractionEvent) {
    if (this.state === 'draggingFadeIn' || this.state === 'draggingFadeOut') {
      this.updateFadeDrag(event);
      return;
    }

    const hit = this.hitTest(event);
    if (hit) {
      if (hit.type === 'fadeIn') {
        this.hoveredClipId = hit.clipId;
        this.hoveredType = 'fadeIn';
        this.transitionTo('hoverFadeIn');
      } else if (hit.type === 'fadeOut') {
        this.hoveredClipId = hit.clipId;
        this.hoveredType = 'fadeOut';
        this.transitionTo('hoverFadeOut');
      } else {
        this.checkCrossfadeHover(event);
      }
    } else {
      this.hoveredClipId = null;
      this.hoveredType = null;
      this.transitionTo('idle');
    }
  }

  onPointerUp(_event: InteractionEvent) {
    if (this.state === 'draggingFadeIn' || this.state === 'draggingFadeOut') {
      this.dragClipId = null;
      this.dragType = null;
      this.transitionTo('idle');
    }
  }

  onKeyDown(key: string) {
    if (key === 'Escape') {
      this.cancelCurrentOperation();
    }
  }

  onCancel() {
    this.cancelCurrentOperation();
  }

  handleDoubleClick(event: InteractionEvent) {
    const hit = this.hitTest(event);
    if (!hit) return;
    if (hit.type === 'body') return;

    const store = useProjectStore.getState();
    const clip = store.clips.find(c => c.id === hit.clipId);
    if (!clip) return;

    store.saveHistorySnapshot();

    if (hit.type === 'fadeIn' && clip.fadeIn.duration > 0) {
      store.updateClipFade(hit.clipId, 'in', { duration: 0, curve: clip.fadeIn.curve, gain: 1 });
      this.updateAudioFade(hit.clipId, 0, clip.fadeOut.duration, clip.fadeIn.curve, clip.fadeOut.curve);
    } else if (hit.type === 'fadeOut' && clip.fadeOut.duration > 0) {
      store.updateClipFade(hit.clipId, 'out', { duration: 0, curve: clip.fadeOut.curve, gain: 1 });
      this.updateAudioFade(hit.clipId, clip.fadeIn.duration, 0, clip.fadeIn.curve, clip.fadeOut.curve);
    }
  }

  renderOverlay(ctx: CanvasRenderingContext2D) {
    const store = useProjectStore.getState();
    const { clips, tracks, trackHeight } = store;
    const viewport = (this.coordinateSystem as any).viewport;
    const zoomX = viewport?.zoomX ?? 100;
    const zoomY = viewport?.zoomY ?? trackHeight;
    const scrollX = viewport?.scrollX ?? 0;
    const scrollY = viewport?.scrollY ?? 0;
    const yOffset = viewport?.yOffset ?? 40;

    for (const clip of clips) {
      const trackIndex = tracks.findIndex(t => t.id === clip.trackId);
      if (trackIndex < 0) continue;

      const clipStart = clip.startBeat ?? clip.start;
      const clipScreenX = clipStart * zoomX - scrollX;
      const clipWidth = Math.max(clip.duration * zoomX, 2);
      const clipScreenY = yOffset + trackIndex * zoomY - scrollY;

      ctx.save();

      if (clip.fadeIn && clip.fadeIn.duration > 0) {
        const fadePixelWidth = clip.fadeIn.duration * zoomX;
        this.drawFadeShape(ctx, clipScreenX, clipScreenY, fadePixelWidth, trackHeight, 'in', clip.fadeIn.curve as FadeCurveType);
      }

      if (clip.fadeOut && clip.fadeOut.duration > 0) {
        const fadePixelWidth = clip.fadeOut.duration * zoomX;
        this.drawFadeShape(ctx, clipScreenX + clipWidth - fadePixelWidth, clipScreenY, fadePixelWidth, trackHeight, 'out', clip.fadeOut.curve as FadeCurveType);
      }

      if (this.hoveredClipId === clip.id && this.hoveredType) {
        const fadeWidth = this.hoveredType === 'fadeIn'
          ? Math.max(16, (clip.fadeIn?.duration || 0) * zoomX)
          : Math.max(16, (clip.fadeOut?.duration || 0) * zoomX);
        const x = this.hoveredType === 'fadeIn' ? clipScreenX : clipScreenX + clipWidth - fadeWidth;
        ctx.strokeStyle = 'rgba(252, 211, 77, 0.8)';
        ctx.lineWidth = 2;
        ctx.setLineDash([3, 3]);
        ctx.strokeRect(x, clipScreenY, fadeWidth, trackHeight);
        ctx.setLineDash([]);
      }

      ctx.restore();
    }
  }

  private drawFadeShape(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    type: 'in' | 'out',
    curve: FadeCurveType
  ) {
    if (width <= 0) return;

    ctx.beginPath();
    ctx.moveTo(x, y + height);

    const steps = Math.min(Math.floor(width / 2), 32);
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const gain = type === 'in' ? calculateFadeInGain(t, curve) : calculateFadeOutGain(t, curve);
      const px = x + t * width;
      const py = y + height - gain * height;
      ctx.lineTo(px, py);
    }

    ctx.lineTo(x + width, y + height);
    ctx.closePath();

    ctx.fillStyle = type === 'in'
      ? 'rgba(96, 165, 250, 0.35)'
      : 'rgba(52, 211, 153, 0.35)';
    ctx.fill();

    ctx.strokeStyle = type === 'in'
      ? 'rgba(96, 165, 250, 0.8)'
      : 'rgba(52, 211, 153, 0.8)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  private updateFadeDrag(event: InteractionEvent) {
    if (!this.dragClipId || !this.dragType) return;

    const store = useProjectStore.getState();
    const clip = store.clips.find(c => c.id === this.dragClipId);
    if (!clip) return;

    const deltaBeats = event.editorPoint.beat - this.dragStartBeat;
    const zoomX = this.coordinateSystem['viewport']?.zoomX ?? 100;
    const targetDuration = this.dragType === 'fadeIn'
      ? this.originalFadeInDuration + deltaBeats
      : this.originalFadeOutDuration - deltaBeats;
    const snappedTarget = this.snapEngine.snapBeat(Math.max(0, targetDuration), zoomX);
    const snappedBeats = snappedTarget - (this.dragType === 'fadeIn' ? this.originalFadeInDuration : this.originalFadeOutDuration);

    if (this.dragType === 'fadeIn') {
      const newDuration = Math.max(0, Math.min(this.originalFadeInDuration + snappedBeats, clip.duration * 0.5));
      store.updateClipFade(this.dragClipId, 'in', { duration: newDuration, curve: clip.fadeIn.curve, gain: 1 });
      this.updateAudioFade(this.dragClipId, newDuration, clip.fadeOut.duration, clip.fadeIn.curve, clip.fadeOut.curve);
    } else {
      const newDuration = Math.max(0, Math.min(this.originalFadeOutDuration - snappedBeats, clip.duration * 0.5));
      store.updateClipFade(this.dragClipId, 'out', { duration: newDuration, curve: clip.fadeOut.curve, gain: 1 });
      this.updateAudioFade(this.dragClipId, clip.fadeIn.duration, newDuration, clip.fadeIn.curve, clip.fadeOut.curve);
    }
  }

  private checkCrossfadeHover(event: InteractionEvent) {
    const store = useProjectStore.getState();
    const { clips, tracks, trackHeight } = store;
    const viewport = (this.coordinateSystem as any).viewport;
    const zoomX = viewport?.zoomX ?? 100;
    const zoomY = viewport?.zoomY ?? trackHeight;
    const scrollX = viewport?.scrollX ?? 0;
    const scrollY = viewport?.scrollY ?? 0;
    const yOffset = viewport?.yOffset ?? 40;

    const beat = event.editorPoint.beat;
    const trackIndex = Math.floor(event.editorPoint.vertical);

    const track = tracks[trackIndex];
    if (!track) {
      this.hoveredClipId = null;
      this.hoveredType = null;
      this.transitionTo('idle');
      return;
    }

    const trackClips = clips.filter(c => c.trackId === track.id);
    for (let i = 0; i < trackClips.length; i++) {
      const a = trackClips[i];
      for (let j = i + 1; j < trackClips.length; j++) {
        const b = trackClips[j];
        const aStart = a.startBeat ?? a.start;
        const aEnd = aStart + a.duration;
        const bStart = b.startBeat ?? b.start;
        const bEnd = bStart + b.duration;

        if (aEnd > bStart && beat > bStart && beat < Math.min(aEnd, bEnd)) {
          this.hoveredClipId = a.id;
          this.hoveredType = null;
          this.transitionTo('hoverCrossfade');
          return;
        }
      }
    }

    this.hoveredClipId = null;
    this.hoveredType = null;
    this.transitionTo('idle');
  }

  private updateAudioFade(
    clipId: string,
    fadeInDuration: number,
    fadeOutDuration: number,
    fadeInCurve: string,
    fadeOutCurve: string
  ) {
    try {
      const ctx = audioEngine.getContext();
      if (!ctx) return;
      const processor = getFadeProcessor(ctx);
      if (processor.hasSession(clipId)) {
        processor.updateFade(
          clipId,
          fadeInDuration,
          fadeOutDuration,
          fadeInCurve as FadeCurveType,
          fadeOutCurve as FadeCurveType
        );
      }
    } catch {
    }
  }

  private cancelCurrentOperation() {
    if (this.state === 'draggingFadeIn' || this.state === 'draggingFadeOut') {
      if (this.dragClipId) {
        const store = useProjectStore.getState();
        const clip = store.clips.find(c => c.id === this.dragClipId);
        if (clip) {
          store.updateClipFade(this.dragClipId, 'in', { duration: this.originalFadeInDuration, curve: clip.fadeIn.curve, gain: 1 });
          store.updateClipFade(this.dragClipId, 'out', { duration: this.originalFadeOutDuration, curve: clip.fadeOut.curve, gain: 1 });
        }
      }
    }
    this.dragClipId = null;
    this.dragType = null;
    this.hoveredClipId = null;
    this.hoveredType = null;
    this.transitionTo('idle');
  }

  private transitionTo(newState: FadeToolState) {
    if (this.state !== newState) {
      this.state = newState;
    }
  }

  private hitTest(event: InteractionEvent): HitResult | null {
    const store = useProjectStore.getState();
    const { clips, tracks, trackHeight } = store;
    const viewport = (this.coordinateSystem as any).viewport;
    const zoomX = viewport?.zoomX ?? 100;
    const zoomY = viewport?.zoomY ?? trackHeight;
    const scrollX = viewport?.scrollX ?? 0;
    const scrollY = viewport?.scrollY ?? 0;
    const yOffset = viewport?.yOffset ?? 40;

    const screenX = event.screenPoint.x;
    const screenY = event.screenPoint.y;

    for (const clip of clips) {
      const trackIndex = tracks.findIndex(t => t.id === clip.trackId);
      if (trackIndex < 0) continue;

      const clipStart = clip.startBeat ?? clip.start;
      const clipScreenX = clipStart * zoomX - scrollX;
      const clipWidth = Math.max(clip.duration * zoomX, 2);
      const trackScreenY = yOffset + trackIndex * zoomY - scrollY;

      const inVerticalRange = screenY >= trackScreenY && screenY <= trackScreenY + trackHeight;
      if (!inVerticalRange) continue;

      const localX = screenX - clipScreenX;

      if (localX >= -FADE_HANDLE_THRESHOLD && localX < FADE_HANDLE_THRESHOLD) {
        return { clipId: clip.id, type: 'fadeIn', distance: localX };
      }

      if (localX >= clipWidth - FADE_HANDLE_THRESHOLD && localX <= clipWidth + FADE_HANDLE_THRESHOLD) {
        return { clipId: clip.id, type: 'fadeOut', distance: localX - clipWidth };
      }
    }

    return null;
  }
}
