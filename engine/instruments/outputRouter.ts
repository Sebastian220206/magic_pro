/**
 * Output Router - Routes Instrument Outputs to Mixer Channels
 *
 * Features:
 * - Map instrument outputs to mixer channels
 * - Automatic channel creation for multi-output instruments
 * - Pre/post fader routing options
 * - Solo/mute linking between instrument outputs and mixer channels
 * - Real-time metering integration
 */

import { MultiOutputInstrument, InstrumentOutput } from './multiOutputInstrument';

export interface OutputRoute {
  id: string;
  instrumentId: string;
  instrumentOutputIndex: number;
  mixerChannelId: string;
  enabled: boolean;
  gain: number;           // dB
  pan: number;            // -1 to 1
  preFader: boolean;
}

export interface OutputRouterState {
  routes: OutputRoute[];
  instrumentOutputs: Map<string, InstrumentOutput[]>;
  selectedRouteId: string | null;
}

export interface OutputRouterOptions {
  autoCreateChannels?: boolean;
  defaultGain?: number;
  defaultPan?: number;
}

const DEFAULT_OPTIONS: Required<OutputRouterOptions> = {
  autoCreateChannels: true,
  defaultGain: 0,
  defaultPan: 0,
};

export class OutputRouter {
  private state: OutputRouterState;
  private options: Required<OutputRouterOptions>;
  private audioContext: AudioContext | null = null;
  private instruments: Map<string, MultiOutputInstrument> = new Map();
  private channelNodes: Map<string, { input: GainNode; output: GainNode }> = new Map();
  private listeners: Array<(state: OutputRouterState) => void> = [];

  constructor(options: OutputRouterOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.state = {
      routes: [],
      instrumentOutputs: new Map(),
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
  // Instrument Registration
  // ===========================================================================

  public registerInstrument(instrument: MultiOutputInstrument): void {
    const config = instrument.getConfig();
    this.instruments.set(config.id, instrument);
    this.state.instrumentOutputs.set(config.id, [...config.outputs]);

    // Auto-create routes if enabled
    if (this.options.autoCreateChannels) {
      for (let i = 0; i < config.outputCount; i++) {
        if (i !== config.mainOutputIndex) {
          this.createRoute(config.id, i);
        }
      }
    }

    this.notifyListeners();
  }

  public unregisterInstrument(instrumentId: string): void {
    // Remove all routes for this instrument
    this.state.routes = this.state.routes.filter(r => r.instrumentId !== instrumentId);
    this.state.instrumentOutputs.delete(instrumentId);
    this.instruments.delete(instrumentId);
    this.notifyListeners();
  }

  public getInstrument(instrumentId: string): MultiOutputInstrument | undefined {
    return this.instruments.get(instrumentId);
  }

  // ===========================================================================
  // Route Management
  // ===========================================================================

  public createRoute(
    instrumentId: string,
    instrumentOutputIndex: number,
    mixerChannelId?: string
  ): OutputRoute | null {
    const instrument = this.instruments.get(instrumentId);
    if (!instrument) return null;

    const output = instrument.getOutput(instrumentOutputIndex);
    if (!output) return null;

    const routeId = `route-${instrumentId}-${instrumentOutputIndex}`;
    const channelId = mixerChannelId ?? `channel-${routeId}`;

    const route: OutputRoute = {
      id: routeId,
      instrumentId,
      instrumentOutputIndex,
      mixerChannelId: channelId,
      enabled: true,
      gain: this.options.defaultGain,
      pan: this.options.defaultPan,
      preFader: false,
    };

    this.state.routes.push(route);
    this.notifyListeners();
    return route;
  }

  public deleteRoute(routeId: string): boolean {
    const index = this.state.routes.findIndex(r => r.id === routeId);
    if (index >= 0) {
      this.state.routes.splice(index, 1);
      this.notifyListeners();
      return true;
    }
    return false;
  }

  public getRoute(routeId: string): OutputRoute | undefined {
    return this.state.routes.find(r => r.id === routeId);
  }

  public getRoutes(): ReadonlyArray<OutputRoute> {
    return this.state.routes;
  }

  public getInstrumentRoutes(instrumentId: string): ReadonlyArray<OutputRoute> {
    return this.state.routes.filter(r => r.instrumentId === instrumentId);
  }

  public getChannelRoute(channelId: string): OutputRoute | undefined {
    return this.state.routes.find(r => r.mixerChannelId === channelId);
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

  public setGain(routeId: string, gainDb: number): void {
    const route = this.state.routes.find(r => r.id === routeId);
    if (route) {
      route.gain = Math.max(-60, Math.min(12, gainDb));
      this.notifyListeners();
    }
  }

  public setPan(routeId: string, pan: number): void {
    const route = this.state.routes.find(r => r.id === routeId);
    if (route) {
      route.pan = Math.max(-1, Math.min(1, pan));
      this.notifyListeners();
    }
  }

  public setPreFader(routeId: string, preFader: boolean): void {
    const route = this.state.routes.find(r => r.id === routeId);
    if (route) {
      route.preFader = preFader;
      this.notifyListeners();
    }
  }

  public setMixerChannel(routeId: string, channelId: string): void {
    const route = this.state.routes.find(r => r.id === routeId);
    if (route) {
      route.mixerChannelId = channelId;
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

  public getSelectedRoute(): OutputRoute | null {
    return this.state.routes.find(r => r.id === this.state.selectedRouteId) ?? null;
  }

  // ===========================================================================
  // Audio Routing
  // ===========================================================================

  public connectToMixer(
    instrumentId: string,
    instrumentOutputIndex: number,
    channelInputNode: GainNode
  ): boolean {
    const instrument = this.instruments.get(instrumentId);
    if (!instrument) return false;

    const outputNode = instrument.getOutputNode(instrumentOutputIndex);
    if (!outputNode) return false;

    outputNode.connect(channelInputNode);
    return true;
  }

  public disconnectFromMixer(
    instrumentId: string,
    instrumentOutputIndex: number
  ): void {
    const instrument = this.instruments.get(instrumentId);
    if (!instrument) return;

    const outputNode = instrument.getOutputNode(instrumentOutputIndex);
    if (outputNode) {
      outputNode.disconnect();
    }
  }

  public connectAllToMixer(getChannelInput: (channelId: string) => GainNode | null): void {
    for (const route of this.state.routes) {
      if (!route.enabled) continue;

      const channelInput = getChannelInput(route.mixerChannelId);
      if (channelInput) {
        this.connectToMixer(route.instrumentId, route.instrumentOutputIndex, channelInput);
      }
    }
  }

  public disconnectAllFromMixer(): void {
    for (const route of this.state.routes) {
      this.disconnectFromMixer(route.instrumentId, route.instrumentOutputIndex);
    }
  }

  // ===========================================================================
  // Auto-Route Helpers
  // ===========================================================================

  public autoRouteDrumMachine(
    instrument: MultiOutputInstrument,
    channelNames?: Record<number, string>
  ): OutputRoute[] {
    const routes: OutputRoute[] = [];
    const config = instrument.getConfig();

    const defaultNames: Record<number, string> = {
      0: 'Drums - Main',
      1: 'Drums - Kick',
      2: 'Drums - Snare',
      3: 'Drums - Hats',
    };

    const names = { ...defaultNames, ...channelNames };

    for (let i = 0; i < config.outputCount; i++) {
      const route = this.createRoute(config.id, i);
      if (route) {
        instrument.setOutputName(i, names[i] ?? `Output ${i + 1}`);
        routes.push(route);
      }
    }

    return routes;
  }

  public autoRouteMultiTimbral(
    instrument: MultiOutputInstrument,
    partNames?: string[]
  ): OutputRoute[] {
    const routes: OutputRoute[] = [];
    const config = instrument.getConfig();

    for (let i = 0; i < config.outputCount; i++) {
      const route = this.createRoute(config.id, i);
      if (route) {
        instrument.setOutputName(i, partNames?.[i] ?? `Part ${i + 1}`);
        routes.push(route);
      }
    }

    return routes;
  }

  // ===========================================================================
  // State
  // ===========================================================================

  public getState(): Readonly<OutputRouterState> {
    return this.state;
  }

  public getStateSnapshot(): OutputRouterState {
    return {
      routes: this.state.routes.map(r => ({ ...r })),
      instrumentOutputs: new Map(this.state.instrumentOutputs),
      selectedRouteId: this.state.selectedRouteId,
    };
  }

  // ===========================================================================
  // Events
  // ===========================================================================

  public subscribe(listener: (state: OutputRouterState) => void): () => void {
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
    this.disconnectAllFromMixer();
    this.state.routes = [];
    this.state.instrumentOutputs.clear();
    this.instruments.clear();
    this.channelNodes.clear();
  }

  // ===========================================================================
  // Serialization
  // ===========================================================================

  public serialize(): OutputRouterState {
    return this.getStateSnapshot();
  }

  public deserialize(data: OutputRouterState): void {
    this.state = {
      routes: data.routes.map(r => ({ ...r })),
      instrumentOutputs: new Map(data.instrumentOutputs),
      selectedRouteId: data.selectedRouteId,
    };
    this.notifyListeners();
  }
}

// =============================================================================
// Factory
// =============================================================================

export function createOutputRouter(options?: OutputRouterOptions): OutputRouter {
  return new OutputRouter(options);
}

export default OutputRouter;
