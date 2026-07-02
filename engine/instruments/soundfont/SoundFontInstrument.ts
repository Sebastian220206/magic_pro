import { VoiceAllocator } from './VoiceAllocator';
import { SampleManager } from './SampleManager';
import { PresetManager } from './PresetManager';
import { SamplePlayer } from './SamplePlayer';
import { SoundFontLoader, SoundFontFileInfo } from './SoundFontLoader';
import type { Sf2ParsedData } from './SoundFontParser';

export interface SoundFontInstrumentConfig {
    maxVoices?: number;
    gain?: number;
}

export class SoundFontInstrument {
    private ctx: AudioContext | OfflineAudioContext;
    private outputNode: GainNode;
    private voiceAllocator: VoiceAllocator;
    private sampleManager: SampleManager;
    private _presetManager: PresetManager;
    private samplePlayer: SamplePlayer;
    private fontLoader: SoundFontLoader;
    private _gain: number = 1;
    private _currentFontId: string | null = null;
    private _currentPresetIndex: number = 0;
    private _isLoaded: boolean = false;
    private _parsedData: Sf2ParsedData | null = null;

    constructor(ctx: AudioContext | OfflineAudioContext, config?: SoundFontInstrumentConfig) {
        this.ctx = ctx;
        this.outputNode = ctx.createGain();
        // SF2 instruments are typically much quieter than synths due to
        // per-zone attenuation and velocity scaling — boost default output
        this.outputNode.gain.value = config?.gain ?? 3.0;
        this._gain = config?.gain ?? 3.0;

        this.voiceAllocator = new VoiceAllocator(ctx, config?.maxVoices ?? 64);
        this.sampleManager = new SampleManager(ctx);
        this._presetManager = new PresetManager();
        this.fontLoader = new SoundFontLoader();
        this.samplePlayer = new SamplePlayer(
            this.voiceAllocator,
            this.sampleManager,
            this._presetManager,
            this.outputNode
        );
    }

    getOutput(): AudioNode {
        return this.outputNode;
    }

    get gain(): number {
        return this._gain;
    }

    setVolume(volume: number) {
        this._gain = Math.max(0, Math.min(volume, 3));
        this.outputNode.gain.value = this._gain;
    }

    get loader(): SoundFontLoader {
        return this.fontLoader;
    }

    get presetManager(): PresetManager {
        return this._presetManager;
    }

    get currentFontId(): string | null {
        return this._currentFontId;
    }

    get currentPresetIndex(): number {
        return this._currentPresetIndex;
    }

    get isLoaded(): boolean {
        return this._isLoaded;
    }

    get parsedData(): Sf2ParsedData | null {
        return this._parsedData;
    }

    async loadFont(file: File): Promise<string> {
        const result = await this.fontLoader.loadFromFile(file);
        this._currentFontId = this.fontLoader.getFontNames()[this.fontLoader.getFontCount() - 1];
        const font = this.fontLoader.getFont(this._currentFontId);
        if (font) this._parsedData = font.parsedData;
        return this._currentFontId;
    }

    async loadFontFromPath(path: string): Promise<string> {
        const result = await this.fontLoader.loadFromPath(path);
        this._currentFontId = this.fontLoader.getFontNames()[this.fontLoader.getFontCount() - 1];
        const font = this.fontLoader.getFont(this._currentFontId);
        if (font) this._parsedData = font.parsedData;
        return this._currentFontId;
    }

    async loadFontFromBuffer(data: ArrayBuffer, name: string): Promise<string> {
        const result = await this.fontLoader.loadFromBuffer(data, name);
        this._currentFontId = this.fontLoader.getFontNames()[this.fontLoader.getFontCount() - 1];
        const font = this.fontLoader.getFont(this._currentFontId);
        if (font) this._parsedData = font.parsedData;
        return this._currentFontId;
    }

    async loadFromParsedData(fontId: string, parsedData: Sf2ParsedData, data: ArrayBuffer, name: string): Promise<string> {
        this._currentFontId = fontId;
        this._parsedData = parsedData;
        this.sampleManager.setSampleRate(parsedData.sampleRate);
        this.sampleManager.clear();
        return fontId;
    }

    selectPreset(presetIndex: number): boolean {
        const data = this._parsedData;
        if (!data) return false;
        if (presetIndex < 0 || presetIndex >= data.presets.length) return false;

        this._currentPresetIndex = presetIndex;
        this._presetManager.load(data);
        this.samplePlayer.loadPreset(presetIndex);
        this._isLoaded = true;
        return true;
    }

    selectPresetByBankProgram(bank: number, program: number): boolean {
        if (!this._parsedData) return false;
        const preset = this._parsedData.presets.find(p => p.bank === bank && p.preset === program);
        if (!preset) return false;
        const index = this._parsedData.presets.indexOf(preset);
        return this.selectPreset(index);
    }

    getPresetList(): { name: string; index: number; bank: number; program: number }[] {
        if (!this._parsedData) return [];
        return this._parsedData.presets.map((p, index) => ({
            name: p.name,
            index,
            bank: p.bank,
            program: p.preset,
        }));
    }

    noteOn(note: number, velocity: number = 100, time: number = 0) {
        if (!this._isLoaded) return;
        this.samplePlayer.noteOn(note, velocity, time);
    }

    noteOff(note: number, time: number = 0) {
        if (!this._isLoaded) return;
        this.samplePlayer.noteOff(note, time);
    }

    allNotesOff(time: number = 0) {
        if (!this._isLoaded) return;
        this.samplePlayer.allNotesOff(time);
    }

    sustainOn() {
        if (!this._isLoaded) return;
        this.samplePlayer.sustainOn();
    }

    sustainOff(time: number = 0) {
        if (!this._isLoaded) return;
        this.samplePlayer.sustainOff(time);
    }

    cleanup() {
        this.samplePlayer.cleanup();
    }

    dispose() {
        this.samplePlayer.allNotesOff(0);
        this.voiceAllocator.dispose();
        this.sampleManager.dispose();
        this._presetManager.unload();
        this.outputNode.disconnect();
        this._isLoaded = false;
        this._parsedData = null;
    }

    getActiveVoiceCount(): number {
        return this.voiceAllocator.getActiveVoiceCount();
    }

    getSerializableState() {
        if (!this._currentFontId) return null;
        return {
            fontName: this._parsedData?.presets[0]?.name ?? 'Unknown',
            fontId: this._currentFontId,
            presetIndex: this._currentPresetIndex,
            gain: this._gain,
        };
    }
}
