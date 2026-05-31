/**
 * Digital Audio Workstation Engine
 * Handles AudioContext, Routing, Buffer Loading, Playback, and MIDI.
 */

class AudioEngine {
    private audioContext: AudioContext | null = null;
    private isPlaying: boolean = false;
    private currentTempo: number = 120;
    private buffers: Map<string, AudioBuffer> = new Map();
    private activeSources: Set<AudioBufferSourceNode> = new Set();

    // Routing nodes: Track ID -> { gain, pan }
    private trackNodes: Map<string, { gain: GainNode, panner: StereoPannerNode }> = new Map();
    private masterGain: GainNode | null = null;

    // Metronome state
    private nextNoteTime: number = 0;
    private timerID: number | null = null;
    private lookahead: number = 25.0; // ms
    private scheduleAheadTime: number = 0.1; // seconds
    private currentBeatInMeasure: number = 0;

    private initContext() {
        if (!this.audioContext && typeof window !== 'undefined') {
            const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
            this.audioContext = new AudioContext();

            this.masterGain = this.audioContext.createGain();
            this.masterGain.connect(this.audioContext.destination);
        }
    }

    getTrackNodes(trackId: string) {
        this.initContext();
        if (!this.audioContext || !this.masterGain) return null;

        if (!this.trackNodes.has(trackId)) {
            const gain = this.audioContext.createGain();
            const panner = this.audioContext.createStereoPanner();

            gain.connect(panner);
            panner.connect(this.masterGain);

            this.trackNodes.set(trackId, { gain, panner });
        }
        return this.trackNodes.get(trackId);
    }

    async loadAudio(url: string, id: string): Promise<AudioBuffer> {
        this.initContext();
        if (!this.audioContext) throw new Error("AudioContext not available");

        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
        this.buffers.set(id, audioBuffer);
        return audioBuffer;
    }

    private nextNote() {
        const secondsPerBeat = 60.0 / this.currentTempo;
        this.nextNoteTime += secondsPerBeat;
        this.currentBeatInMeasure = (this.currentBeatInMeasure + 1) % 4;
    }

    private scheduleNote(beatNumber: number, time: number) {
        if (!this.audioContext) return;
        const osc = this.audioContext.createOscillator();
        const envelope = this.audioContext.createGain();
        osc.connect(envelope);
        envelope.connect(this.audioContext.destination);
        osc.frequency.value = beatNumber === 0 ? 880.0 : 440.0;
        envelope.gain.value = 0.15;
        envelope.gain.exponentialRampToValueAtTime(0.001, time + 0.02);
        osc.start(time);
        osc.stop(time + 0.03);
    }

    private scheduler = () => {
        if (!this.audioContext || !this.isPlaying) return;
        while (this.nextNoteTime < this.audioContext.currentTime + this.scheduleAheadTime) {
            this.scheduleNote(this.currentBeatInMeasure, this.nextNoteTime);
            this.nextNote();
        }
        this.timerID = window.setTimeout(this.scheduler, this.lookahead);
    }

    playRegion(trackId: string, bufferId: string, startTime: number, offset: number, duration: number) {
        if (!this.audioContext || !this.isPlaying) return;
        const buffer = this.buffers.get(bufferId);
        const nodes = this.getTrackNodes(trackId);
        if (!buffer || !nodes) return;

        const source = this.audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(nodes.gain);

        const secondsPerBeat = 60 / this.currentTempo;
        const startOffsetSec = offset * secondsPerBeat;
        const durationSec = duration * secondsPerBeat;
        const when = startTime * secondsPerBeat;

        // Schedule playback relative to current audio context time
        // Note: This logic assumes 0 is the start of alignment
        source.start(this.audioContext.currentTime + when, startOffsetSec, durationSec);
        this.activeSources.add(source);
        source.onended = () => {
            this.activeSources.delete(source);
        };
    }

    updateTrackParams(trackId: string, volume: number, pan: number) {
        const nodes = this.trackNodes.get(trackId);
        if (nodes && this.audioContext) {
            nodes.gain.gain.setTargetAtTime(volume, this.audioContext.currentTime, 0.02);
            nodes.panner.pan.setTargetAtTime(pan, this.audioContext.currentTime, 0.02);
        }
    }

    play(useMetronome: boolean = true) {
        this.initContext();
        if (this.audioContext?.state === 'suspended') this.audioContext.resume();
        this.isPlaying = true;
        this.currentBeatInMeasure = 0;
        if (this.audioContext) this.nextNoteTime = this.audioContext.currentTime + 0.05;
        if (useMetronome) this.scheduler();
    }

    stop() {
        this.isPlaying = false;
        if (this.timerID !== null) {
            window.clearTimeout(this.timerID);
            this.timerID = null;
        }
        this.activeSources.forEach(s => {
            try { s.stop(); } catch (e) { }
        });
        this.activeSources.clear();
    }

    setTempo(bpm: number) {
        this.currentTempo = bpm;
    }

    // --- MIDI Integration ---
    private activeOscillators: Map<number, { osc: OscillatorNode, gain: GainNode }> = new Map();

    initMidi() {
        if (typeof window === 'undefined' || !(navigator as any).requestMIDIAccess) return;
        (navigator as any).requestMIDIAccess().then((midiAccess: any) => {
            for (let input of midiAccess.inputs.values()) {
                input.onmidimessage = (msg: any) => this.handleMidiMessage(msg);
            }
        }).catch((e: any) => console.error('[AudioEngine] MIDI init failed:', e));
    }

    private handleMidiMessage(message: any) {
        const [command, note, velocity] = message.data;
        const cmdType = command & 0xf0;
        if (cmdType === 144 && velocity > 0) this.playNote(note, velocity);
        if (cmdType === 128 || (cmdType === 144 && velocity === 0)) this.stopNote(note);
    }

    private playNote(note: number, velocity: number) {
        this.initContext();
        if (!this.audioContext || !this.masterGain) return;
        this.stopNote(note);
        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();
        osc.type = 'sine';
        osc.frequency.value = 440 * Math.pow(2, (note - 69) / 12);
        osc.connect(gain);
        gain.connect(this.masterGain);
        gain.gain.setValueAtTime(0, this.audioContext.currentTime);
        gain.gain.linearRampToValueAtTime((velocity / 127) * 0.3, this.audioContext.currentTime + 0.02);
        osc.start();
        this.activeOscillators.set(note, { osc, gain });
    }

    private stopNote(note: number) {
        if (!this.audioContext) return;
        const active = this.activeOscillators.get(note);
        if (active) {
            active.gain.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + 0.05);
            active.osc.stop(this.audioContext.currentTime + 0.05);
            this.activeOscillators.delete(note);
        }
    }
}

export const audioEngine = new AudioEngine();
