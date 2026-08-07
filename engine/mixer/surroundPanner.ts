/**
 * Surround Panner - Position Audio in 3D Space
 *
 * Features:
 * - Position audio objects in surround field
 * - Spread control for sound width
 * - LFE send for bass management
 * - Distance and elevation modeling
 * - Binaural rendering for headphones
 * - Speaker snap mode
 * - Real-time gain calculation
 */

import {
  SurroundFormat,
  SurroundFormatConfig,
  SurroundPannerConfig,
  SurroundGain,
  SpeakerConfig,
  SpeakerPosition,
  BinauralMode,
  SURROUND_FORMATS,
} from './surroundTypes';

// =============================================================================
// Surround Panner
// =============================================================================

export class SurroundPanner {
  private format: SurroundFormatConfig;
  private config: SurroundPannerConfig;
  private listeners: Array<(config: SurroundPannerConfig) => void> = [];

  constructor(format: SurroundFormat = '5.1') {
    this.format = SURROUND_FORMATS[format];
    this.config = {
      format,
      position: { x: 0, y: 1, z: 0 },
      spread: 0,
      lfeLevel: 0,
      distance: 0.5,
      elevation: 0,
      azimuth: 0,
      width: 100,
      depth: 50,
      snapToSpeakers: false,
      binauralMode: 'off',
    };
  }

  // ===========================================================================
  // Position Control
  // ===========================================================================

  public setPosition(position: SpeakerPosition): void {
    this.config.position = this.clampPosition(position);
    this.notifyListeners();
  }

  public getPosition(): SpeakerPosition {
    return { ...this.config.position };
  }

  public setXY(x: number, y: number): void {
    this.config.position.x = Math.max(-1, Math.min(1, x));
    this.config.position.y = Math.max(-1, Math.min(1, y));
    this.notifyListeners();
  }

  public setAzimuthElevation(azimuth: number, elevation: number): void {
    this.config.azimuth = Math.max(-180, Math.min(180, azimuth));
    this.config.elevation = Math.max(-90, Math.min(90, elevation));

    // Convert to cartesian
    const radAzimuth = (this.config.azimuth * Math.PI) / 180;
    const radElevation = (this.config.elevation * Math.PI) / 180;
    const cosEl = Math.cos(radElevation);

    this.config.position.x = Math.sin(radAzimuth) * cosEl;
    this.config.position.y = Math.cos(radAzimuth) * cosEl;
    this.config.position.z = Math.sin(radElevation);

    this.notifyListeners();
  }

  public setSpread(spread: number): void {
    this.config.spread = Math.max(0, Math.min(100, spread));
    this.notifyListeners();
  }

  public setLFE(level: number): void {
    this.config.lfeLevel = Math.max(0, Math.min(1, level));
    this.notifyListeners();
  }

  public setDistance(distance: number): void {
    this.config.distance = Math.max(0, Math.min(1, distance));
    this.notifyListeners();
  }

  public setWidth(width: number): void {
    this.config.width = Math.max(0, Math.min(100, width));
    this.notifyListeners();
  }

  public setDepth(depth: number): void {
    this.config.depth = Math.max(0, Math.min(100, depth));
    this.notifyListeners();
  }

  public setSnapToSpeakers(snap: boolean): void {
    this.config.snapToSpeakers = snap;
    if (snap) {
      this.snapToNearestSpeaker();
    }
    this.notifyListeners();
  }

  public setBinauralMode(mode: BinauralMode): void {
    this.config.binauralMode = mode;
    this.notifyListeners();
  }

  // ===========================================================================
  // Gain Calculation
  // ===========================================================================

  public calculateGains(): SurroundGain {
    const gains: number[] = new Array(this.format.speakers.length).fill(0);
    let lfe = 0;

    if (this.config.snapToSpeakers) {
      // Snap to nearest speaker
      const nearest = this.findNearestSpeaker();
      if (nearest) {
        gains[nearest.channelIndex] = 1;
      }
    } else {
      // Calculate gains for all speakers
      for (let i = 0; i < this.format.speakers.length; i++) {
        const speaker = this.format.speakers[i];

        if (speaker.isLFE) {
          // LFE send level
          gains[i] = this.config.lfeLevel;
          lfe = this.config.lfeLevel;
        } else {
          // Calculate distance-based gain
          const gain = this.calculateSpeakerGain(speaker);
          gains[i] = gain;
        }
      }

      // Apply spread
      if (this.config.spread > 0) {
        this.applySpread(gains);
      }
    }

    // Normalize gains to prevent clipping
    const totalPower = gains.reduce((sum, g) => sum + g * g, 0);
    const normalizedGains = gains.map(g => g / Math.max(1, Math.sqrt(totalPower)));

    return {
      gains: normalizedGains,
      lfe,
      totalPower: Math.sqrt(totalPower),
    };
  }

  private calculateSpeakerGain(speaker: SpeakerConfig): number {
    const pos = this.config.position;
    const sp = speaker.position;

    // Calculate distance between source and speaker
    const dx = pos.x - sp.x;
    const dy = pos.y - sp.y;
    const dz = pos.z - sp.z;
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

    // Inverse distance law with minimum distance
    const minDistance = 0.1;
    const effectiveDistance = Math.max(minDistance, distance);

    // Apply distance attenuation
    let gain = 1 / effectiveDistance;

    // Apply elevation effect
    if (speaker.isHeight && this.config.elevation > 0) {
      gain *= 1 + (this.config.elevation / 90) * 0.5;
    }

    // Apply width effect
    if (this.config.width < 100) {
      const widthFactor = this.config.width / 100;
      gain *= widthFactor;
    }

    return Math.max(0, Math.min(1, gain));
  }

  private applySpread(gains: number[]): void {
    const spreadFactor = this.config.spread / 100;
    const avgGain = gains.reduce((a, b) => a + b, 0) / gains.length;

    for (let i = 0; i < gains.length; i++) {
      // Spread averages the gains
      gains[i] = gains[i] * (1 - spreadFactor) + avgGain * spreadFactor;
    }
  }

  private findNearestSpeaker(): SpeakerConfig | null {
    let nearest: SpeakerConfig | null = null;
    let minDistance = Infinity;

    for (const speaker of this.format.speakers) {
      if (speaker.isLFE) continue;

      const dx = this.config.position.x - speaker.position.x;
      const dy = this.config.position.y - speaker.position.y;
      const dz = this.config.position.z - speaker.position.z;
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

      if (distance < minDistance) {
        minDistance = distance;
        nearest = speaker;
      }
    }

    return nearest;
  }

  private snapToNearestSpeaker(): void {
    const nearest = this.findNearestSpeaker();
    if (nearest) {
      this.config.position = { ...nearest.position };
    }
  }

  // ===========================================================================
  // Format Management
  // ===========================================================================

  public setFormat(format: SurroundFormat): void {
    this.format = SURROUND_FORMATS[format];
    this.config.format = format;
    this.notifyListeners();
  }

  public getFormat(): SurroundFormatConfig {
    return this.format;
  }

  // ===========================================================================
  // Binaural Rendering
  // ===========================================================================

  public calculateBinauralGains(): { left: number; right: number } {
    if (this.config.binauralMode === 'off') {
      return { left: 1, right: 1 };
    }

    // Simplified binaural rendering using HRTF approximation
    const azimuth = this.config.azimuth;
    const elevation = this.config.elevation;

    // Inter-aural time difference (ITD) approximation
    const itd = Math.sin((azimuth * Math.PI) / 180) * 0.0006; // ~0.6ms max

    // Inter-aural level difference (ILD) approximation
    const ild = Math.sin((azimuth * Math.PI) / 180) * 6; // ~6dB max

    // Apply elevation effect
    const elevationFactor = Math.cos((elevation * Math.PI) / 180);

    const leftGain = Math.pow(10, (ild * elevationFactor) / 20);
    const rightGain = Math.pow(10, (-ild * elevationFactor) / 20);

    return {
      left: Math.max(0, Math.min(1, leftGain)),
      right: Math.max(0, Math.min(1, rightGain)),
    };
  }

  // ===========================================================================
  // Position Presets
  // ===========================================================================

  public setPositionPreset(preset: 'front-center' | 'front-left' | 'front-right' | 'surround-left' | 'surround-right' | 'rear-center' | 'center' | 'overhead'): void {
    const presets: Record<string, SpeakerPosition> = {
      'front-center': { x: 0, y: 1, z: 0 },
      'front-left': { x: -1, y: 1, z: 0 },
      'front-right': { x: 1, y: 1, z: 0 },
      'surround-left': { x: -1, y: 0, z: 0 },
      'surround-right': { x: 1, y: 0, z: 0 },
      'rear-center': { x: 0, y: -1, z: 0 },
      'center': { x: 0, y: 0, z: 0 },
      'overhead': { x: 0, y: 0, z: 1 },
    };

    this.config.position = presets[preset] ?? presets['center'];
    this.notifyListeners();
  }

  // ===========================================================================
  // Utility
  // ===========================================================================

  private clampPosition(position: SpeakerPosition): SpeakerPosition {
    return {
      x: Math.max(-1, Math.min(1, position.x)),
      y: Math.max(-1, Math.min(1, position.y)),
      z: Math.max(-1, Math.min(1, position.z)),
    };
  }

  public getConfig(): Readonly<SurroundPannerConfig> {
    return this.config;
  }

  public setConfig(config: Partial<SurroundPannerConfig>): void {
    Object.assign(this.config, config);
    this.notifyListeners();
  }

  // ===========================================================================
  // Events
  // ===========================================================================

  public subscribe(listener: (config: SurroundPannerConfig) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index >= 0) {
        this.listeners.splice(index, 1);
      }
    };
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      listener(this.config);
    }
  }

  // ===========================================================================
  // Serialization
  // ===========================================================================

  public serialize(): SurroundPannerConfig {
    return { ...this.config };
  }

  public deserialize(config: Partial<SurroundPannerConfig>): void {
    Object.assign(this.config, config);
    this.notifyListeners();
  }
}

// =============================================================================
// Factory
// =============================================================================

export function createSurroundPanner(format?: SurroundFormat): SurroundPanner {
  return new SurroundPanner(format);
}

export default SurroundPanner;
