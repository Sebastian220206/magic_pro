/**
 * Clip Renderer - Visual rendering utilities for clips
 * 
 * Handles:
 * - Waveform generation and caching
 * - Fade curve rendering
 * - Selection highlighting
 * - Stretch indicator visualization
 * - Canvas-based rendering for performance
 */

import { Clip, FadeSettings, FadeCurveType, WaveformRenderOptions, ClipBounds } from './types';

// =============================================================================
// Waveform Generation
// =============================================================================

/**
 * Generate waveform peaks from AudioBuffer
 * Returns min/max pairs for each pixel column
 */
export function generateWaveformPeaks(
  buffer: AudioBuffer,
  channel: number = 0,
  samplesPerPixel: number
): Float32Array {
  const data = buffer.getChannelData(channel);
  const numPeaks = Math.ceil(data.length / samplesPerPixel);
  const peaks = new Float32Array(numPeaks * 2); // min/max pairs

  for (let i = 0; i < numPeaks; i++) {
    const start = i * samplesPerPixel;
    const end = Math.min(start + samplesPerPixel, data.length);
    
    let min = 0;
    let max = 0;

    for (let j = start; j < end; j++) {
      const sample = data[j];
      if (sample < min) min = sample;
      if (sample > max) max = sample;
    }

    peaks[i * 2] = min;
    peaks[i * 2 + 1] = max;
  }

  return peaks;
}

/**
 * Multi-channel waveform (average of all channels)
 */
export function generateMultiChannelWaveform(
  buffer: AudioBuffer,
  samplesPerPixel: number
): Float32Array {
  const numChannels = buffer.numberOfChannels;
  const length = buffer.length;
  const numPeaks = Math.ceil(length / samplesPerPixel);
  const peaks = new Float32Array(numPeaks * 2);

  for (let i = 0; i < numPeaks; i++) {
    const start = i * samplesPerPixel;
    const end = Math.min(start + samplesPerPixel, length);

    let min = 0;
    let max = 0;

    for (let ch = 0; ch < numChannels; ch++) {
      const data = buffer.getChannelData(ch);
      for (let j = start; j < end; j++) {
        const sample = data[j];
        if (sample < min) min = sample;
        if (sample > max) max = sample;
      }
    }

    // Average across channels
    min /= numChannels;
    max /= numChannels;

    peaks[i * 2] = min;
    peaks[i * 2 + 1] = max;
  }

  return peaks;
}

// =============================================================================
// Canvas Rendering
// =============================================================================

export class ClipRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  constructor(width: number, height: number) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = width;
    this.canvas.height = height;
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get 2D context');
    this.ctx = ctx;
  }

  /**
   * Render waveform to canvas
   */
  renderWaveform(
    peaks: Float32Array,
    options: WaveformRenderOptions
  ): void {
    const { width, height, color, backgroundColor } = options;
    const centerY = height / 2;

    // Clear canvas
    this.canvas.width = width;
    this.canvas.height = height;
    
    if (backgroundColor) {
      this.ctx.fillStyle = backgroundColor;
      this.ctx.fillRect(0, 0, width, height);
    }

    // Draw waveform
    this.ctx.fillStyle = color;
    
    const step = width / (peaks.length / 2);
    
    for (let i = 0; i < peaks.length / 2; i++) {
      const min = peaks[i * 2];
      const max = peaks[i * 2 + 1];
      
      const x = i * step;
      const minY = centerY + min * centerY;
      const maxY = centerY + max * centerY;
      const barHeight = Math.max(1, maxY - minY);
      
      this.ctx.fillRect(x, minY, Math.max(1, step), barHeight);
    }
  }

  /**
   * Render waveform with fade curves applied
   */
  renderWaveformWithFades(
    peaks: Float32Array,
    clip: Clip,
    pixelsPerBeat: number,
    options: WaveformRenderOptions
  ): void {
    const { width, height, color, fadeInColor, fadeOutColor } = options;
    const centerY = height / 2;

    this.canvas.width = width;
    this.canvas.height = height;

    const step = width / (peaks.length / 2);
    const fadeInWidth = clip.fadeIn.duration * pixelsPerBeat;
    const fadeOutWidth = clip.fadeOut.duration * pixelsPerBeat;

    for (let i = 0; i < peaks.length / 2; i++) {
      const min = peaks[i * 2];
      const max = peaks[i * 2 + 1];
      
      const x = i * step;
      
      // Calculate fade gain at this position
      let gain = 1.0;
      
      if (x < fadeInWidth && clip.fadeIn.duration > 0) {
        gain = this.calculateFadeGain(clip.fadeIn, x / fadeInWidth, 'in');
      } else if (x > width - fadeOutWidth && clip.fadeOut.duration > 0) {
        const fadePos = (x - (width - fadeOutWidth)) / fadeOutWidth;
        gain = this.calculateFadeGain(clip.fadeOut, fadePos, 'out');
      }

      // Apply gain to waveform height
      const minY = centerY + min * centerY * gain;
      const maxY = centerY + max * centerY * gain;
      const barHeight = Math.max(1, maxY - minY);

      // Determine color based on fade
      let barColor = color;
      if (fadeInColor && x < fadeInWidth) {
        barColor = fadeInColor;
      } else if (fadeOutColor && x > width - fadeOutWidth) {
        barColor = fadeOutColor;
      }

      this.ctx.fillStyle = barColor;
      this.ctx.fillRect(x, minY, Math.max(1, step), barHeight);
    }
  }

  /**
   * Calculate fade gain multiplier
   */
  private calculateFadeGain(
    fade: FadeSettings,
    t: number,
    type: 'in' | 'out'
  ): number {
    let gain: number;

    switch (fade.curve) {
      case 'linear':
        gain = t;
        break;
      case 'exponential':
        gain = t * t;
        break;
      case 'logarithmic':
        gain = Math.sqrt(t);
        break;
      case 'scurve':
        gain = t * t * (3 - 2 * t);
        break;
      default:
        gain = t;
    }

    if (type === 'out') {
      gain = 1 - gain;
    }

    return gain;
  }

  /**
   * Render fade curve overlay
   */
  renderFadeCurves(
    clip: Clip,
    width: number,
    height: number,
    pixelsPerBeat: number
  ): void {
    this.canvas.width = width;
    this.canvas.height = height;

    const fadeInWidth = clip.fadeIn.duration * pixelsPerBeat;
    const fadeOutWidth = clip.fadeOut.duration * pixelsPerBeat;

    // Render fade in curve
    if (fadeInWidth > 0) {
      this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      
      for (let x = 0; x <= fadeInWidth; x++) {
        const t = x / fadeInWidth;
        const gain = this.calculateFadeGain(clip.fadeIn, t, 'in');
        const y = height - (gain * height * 0.3); // Bottom 30% of clip
        
        if (x === 0) {
          this.ctx.moveTo(x, y);
        } else {
          this.ctx.lineTo(x, y);
        }
      }
      
      this.ctx.stroke();
    }

    // Render fade out curve
    if (fadeOutWidth > 0) {
      this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      
      for (let x = 0; x <= fadeOutWidth; x++) {
        const t = x / fadeOutWidth;
        const gain = this.calculateFadeGain(clip.fadeOut, t, 'out');
        const screenX = width - fadeOutWidth + x;
        const y = height - (gain * height * 0.3);
        
        if (x === 0) {
          this.ctx.moveTo(screenX, y);
        } else {
          this.ctx.lineTo(screenX, y);
        }
      }
      
      this.ctx.stroke();
    }
  }

  /**
   * Render stretch indicator
   */
  renderStretchIndicator(
    width: number,
    height: number,
    stretchRatio: number
  ): void {
    this.canvas.width = width;
    this.canvas.height = height;

    // Draw diagonal stripes indicating stretch
    this.ctx.strokeStyle = 'rgba(255, 200, 100, 0.3)';
    this.ctx.lineWidth = 2;

    const stripeSpacing = 20 / stretchRatio;
    
    for (let x = -height; x < width; x += stripeSpacing) {
      this.ctx.beginPath();
      this.ctx.moveTo(x, height);
      this.ctx.lineTo(x + height, 0);
      this.ctx.stroke();
    }

    // Draw stretch text
    this.ctx.fillStyle = 'rgba(255, 200, 100, 0.8)';
    this.ctx.font = '10px sans-serif';
    this.ctx.fillText(`${stretchRatio.toFixed(2)}x`, 5, height - 5);
  }

  /**
   * Get canvas as data URL
   */
  getDataURL(): string {
    return this.canvas.toDataURL();
  }

  /**
   * Get canvas element
   */
  getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }
}

// =============================================================================
// SVG Path Generation
// =============================================================================

/**
 * Generate SVG path for waveform (alternative to canvas)
 */
export function generateWaveformPath(
  peaks: Float32Array,
  width: number,
  height: number
): string {
  const centerY = height / 2;
  const step = width / (peaks.length / 2);
  
  let path = '';
  
  // Top line
  for (let i = 0; i < peaks.length / 2; i++) {
    const max = peaks[i * 2 + 1];
    const x = i * step;
    const y = centerY + max * centerY;
    
    if (i === 0) {
      path += `M ${x} ${y}`;
    } else {
      path += ` L ${x} ${y}`;
    }
  }
  
  // Bottom line (reverse)
  for (let i = peaks.length / 2 - 1; i >= 0; i--) {
    const min = peaks[i * 2];
    const x = i * step;
    const y = centerY + min * centerY;
    path += ` L ${x} ${y}`;
  }
  
  path += ' Z';
  return path;
}

/**
 * Generate SVG path for fade curve
 */
export function generateFadePath(
  fade: FadeSettings,
  width: number,
  height: number,
  type: 'in' | 'out'
): string {
  let path = '';
  const steps = 50;
  
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    let gain: number;

    switch (fade.curve) {
      case 'linear':
        gain = t;
        break;
      case 'exponential':
        gain = t * t;
        break;
      case 'logarithmic':
        gain = Math.sqrt(t);
        break;
      case 'scurve':
        gain = t * t * (3 - 2 * t);
        break;
      default:
        gain = t;
    }

    if (type === 'out') {
      gain = 1 - gain;
    }

    const x = type === 'in' ? t * width : (1 - t) * width;
    const y = height - gain * height * 0.3;

    if (i === 0) {
      path += `M ${x} ${y}`;
    } else {
      path += ` L ${x} ${y}`;
    }
  }

  return path;
}

// =============================================================================
// Waveform Caching
// =============================================================================

interface CacheEntry {
  peaks: Float32Array;
  timestamp: number;
  width: number;
}

const waveformCache = new Map<string, CacheEntry>();
const MAX_CACHE_SIZE = 50;

/**
 * Get cached waveform or generate new one
 */
export function getCachedWaveform(
  bufferId: string,
  buffer: AudioBuffer,
  width: number,
  sampleRate: number
): Float32Array {
  const cacheKey = `${bufferId}-${width}`;
  const cached = waveformCache.get(cacheKey);

  if (cached && cached.width === width) {
    return cached.peaks;
  }

  // Generate new waveform
  const samplesPerPixel = Math.ceil(buffer.length / width);
  const peaks = generateMultiChannelWaveform(buffer, samplesPerPixel);

  // Cache management - LRU eviction
  if (waveformCache.size >= MAX_CACHE_SIZE) {
    const oldest = Array.from(waveformCache.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp)[0];
    if (oldest) {
      waveformCache.delete(oldest[0]);
    }
  }

  waveformCache.set(cacheKey, {
    peaks,
    timestamp: Date.now(),
    width,
  });

  return peaks;
}

/**
 * Clear waveform cache
 */
export function clearWaveformCache(): void {
  waveformCache.clear();
}

/**
 * Pre-cache waveforms for visible clips
 */
export function preCacheWaveforms(
  clips: Clip[],
  buffers: Map<string, AudioBuffer>,
  viewportWidth: number
): void {
  for (const clip of clips) {
    if (!clip.bufferId) continue;
    
    const buffer = buffers.get(clip.bufferId);
    if (!buffer) continue;

    const clipWidth = Math.min(viewportWidth, viewportWidth); // Calculate actual width
    getCachedWaveform(clip.bufferId, buffer, clipWidth, buffer.sampleRate);
  }
}

// =============================================================================
// Color Utilities
// =============================================================================

/**
 * Adjust color brightness
 */
export function adjustBrightness(color: string, percent: number): string {
  const num = parseInt(color.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.max(0, Math.min(255, (num >> 16) + amt));
  const G = Math.max(0, Math.min(255, ((num >> 8) & 0x00FF) + amt));
  const B = Math.max(0, Math.min(255, (num & 0x0000FF) + amt));
  return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`;
}

/**
 * Get clip color based on state
 */
export function getClipColor(
  clip: Clip,
  isSelected: boolean,
  isHovered: boolean,
  isDragging: boolean
): string {
  let baseColor = clip.color || '#888888';

  if (isDragging) {
    return adjustBrightness(baseColor, 20);
  }

  if (isSelected) {
    return adjustBrightness(baseColor, 15);
  }

  if (isHovered) {
    return adjustBrightness(baseColor, 10);
  }

  if (clip.muted) {
    return adjustBrightness(baseColor, -30);
  }

  return baseColor;
}

/**
 * Get waveform color based on clip state
 */
export function getWaveformColor(
  clip: Clip,
  isSelected: boolean
): string {
  if (isSelected) {
    return 'rgba(255, 255, 255, 0.9)';
  }
  
  if (clip.muted) {
    return 'rgba(150, 150, 150, 0.5)';
  }

  return 'rgba(255, 255, 255, 0.7)';
}

// =============================================================================
// Selection Visualization
// =============================================================================

/**
 * Generate selection box coordinates
 */
export function getSelectionBox(
  startX: number,
  startY: number,
  currentX: number,
  currentY: number
): { x: number; y: number; width: number; height: number } {
  const x = Math.min(startX, currentX);
  const y = Math.min(startY, currentY);
  const width = Math.abs(currentX - startX);
  const height = Math.abs(currentY - currentY);

  return { x, y, width, height };
}

/**
 * Check if clip bounds intersect with selection box
 */
export function intersectsSelection(
  clipBounds: ClipBounds,
  selectionBox: { x: number; y: number; width: number; height: number }
): boolean {
  return !(
    clipBounds.x + clipBounds.width < selectionBox.x ||
    clipBounds.x > selectionBox.x + selectionBox.width ||
    clipBounds.y + clipBounds.height < selectionBox.y ||
    clipBounds.y > selectionBox.y + selectionBox.height
  );
}
