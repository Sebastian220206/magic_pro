import { Sf2ParsedData, Sf2Preset, Sf2Generator, GenOper } from './SoundFontParser';

export interface ActivePresetInfo {
    presetIndex: number;
    bank: number;
    program: number;
    name: string;
}

export class PresetManager {
    private parsedData: Sf2ParsedData | null = null;

    load(data: Sf2ParsedData) {
        this.parsedData = data;
    }

    getPresets(): Sf2Preset[] {
        return this.parsedData?.presets ?? [];
    }

    getPreset(index: number): Sf2Preset | undefined {
        return this.parsedData?.presets[index];
    }

    findPreset(bank: number, program: number): Sf2Preset | undefined {
        return this.parsedData?.presets.find(p => p.bank === bank && p.preset === program);
    }

    findPresetsByName(query: string): Sf2Preset[] {
        const lower = query.toLowerCase();
        return (this.parsedData?.presets ?? []).filter(p =>
            p.name.toLowerCase().includes(lower)
        );
    }

    getPresetCount(): number {
        return this.parsedData?.presets.length ?? 0;
    }

    getBanks(): number[] {
        if (!this.parsedData) return [];
        return [...new Set(this.parsedData.presets.map(p => p.bank))].sort((a, b) => a - b);
    }

    getPresetsForBank(bank: number): Sf2Preset[] {
        return (this.parsedData?.presets ?? []).filter(p => p.bank === bank);
    }

    getPresetGenerators(preset: Sf2Preset): Sf2Generator[] {
        const merged = new Map<number, Sf2Generator>();
        for (const zone of preset.zones) {
            for (const gen of zone.generators) {
                merged.set(gen.genOper, gen);
            }
        }
        return Array.from(merged.values());
    }

    getSampleRate(): number {
        return this.parsedData?.sampleRate ?? 44100;
    }

    getSampleHeaders() {
        return this.parsedData?.sampleHeaders ?? [];
    }

    getSampleData(): Float32Array {
        return this.parsedData?.sampleData ?? new Float32Array(0);
    }

    isLoaded(): boolean {
        return this.parsedData !== null;
    }

    unload() {
        this.parsedData = null;
    }
}
