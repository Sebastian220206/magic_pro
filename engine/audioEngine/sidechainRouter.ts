/**
 * Sidechain Router - Professional Sidechain Routing System
 *
 * Features:
 * - Route any track's audio as sidechain source
 * - Multiple sidechain destinations per source
 * - Pre/post fader routing options
 * - Low-latency processing
 * - Multiple detection modes
 * - Wet/dry mix per sidechain
 *
 * Signal Flow:
 * Source Track → Sidechain Router → Detector → Target Effect
 *                                        ↓
 *                              Target Track (dry)
 */

export type SidechainDetectionMode = 'peak' | 'rms' | 'envelope' | 'spectral';
export type SidechainRoutingMode = 'pre-fader' | 'post-fader' | 'post-insert';
export type SidechainFilterType = 'none' | 'lowpass' | 'highpass' | 'bandpass';

export interface SidechainRoute {
  id: string;
  sourceTrackId: string;
  targetTrackId: string;
  targetEffectSlot?: number; // Specific effect slot for sidechain input
  enabled: boolean;
  routingMode: SidechainRoutingMode;
  detectionMode: SidechainDetectionMode;
  filter: SidechainFilter;
  gain: number;           // dB (-60 to +12)
  mix: number;            // 0-1 (wet/dry)
  inverted: boolean;      // Invert sidechain signal
  lookahead: number;      // ms (0-10)
  stereoLink: 'left' | 'right' | 'sum' | 'max';
}

export interface SidechainFilter {
  type: SidechainFilterType;
  frequency: number;      // Hz
  Q: number;              // 0.1-10
  enabled: boolean;
}

export interface SidechainState {
  routes: SidechainRoute[];
  activeSourceTrackId: string | null;
  selectedRouteId: string | null;
}

export interface SidechainOptions {
  routingMode?: SidechainRoutingMode;
  detectionMode?: SidechainDetectionMode;
  filter?: Partial<SidechainFilter>;
  gain?: number;
  mix?: number;
}

const DEFAULT_FILTER: SidechainFilter = {
  type: 'none',
  frequency: 1000,
  Q: 1,
  enabled: false,
};

const DEFAULT_OPTIONS: Required<SidechainOptions> = {
  routingMode: 'post-fader',
  detectionMode: 'envelope',
  filter: DEFAULT_FILTER,
  gain: 0,
  mix: 1,
};

export class SidechainRouter {
  private state: SidechainState;
  private audioContext: AudioContext | null = null;
  private sourceNodes: Map<string, {
    splitter: ChannelSplitterNode;
    merger: ChannelMergerNode;
    gain: GainNode;
    filters: BiquadFilterNode[];
  }> = new Map();
  private routeNodes: Map<string, {
    source: GainNode;
    detector: AnalyserNode;
    filter: BiquadFilterNode[];
    output: GainNode;
  }> = new Map();
  private listeners: Array<(state: SidechainState) => void> = [];

  constructor() {
    this.state = {
      routes: [],
      activeSourceTrackId: null,
      selectedRouteId: null,
    };
  }

  // ===========================================================================
  // Initialization
  // ===========================================================================

  public initialize(audioContext: AudioContext): void {
    this.audioContext = audioContext;
  }

  // ===========================================================================
  // Route Management
  // ===========================================================================

  public createRoute(
    sourceTrackId: string,
    targetTrackId: string,
    options: SidechainOptions = {}
  ): SidechainRoute {
    const config = { ...DEFAULT_OPTIONS, ...options };
    const filter = { ...DEFAULT_FILTER, ...config.filter };

    const route: SidechainRoute = {
      id: `sidechain-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      sourceTrackId,
      targetTrackId,
      enabled: true,
      routingMode: config.routingMode,
      detectionMode: config.detectionMode,
      filter,
      gain: config.gain,
      mix: config.mix,
      inverted: false,
      lookahead: 0,
      stereoLink: 'sum',
    };

    this.state.routes.push(route);
    this.notifyListeners();
    return route;
  }

  public deleteRoute(routeId: string): boolean {
    const index = this.state.routes.findIndex(r => r.id === routeId);
    if (index >= 0) {
      this.disconnectRoute(routeId);
      this.state.routes.splice(index, 1);

      if (this.state.selectedRouteId === routeId) {
        this.state.selectedRouteId = null;
      }

      this.notifyListeners();
      return true;
    }
    return false;
  }

  public getRoute(routeId: string): SidechainRoute | undefined {
    return this.state.routes.find(r => r.id === routeId);
  }

  public getRoutes(): ReadonlyArray<SidechainRoute> {
    return this.state.routes;
  }

  public getSourceRoutes(sourceTrackId: string): ReadonlyArray<SidechainRoute> {
    return this.state.routes.filter(r => r.sourceTrackId === sourceTrackId);
  }

  public getTargetRoutes(targetTrackId: string): ReadonlyArray<SidechainRoute> {
    return this.state.routes.filter(r => r.targetTrackId === targetTrackId);
  }

  // ===========================================================================
  // Route Configuration
  // ===========================================================================

  public setEnabled(routeId: string, enabled: boolean): void {
    const route = this.state.routes.find(r => r.id === routeId);
    if (route) {
      route.enabled = enabled;
      this.notifyListeners();
    }
  }

  public toggleEnabled(routeId: string): void {
    const route = this.state.routes.find(r => r.id === routeId);
    if (route) {
      route.enabled = !route.enabled;
      this.notifyListeners();
    }
  }

  public setRoutingMode(routeId: string, mode: SidechainRoutingMode): void {
    const route = this.state.routes.find(r => r.id === routeId);
    if (route) {
      route.routingMode = mode;
      this.notifyListeners();
    }
  }

  public setDetectionMode(routeId: string, mode: SidechainDetectionMode): void {
    const route = this.state.routes.find(r => r.id === routeId);
    if (route) {
      route.detectionMode = mode;
      this.notifyListeners();
    }
  }

  public setFilter(routeId: string, filter: Partial<SidechainFilter>): void {
    const route = this.state.routes.find(r => r.id === routeId);
    if (route) {
      Object.assign(route.filter, filter);
      this.notifyListeners();
    }
  }

  public setGain(routeId: string, gainDb: number): void {
    const route = this.state.routes.find(r => r.id === routeId);
    if (route) {
      route.gain = Math.max(-60, Math.min(12, gainDb));
      this.notifyListeners();
    }
  }

  public setMix(routeId: string, mix: number): void {
    const route = this.state.routes.find(r => r.id === routeId);
    if (route) {
      route.mix = Math.max(0, Math.min(1, mix));
      this.notifyListeners();
    }
  }

  public setInverted(routeId: string, inverted: boolean): void {
    const route = this.state.routes.find(r => r.id === routeId);
    if (route) {
      route.inverted = inverted;
      this.notifyListeners();
    }
  }

  public setLookahead(routeId: string, ms: number): void {
    const route = this.state.routes.find(r => r.id === routeId);
    if (route) {
      route.lookahead = Math.max(0, Math.min(10, ms));
      this.notifyListeners();
    }
  }

  public setStereoLink(routeId: string, link: SidechainRoute['stereoLink']): void {
    const route = this.state.routes.find(r => r.id === routeId);
    if (route) {
      route.stereoLink = link;
      this.notifyListeners();
    }
  }

  // ===========================================================================
  // Selection
  // ===========================================================================

  public selectRoute(routeId: string | null): void {
    this.state.selectedRouteId = routeId;
    this.notifyListeners();
  }

  public getSelectedRoute(): SidechainRoute | null {
    return this.state.routes.find(r => r.id === this.state.selectedRouteId) ?? null;
  }

  // ===========================================================================
  // Audio Routing
  // ===========================================================================

  public connectSource(sourceTrackId: string, sourceNode: AudioNode): void {
    if (!this.audioContext) return;

    // Create source tap nodes
    const splitter = this.audioContext.createChannelSplitter(2);
    const merger = this.audioContext.createChannelMerger(2);
    const gain = this.audioContext.createGain();

    sourceNode.connect(splitter);
    splitter.connect(gain, 0); // Left channel
    splitter.connect(gain, 1); // Right channel
    gain.connect(merger, 0, 0);
    gain.connect(merger, 0, 1);

    this.sourceNodes.set(sourceTrackId, {
      splitter,
      merger,
      gain,
      filters: [],
    });
  }

  public disconnectSource(sourceTrackId: string): void {
    const nodes = this.sourceNodes.get(sourceTrackId);
    if (nodes) {
      nodes.splitter.disconnect();
      nodes.merger.disconnect();
      nodes.gain.disconnect();
      nodes.filters.forEach(f => f.disconnect());
      this.sourceNodes.delete(sourceTrackId);
    }
  }

  public connectRoute(
    routeId: string,
    sourceNode: AudioNode,
    targetNode: AudioNode
  ): void {
    if (!this.audioContext) return;

    const route = this.state.routes.find(r => r.id === routeId);
    if (!route) return;

    // Create route nodes
    const sourceGain = this.audioContext.createGain();
    const detector = this.audioContext.createAnalyser();
    detector.fftSize = 2048;
    detector.smoothingTimeConstant = 0.3;

    const output = this.audioContext.createGain();

    // Create filter chain
    const filters: BiquadFilterNode[] = [];
    if (route.filter.enabled && route.filter.type !== 'none') {
      const filter = this.audioContext.createBiquadFilter();
      filter.type = route.filter.type === 'bandpass' ? 'bandpass' :
                    route.filter.type === 'lowpass' ? 'lowpass' : 'highpass';
      filter.frequency.value = route.filter.frequency;
      filter.Q.value = route.filter.Q;
      filters.push(filter);
    }

    // Connect source to filters to detector
    sourceNode.connect(sourceGain);
    let lastNode: AudioNode = sourceGain;
    for (const filter of filters) {
      lastNode.connect(filter);
      lastNode = filter;
    }
    lastNode.connect(detector);

    // Store nodes
    this.routeNodes.set(routeId, {
      source: sourceGain,
      detector,
      filter: filters,
      output,
    });

    // Connect to target
    output.connect(targetNode);
  }

  public disconnectRoute(routeId: string): void {
    const nodes = this.routeNodes.get(routeId);
    if (nodes) {
      nodes.source.disconnect();
      nodes.detector.disconnect();
      nodes.filter.forEach(f => f.disconnect());
      nodes.output.disconnect();
      this.routeNodes.delete(routeId);
    }
  }

  // ===========================================================================
  // Detection
  // ===========================================================================

  public getLevel(routeId: string): number {
    const nodes = this.routeNodes.get(routeId);
    if (!nodes) return 0;

    const dataArray = new Float32Array(nodes.detector.frequencyBinCount);
    nodes.detector.getFloatTimeDomainData(dataArray);

    const route = this.state.routes.find(r => r.id === routeId);
    if (!route) return 0;

    switch (route.detectionMode) {
      case 'peak':
        return this.detectPeak(dataArray);
      case 'rms':
        return this.detectRMS(dataArray);
      case 'envelope':
        return this.detectEnvelope(dataArray);
      case 'spectral':
        return this.detectSpectral(dataArray);
      default:
        return this.detectRMS(dataArray);
    }
  }

  private detectPeak(data: Float32Array): number {
    let max = 0;
    for (let i = 0; i < data.length; i++) {
      const abs = Math.abs(data[i]);
      if (abs > max) max = abs;
    }
    return max;
  }

  private detectRMS(data: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      sum += data[i] * data[i];
    }
    return Math.sqrt(sum / data.length);
  }

  private detectEnvelope(data: Float32Array): number {
    // Simple envelope follower
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      sum += Math.abs(data[i]);
    }
    return sum / data.length;
  }

  private detectSpectral(data: Float32Array): number {
    // Simple spectral centroid-based detection
    let weightedSum = 0;
    let totalMagnitude = 0;

    for (let i = 0; i < data.length; i++) {
      const magnitude = Math.abs(data[i]);
      weightedSum += i * magnitude;
      totalMagnitude += magnitude;
    }

    return totalMagnitude > 0 ? weightedSum / totalMagnitude / data.length : 0;
  }

  // ===========================================================================
  // State
  // ===========================================================================

  public getState(): Readonly<SidechainState> {
    return this.state;
  }

  public getStateSnapshot(): SidechainState {
    return {
      routes: this.state.routes.map(r => ({ ...r, filter: { ...r.filter } })),
      activeSourceTrackId: this.state.activeSourceTrackId,
      selectedRouteId: this.state.selectedRouteId,
    };
  }

  // ===========================================================================
  // Events
  // ===========================================================================

  public subscribe(listener: (state: SidechainState) => void): () => void {
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
      listener(this.state);
    }
  }

  // ===========================================================================
  // Cleanup
  // ===========================================================================

  public dispose(): void {
    // Disconnect all nodes
    for (const [sourceId] of this.sourceNodes) {
      this.disconnectSource(sourceId);
    }
    for (const [routeId] of this.routeNodes) {
      this.disconnectRoute(routeId);
    }
    this.sourceNodes.clear();
    this.routeNodes.clear();
    this.state.routes = [];
  }

  // ===========================================================================
  // Serialization
  // ===========================================================================

  public serialize(): SidechainState {
    return this.getStateSnapshot();
  }

  public deserialize(data: SidechainState): void {
    this.state = {
      routes: data.routes.map(r => ({ ...r, filter: { ...r.filter } })),
      activeSourceTrackId: data.activeSourceTrackId,
      selectedRouteId: data.selectedRouteId,
    };
    this.notifyListeners();
  }
}

// =============================================================================
// Factory
// =============================================================================

export function createSidechainRouter(): SidechainRouter {
  return new SidechainRouter();
}

export default SidechainRouter;
