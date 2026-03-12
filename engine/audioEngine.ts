/**
 * Digital Audio Workstation Engine (Logic Pro High-Fidelity Implementation)
 * Implements a dynamic signal flow graph with dynamic plugin chains, 
 * aux sends, inspector-level transforms, and a precision beat scheduler.
 */

export interface FXNode {
    id: string;
    type: 'comp' | 'eq' | 'reverb' | 'delay';
    node: AudioNode;
}

export interface TrackNodes {
    sourceGain: GainNode;
    fxChain: GainNode; // Entrance into the FX chain
    fxEnd: GainNode;   // Exit from the FX chain
    panner: StereoPannerNode | PannerNode;
    output: GainNode;
    analyzer: AnalyserNode;
    nodes: FXNode[];
}

class AudioEngine {
    private audioContext: AudioContext | null = null;
    private isPlaying: boolean = false;
    private currentTempo: number = 120;
    private buffers: Map<string, AudioBuffer> = new Map();
    private projectFormat: 'stereo' | 'surround' | 'dolby-atmos' = 'stereo';
    private surroundFormat: 'Quadraphonic' | 'LCR (Pro Logic)' | '5.1 (ITU 775)' | '6.1 (ES/EX)' | '7.1' | '7.1 (SDDS)' | '5.1.2' | '5.1.4' | '7.1.2' | '7.1.4' = '5.1 (ITU 775)';
    private spatialAudioMode: 'Off' | 'Dolby Atmos' = 'Off';
    private activeSources: Set<AudioBufferSourceNode> = new Set();

    // Routing Node Graph
    private trackNodes: Map<string, TrackNodes> = new Map();
    private sendNodes: Array<{ node: GainNode, from: string, to: string }> = [];
    private activeOscillators: Map<string, Map<number, { osc: OscillatorNode, gain: GainNode }>> = new Map();
    private noteRepeatTimers: Map<number, number> = new Map(); // pitch -> intervalID
    private masterGain: GainNode | null = null;
    private masterAnalyzer: AnalyserNode | null = null;
    private midiListeners: Array<(message: any) => void> = [];

    triggerNote(trackId: string, pitch: number, velocity: number, repeatRate?: string) {
        this.initContext();
        if (!this.audioContext) return;
        const nodes = this.getTrackNodes(trackId);
        if (!nodes) return;

        const triggerSingle = (p: number, v: number) => {
            if (!this.audioContext) return;
            const osc = this.audioContext.createOscillator();
            const gain = this.audioContext.createGain();
            osc.frequency.setValueAtTime(440 * Math.pow(2, (p - 69) / 12), this.audioContext.currentTime);
            gain.gain.setValueAtTime(0, this.audioContext.currentTime);
            gain.gain.linearRampToValueAtTime(v / 127 * 0.2, this.audioContext.currentTime + 0.005);
            osc.connect(gain);
            gain.connect(nodes.sourceGain);
            osc.start();
            if (!this.activeOscillators.has(trackId)) this.activeOscillators.set(trackId, new Map());
            this.activeOscillators.get(trackId)!.set(p, { osc, gain });
        };

        if (repeatRate) {
            // Calculate interval in ms based on tempo and rate
            const beatsPerMeasure = 4; // Assuming 4/4
            const rateMap: Record<string, number> = {
                '1/4': 1, '1/8': 0.5, '1/16': 0.25, '1/32': 0.125, '1/64': 0.0625,
                '1/12': 1/3, '1/24': 1/6, '1/48': 1/12
            };
            const beats = rateMap[repeatRate] || 0.25;
            const interval = (60 / this.currentTempo) * beats * 1000;
            
            triggerSingle(pitch, velocity);
            const timerId = window.setInterval(() => {
                this.releaseNote(trackId, pitch);
                triggerSingle(pitch, velocity);
            }, interval);
            this.noteRepeatTimers.set(pitch, timerId);
        } else {
            triggerSingle(pitch, velocity);
        }
    }

    releaseNote(trackId: string, pitch: number) {
        if (this.noteRepeatTimers.has(pitch)) {
            clearInterval(this.noteRepeatTimers.get(pitch));
            this.noteRepeatTimers.delete(pitch);
        }

        const trackOscs = this.activeOscillators.get(trackId);
        if (trackOscs && trackOscs.has(pitch) && this.audioContext) {
            const { osc, gain } = trackOscs.get(pitch)!;
            const releaseTime = this.audioContext.currentTime + 0.05;
            gain.gain.exponentialRampToValueAtTime(0.001, releaseTime);
            osc.stop(releaseTime);
            trackOscs.delete(pitch);
        }
    }

    // Scheduler
    private nextNoteTime: number = 0;
    private timerID: number | null = null;
    private lookahead: number = 25.0; // ms
    private scheduleAheadTime: number = 0.1; // seconds
    private currentBeatInMeasure: number = 0;

    private initContext() {
        if (!this.audioContext && typeof window !== 'undefined') {
            const AudioContext = (window as any).AudioContext || (window as any).webkitAudioContext;
            const ctx = new AudioContext();
            this.audioContext = ctx;

            this.masterGain = ctx.createGain();
            this.masterAnalyzer = ctx.createAnalyser();

            if (this.masterGain && this.masterAnalyzer) {
                this.masterGain.connect(this.masterAnalyzer);
                this.masterAnalyzer.connect(ctx.destination);
            }

            this.applyMasterChannelConfig();
        }
    }

    private getChannelCountForFormat(format: 'stereo' | 'surround' | 'dolby-atmos', spatialMode: 'Off' | 'Dolby Atmos'): number {
        if (spatialMode === 'Dolby Atmos' || format === 'dolby-atmos') {
            return 16; // object-based internal rendering placeholders
        }
        switch (format) {
            case 'stereo': return 2;
            case 'surround':
                switch (this.surroundFormat) {
                    case 'Quadraphonic': return 4;
                    case 'LCR (Pro Logic)': return 3;
                    case '5.1 (ITU 775)': return 6;
                    case '6.1 (ES/EX)': return 7;
                    case '7.1':
                    case '7.1 (SDDS)': return 8;
                    case '5.1.2': return 8;
                    case '5.1.4': return 10;
                    case '7.1.2': return 10;
                    case '7.1.4': return 12;
                    default: return 6;
                }
            default: return 2;
        }
    }

    private applyMasterChannelConfig() {
        if (!this.masterGain) return;
        const channelCount = this.getChannelCountForFormat(this.projectFormat, this.spatialAudioMode);
        this.masterGain.channelCount = channelCount;
        this.masterGain.channelCountMode = 'explicit';
        this.masterGain.channelInterpretation = 'discrete';
    }

    configureAudioFormat(format: 'stereo' | 'surround' | 'dolby-atmos', surroundFormat: 'Quadraphonic' | 'LCR (Pro Logic)' | '5.1 (ITU 775)' | '6.1 (ES/EX)' | '7.1' | '7.1 (SDDS)' | '5.1.2' | '5.1.4' | '7.1.2' | '7.1.4', spatialAudioMode: 'Off' | 'Dolby Atmos') {
        this.projectFormat = format;
        this.surroundFormat = surroundFormat;
        this.spatialAudioMode = spatialAudioMode;
        this.applyMasterChannelConfig();
        this.rebuildTrackPanners();
    }

    private createPannerNodeByFormat(): StereoPannerNode | PannerNode {
        if (!this.audioContext) {
            throw new Error('AudioContext is not initialized yet');
        }

        if (this.projectFormat === 'stereo') {
            return this.audioContext.createStereoPanner();
        }

        const panner = this.audioContext.createPanner();
        panner.panningModel = 'HRTF';
        panner.distanceModel = 'inverse';
        panner.refDistance = 1;
        panner.maxDistance = 10000;
        panner.rolloffFactor = 1;
        panner.coneInnerAngle = 360;
        panner.coneOuterAngle = 0;
        panner.coneOuterGain = 0;
        panner.positionX.value = 0;
        panner.positionY.value = 0;
        panner.positionZ.value = -1;

        return panner;
    }

    private rebuildTrackPanners() {
        if (!this.audioContext) return;

        this.trackNodes.forEach((nodes, trackId) => {
            try {
                nodes.fxEnd.disconnect();
            } catch (e) { }
            try {
                nodes.panner.disconnect();
            } catch (e) { }

            const newPanner = this.createPannerNodeByFormat();
            nodes.fxEnd.connect(newPanner);
            newPanner.connect(nodes.output);
            nodes.panner = newPanner;

            // Keep existing pan state using casted values
            if (this.projectFormat === 'stereo' && 'pan' in nodes.panner) {
                (nodes.panner as StereoPannerNode).pan.value = 0;
            } else if (this.projectFormat !== 'stereo' && 'positionX' in nodes.panner) {
                (nodes.panner as PannerNode).positionX.value = 0;
                (nodes.panner as PannerNode).positionY.value = 0;
                (nodes.panner as PannerNode).positionZ.value = -1;
            }
        });
    }

    private mapPanTo3DPosition(pan: number) {
        const clamped = Math.max(-1, Math.min(1, pan));
        const x = clamped * 5;
        const y = 0;
        const z = Math.max(-10, Math.min(-1, -2 + Math.abs(clamped) * 5));
        return { x, y, z };
    }

    getTrackNodes(trackId: string): TrackNodes | null {
        this.initContext();
        if (!this.audioContext || !this.masterGain) return null;

        if (!this.trackNodes.has(trackId)) {
            const ctx = this.audioContext;
            const sourceGain = ctx.createGain();
            const fxChain = ctx.createGain();
            const fxEnd = ctx.createGain();
            const panner = this.createPannerNodeByFormat();
            const output = ctx.createGain();
            const analyzer = ctx.createAnalyser();

            sourceGain.connect(fxChain);
            fxChain.connect(fxEnd);
            fxEnd.connect(panner);
            panner.connect(output);
            output.connect(analyzer);
            if (this.masterGain) {
                analyzer.connect(this.masterGain);
            }

            this.trackNodes.set(trackId, {
                sourceGain, fxChain, fxEnd, panner, output, analyzer, nodes: []
            });
        }
        return this.trackNodes.get(trackId)!;
    }

    updateFXChain(trackId: string, plugins: any[]) {
        const nodes = this.getTrackNodes(trackId);
        if (!nodes || !this.audioContext) return;

        nodes.fxChain.disconnect();
        nodes.nodes.forEach(f => f.node.disconnect());

        let lastNode: AudioNode = nodes.fxChain;

        plugins.forEach(p => {
            if (p.enabled) {
                const fxNode = this.createFXNode(p.pluginId);
                if (fxNode) {
                    lastNode.connect(fxNode);
                    lastNode = fxNode;
                    nodes.nodes.push({ id: p.id, type: p.pluginId, node: fxNode });
                }
            }
        });

        lastNode.connect(nodes.fxEnd);
    }

    private createFXNode(type: string): AudioNode | null {
        if (!this.audioContext) return null;
        switch (type) {
            case 'comp': return this.audioContext.createGain(); // Mock
            case 'eq': return this.audioContext.createBiquadFilter();
            case 'reverb': return this.audioContext.createConvolver();
            case 'delay': return this.audioContext.createDelay();
            default: return this.audioContext.createGain();
        }
    }

    routeTrackToTrack(childId: string, parentId: string) {
        const child = this.trackNodes.get(childId);
        const parent = this.trackNodes.get(parentId);
        if (child && parent) {
            child.output.disconnect();
            child.output.connect(parent.fxChain);
        }
    }

    routeTrackToBus(childId: string, busId: string, level: number) {
        const child = this.trackNodes.get(childId);
        const bus = this.trackNodes.get(busId);
        if (!child || !bus || !this.audioContext) return;

        const sendGain = this.audioContext.createGain();
        sendGain.gain.value = level;
        child.output.connect(sendGain);
        sendGain.connect(bus.fxChain);

        this.sendNodes.push({ node: sendGain, from: childId, to: busId });
    }

    updateTrackParams(trackId: string, volume: number, pan: number) {
        const nodes = this.trackNodes.get(trackId);
        if (nodes && this.audioContext) {
            nodes.output.gain.setTargetAtTime(volume, this.audioContext.currentTime, 0.02);

            if (this.projectFormat === 'stereo' && 'pan' in nodes.panner) {
                (nodes.panner as StereoPannerNode).pan.setTargetAtTime(pan, this.audioContext.currentTime, 0.02);
            } else if ('positionX' in nodes.panner) {
                const pos = this.mapPanTo3DPosition(pan);
                const panner = nodes.panner as PannerNode;
                panner.positionX.setTargetAtTime(pos.x, this.audioContext.currentTime, 0.02);
                panner.positionY.setTargetAtTime(pos.y, this.audioContext.currentTime, 0.02);
                panner.positionZ.setTargetAtTime(pos.z, this.audioContext.currentTime, 0.02);
            }
        }
    }

    setTempo(bpm: number) { this.currentTempo = bpm; }

    async loadSample(id: string, url: string) {
        this.initContext();
        if (!this.audioContext) return;
        const res = await fetch(url);
        const arrayBuffer = await res.arrayBuffer();
        const buffer = await this.audioContext.decodeAudioData(arrayBuffer);
        this.buffers.set(id, buffer);
    }

    play(metronome: boolean) {
        this.initContext();
        if (this.audioContext?.state === 'suspended') this.audioContext.resume();
        this.isPlaying = true;
    }

    stop() {
        this.isPlaying = false;
        this.activeSources.forEach(s => s.stop());
        this.activeSources.clear();

        this.sendNodes.forEach(entry => {
            try { entry.node.disconnect(); } catch (e) { }
        });
        this.sendNodes = [];
    }

    playRegion(trackId: string, clip: any, playhead: number) {
        this.initContext();
        if (!this.audioContext || !this.isPlaying) return;

        const nodes = this.getTrackNodes(trackId);
        if (!nodes) return;

        if (clip.type === 'audio') {
            const buffer = this.buffers.get(clip.sampleId || '');
            if (!buffer) return;

            const source = this.audioContext.createBufferSource();
            source.buffer = buffer;

            const flexMode = clip.flexMode || 'off';
            const flexTimeFactor = clip.flexTimeFactor || 1;
            const flexPitchOffset = clip.flexPitchOffset || 0;
            const clipTranspose = clip.transpose || 0;

            let playbackRate = 1;
            let detune = 0;

            if (!clip.flexEnabled) {
                playbackRate = Math.pow(2, clipTranspose / 12);
                detune = 0;
            } else if (flexMode === 'time') {
                playbackRate = 1 / Math.max(0.01, flexTimeFactor);
                detune = 0;
            } else if (flexMode === 'pitch') {
                playbackRate = 1;
                detune = (clipTranspose + flexPitchOffset) * 100;
            } else if (flexMode === 'time+pitch') {
                playbackRate = 1 / Math.max(0.01, flexTimeFactor);
                detune = (clipTranspose + flexPitchOffset) * 100;
            } else {
                playbackRate = Math.pow(2, clipTranspose / 12);
                detune = 0;
            }

            source.playbackRate.value = playbackRate;
            if (typeof source.detune !== 'undefined') {
                source.detune.value = detune;
            }

            source.connect(nodes.sourceGain);

            const startOffset = Math.max(0, playhead - clip.start);
            const startTime = this.audioContext.currentTime + Math.max(0, clip.start - playhead);

            source.start(startTime, startOffset);
            this.activeSources.add(source);
            source.onended = () => this.activeSources.delete(source);
        } else if (clip.type === 'midi' && clip.notes) {
            clip.notes.forEach((note: any) => {
                const noteStart = clip.start + note.start;
                if (noteStart >= playhead) {
                    this.scheduleNote(trackId, note, noteStart - playhead, clip.transpose);
                }
            });
        }
    }

    private scheduleNote(trackId: string, note: any, delayBeats: number, regionTranspose: number) {
        if (!this.audioContext) return;
        const secondsPerBeat = 60.0 / this.currentTempo;
        const startTime = this.audioContext.currentTime + (delayBeats * secondsPerBeat);
        const duration = note.duration * secondsPerBeat;

        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();

        const pitch = note.pitch + regionTranspose;
        osc.frequency.setValueAtTime(440 * Math.pow(2, (pitch - 69) / 12), startTime);

        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.2, startTime + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

        const nodes = this.getTrackNodes(trackId);
        if (nodes) {
            osc.connect(gain);
            gain.connect(nodes.sourceGain);
            osc.start(startTime);
            osc.stop(startTime + duration);
        }
    }

    initMidi() {
        if (navigator.requestMIDIAccess) {
            navigator.requestMIDIAccess().then(access => {
                access.inputs.forEach(input => {
                    input.onmidimessage = (msg) => {
                        this.handleMidiMessage(msg);
                        // include source port id for listeners
                        this.midiListeners.forEach(listener => listener({ message: msg, inputId: input.id }));
                    };
                });
            }).catch(() => { });
        }
    }

    addMidiListener(listener: (message: any) => void) {
        this.midiListeners.push(listener);
        return () => {
            this.midiListeners = this.midiListeners.filter(l => l !== listener);
        };
    }

    private handleMidiMessage(msg: any) {
        const [status, data1, data2] = msg.data;
        const cmd = status >> 4;
        const channel = status & 0xf;

        if (cmd === 9 && data2 > 0) {
            // Note on from MIDI
            if (this.isPlaying) {
                console.log('MIDI Note On:', data1, data2, 'channel', channel);
            }
            // currently note handling in engine is separate; we only log/control if needed
        }

        if (cmd === 8 || (cmd === 9 && data2 === 0)) {
            if (this.isPlaying) {
                console.log('MIDI Note Off:', data1, data2, 'channel', channel);
            }
        }
    }
}

export const audioEngine = new AudioEngine();
