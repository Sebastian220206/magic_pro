type BiquadFilterType = "lowpass" | "highpass" | "bandpass" | "lowshelf" | "highshelf" | "peaking" | "notch" | "allpass";

export type EQBand = {
    id: string;
    type: BiquadFilterType;
    frequency: number;
    gain: number;
    Q: number;
    enabled: boolean;
};

export class ChannelEQ {
    ctx: AudioContext;
    input: GainNode;
    output: GainNode;
    bands: BiquadFilterNode[] = [];
    bandConfigs: EQBand[] = [];
    preAnalyzer: AnalyserNode;
    postAnalyzer: AnalyserNode;
    masterGainNode: GainNode;

    constructor(ctx: AudioContext, bandsConfig?: EQBand[]) {
        this.ctx = ctx;
        this.input = ctx.createGain();
        this.output = ctx.createGain();
        this.preAnalyzer = ctx.createAnalyser();
        this.preAnalyzer.fftSize = 2048;
        this.postAnalyzer = ctx.createAnalyser();
        this.postAnalyzer.fftSize = 2048;
        this.masterGainNode = ctx.createGain();
        
        this.input.connect(this.preAnalyzer);

        const defaultBands: EQBand[] = [
            { id: 'band-1', type: 'highpass', frequency: 20, gain: 0, Q: 0.71, enabled: true },
            { id: 'band-2', type: 'lowshelf', frequency: 80, gain: 0, Q: 0.71, enabled: true },
            { id: 'band-3', type: 'peaking', frequency: 200, gain: 0, Q: 0.71, enabled: true },
            { id: 'band-4', type: 'peaking', frequency: 500, gain: 0, Q: 0.71, enabled: true },
            { id: 'band-5', type: 'peaking', frequency: 1200, gain: 0, Q: 0.71, enabled: true },
            { id: 'band-6', type: 'peaking', frequency: 3000, gain: 0, Q: 0.71, enabled: true },
            { id: 'band-7', type: 'highshelf', frequency: 8000, gain: 0, Q: 0.71, enabled: true },
            { id: 'band-8', type: 'lowpass', frequency: 20000, gain: 0, Q: 0.71, enabled: true },
        ];

        this.bandConfigs = bandsConfig || defaultBands;
        this.rebuildChain();
    }

    private rebuildChain() {
        // Disconnect existing chain components
        this.input.disconnect();
        this.preAnalyzer.disconnect();
        this.postAnalyzer.disconnect();
        this.masterGainNode.disconnect();
        this.bands.forEach(b => b.disconnect());

        this.bands = this.bandConfigs.map(config => {
            const filter = this.ctx.createBiquadFilter();
            filter.type = config.type;
            filter.frequency.value = config.frequency;
            filter.gain.value = config.gain;
            filter.Q.value = config.Q;
            return filter;
        });

        // Chain filters in series
        let lastNode: AudioNode = this.input;
        
        // Reconnect pre-analyzer (it gets disconnected by this.input.disconnect())
        this.input.connect(this.preAnalyzer);

        this.bands.forEach((filter, index) => {
            const config = this.bandConfigs[index];
            if (config.enabled) {
                lastNode.connect(filter);
                lastNode = filter;
            }
        });
        
        lastNode.connect(this.postAnalyzer);
        this.postAnalyzer.connect(this.masterGainNode);
        this.masterGainNode.connect(this.output);
    }

    setMasterGain(db: number) {
        const gain = Math.pow(10, db / 20);
        this.masterGainNode.gain.setTargetAtTime(gain, this.ctx.currentTime, 0.01);
    }

    updateBand(id: string, params: Partial<EQBand>) {
        const bandIndex = this.bandConfigs.findIndex(b => b.id === id);
        if (bandIndex === -1) return;

        const band = this.bandConfigs[bandIndex];
        const filter = this.bands[bandIndex];
        let needsRebuild = false;

        if (params.type !== undefined && params.type !== band.type) {
            band.type = params.type;
            needsRebuild = true;
        }
        if (params.enabled !== undefined && params.enabled !== band.enabled) {
            band.enabled = params.enabled;
            needsRebuild = true;
        }

        if (params.frequency !== undefined) {
            // Clamp frequency to valid range
            const val = Math.max(20, Math.min(20000, params.frequency));
            band.frequency = val;
            if (filter) filter.frequency.setTargetAtTime(val, this.ctx.currentTime, 0.01);
        }
        if (params.gain !== undefined) {
            // Clamp gain to valid range
            const val = Math.max(-24, Math.min(24, params.gain));
            band.gain = val;
            if (filter) filter.gain.setTargetAtTime(val, this.ctx.currentTime, 0.01);
        }
        if (params.Q !== undefined) {
            // Clamp Q to valid range
            const val = Math.max(0.1, Math.min(100, params.Q));
            needsRebuild = true;
        }

        if (needsRebuild) {
            this.rebuildChain();
        }
    }

    getFrequencyResponse(frequencies: Float32Array): Float32Array {
        const totalMag = new Float32Array(frequencies.length).fill(1.0);
        const magResponse = new Float32Array(frequencies.length);
        const phaseResponse = new Float32Array(frequencies.length);

        this.bands.forEach((filter, index) => {
            if (this.bandConfigs[index].enabled) {
                (filter as BiquadFilterNode).getFrequencyResponse(frequencies as any, magResponse as any, phaseResponse as any);
                for (let i = 0; i < frequencies.length; i++) {
                    totalMag[i] *= magResponse[i];
                }
            }
        });

        return totalMag;
    }

    // This is the AudioNode interface that the AudioEngine expects
    public get node(): AudioNode {
        return this.input;
    }

    // Helper to connect to other nodes
    public connect(destination: AudioNode) {
        this.output.connect(destination);
    }

    public disconnect() {
        this.output.disconnect();
    }
}
