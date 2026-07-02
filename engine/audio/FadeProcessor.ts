import { FadeCurveType, generateFadeInCurve, generateFadeOutCurve } from './FadeEnvelope';

interface FadeSession {
  gainNode: GainNode;
  sourceNode: AudioBufferSourceNode;
  trackInput: AudioNode;
  fadeInDuration: number;
  fadeOutDuration: number;
  fadeInCurve: FadeCurveType;
  fadeOutCurve: FadeCurveType;
  clipDuration: number;
  tempo: number;
  scheduledStart: number;
  scheduledEnd: number;
}

export class FadeProcessor {
  private sessions: Map<string, FadeSession> = new Map();
  private ctx: AudioContext;

  constructor(ctx: AudioContext) {
    this.ctx = ctx;
  }

  setContext(ctx: AudioContext): void {
    this.ctx = ctx;
  }

  connectFade(
    clipId: string,
    source: AudioBufferSourceNode,
    trackInput: AudioNode,
    fadeInDuration: number,
    fadeOutDuration: number,
    fadeInCurve: FadeCurveType,
    fadeOutCurve: FadeCurveType,
    clipDurationSeconds: number,
    scheduledStart: number,
    scheduledEnd: number,
    tempo: number
  ): GainNode {
    const gainNode = this.ctx.createGain();

    source.disconnect(trackInput);
    source.connect(gainNode);
    gainNode.connect(trackInput);

    this.applyFadeAutomation(gainNode, fadeInDuration, fadeOutDuration, fadeInCurve, fadeOutCurve, clipDurationSeconds, scheduledStart, scheduledEnd, tempo);

    const session: FadeSession = {
      gainNode,
      sourceNode: source,
      trackInput,
      fadeInDuration,
      fadeOutDuration,
      fadeInCurve,
      fadeOutCurve,
      clipDuration: clipDurationSeconds,
      tempo,
      scheduledStart,
      scheduledEnd,
    };

    this.sessions.set(clipId, session);

    source.onended = () => {
      this.disconnectFade(clipId);
    };

    return gainNode;
  }

  updateFade(
    clipId: string,
    fadeInDuration: number,
    fadeOutDuration: number,
    fadeInCurve?: FadeCurveType,
    fadeOutCurve?: FadeCurveType
  ): void {
    const session = this.sessions.get(clipId);
    if (!session) return;

    session.fadeInDuration = fadeInDuration;
    session.fadeOutDuration = fadeOutDuration;
    if (fadeInCurve) session.fadeInCurve = fadeInCurve;
    if (fadeOutCurve) session.fadeOutCurve = fadeOutCurve;

    const now = this.ctx.currentTime;

    session.gainNode.gain.cancelScheduledValues(now);

    const currentValue = session.gainNode.gain.value;
    session.gainNode.gain.setValueAtTime(currentValue, now);

    const remaining = session.scheduledEnd - now;
    const elapsed = now - session.scheduledStart;
    const effectiveFadeIn = Math.max(0, fadeInDuration - elapsed);

    if (effectiveFadeIn > 0 && fadeInDuration > 0) {
      const curve = generateFadeInCurve(64, session.fadeInCurve);
      session.gainNode.gain.setValueCurveAtTime(curve, now, effectiveFadeIn);
    }

    if (fadeOutDuration > 0) {
      const fadeOutStart = session.clipDuration - fadeOutDuration;
      const fadeOutOffset = Math.max(0, fadeOutStart - elapsed);
      if (fadeOutOffset < remaining && fadeOutOffset >= 0) {
        const curve = generateFadeOutCurve(64, session.fadeOutCurve);
        session.gainNode.gain.setValueCurveAtTime(curve, now + fadeOutOffset, Math.min(fadeOutDuration, remaining - fadeOutOffset));
      }
    }
  }

  disconnectFade(clipId: string): void {
    const session = this.sessions.get(clipId);
    if (!session) return;

    try {
      session.gainNode.disconnect();
    } catch {
    }

    this.sessions.delete(clipId);
  }

  disconnectAll(): void {
    for (const clipId of Array.from(this.sessions.keys())) {
      this.disconnectFade(clipId);
    }
  }

  hasSession(clipId: string): boolean {
    return this.sessions.has(clipId);
  }

  getSessionCount(): number {
    return this.sessions.size;
  }

  private applyFadeAutomation(
    gainNode: GainNode,
    fadeInDuration: number,
    fadeOutDuration: number,
    fadeInCurve: FadeCurveType,
    fadeOutCurve: FadeCurveType,
    clipDurationSeconds: number,
    scheduledStart: number,
    scheduledEnd: number,
    _tempo: number
  ): void {
    const now = this.ctx.currentTime;
    const actualStart = Math.max(scheduledStart, now);

    if (actualStart >= scheduledEnd) return;

    gainNode.gain.setValueAtTime(0, actualStart);

    if (fadeInDuration > 0 && actualStart + fadeInDuration <= scheduledEnd) {
      const fadeInSamples = Math.min(64, Math.max(2, Math.floor(fadeInDuration * this.ctx.sampleRate / 128)));
      const fadeInCurveArr = generateFadeInCurve(fadeInSamples, fadeInCurve);
      gainNode.gain.setValueCurveAtTime(fadeInCurveArr, actualStart, fadeInDuration);
    } else {
      gainNode.gain.setValueAtTime(1, actualStart);
    }

    if (fadeOutDuration > 0 && actualStart + clipDurationSeconds - fadeOutDuration >= actualStart) {
      const fadeOutStart = Math.max(actualStart, scheduledEnd - fadeOutDuration);
      const effectiveFadeOut = Math.min(fadeOutDuration, scheduledEnd - fadeOutStart);

      if (effectiveFadeOut > 0) {
        const fadeOutSamples = Math.min(64, Math.max(2, Math.floor(effectiveFadeOut * this.ctx.sampleRate / 128)));
        const fadeOutCurveArr = generateFadeOutCurve(fadeOutSamples, fadeOutCurve);

        const currentGain = fadeOutStart <= this.ctx.currentTime ? gainNode.gain.value : 1;

        if (fadeOutStart > this.ctx.currentTime + 0.005) {
          gainNode.gain.setValueAtTime(currentGain, fadeOutStart - 0.001);
        }
        gainNode.gain.setValueCurveAtTime(fadeOutCurveArr, fadeOutStart, effectiveFadeOut);
      }
    }

    gainNode.gain.setValueAtTime(0, scheduledEnd + 0.001);
  }

  getSession(clipId: string): FadeSession | undefined {
    return this.sessions.get(clipId);
  }
}

let instance: FadeProcessor | null = null;

export function getFadeProcessor(ctx?: AudioContext): FadeProcessor {
  if (!instance && ctx) {
    instance = new FadeProcessor(ctx);
  } else if (!instance) {
    throw new Error('FadeProcessor not initialized. Provide AudioContext on first call.');
  }
  return instance!;
}

export function setFadeProcessorContext(ctx: AudioContext): void {
  if (instance) {
    instance.setContext(ctx);
  } else {
    instance = new FadeProcessor(ctx);
  }
}

export function createFadeProcessor(ctx: AudioContext): FadeProcessor {
  return new FadeProcessor(ctx);
}
