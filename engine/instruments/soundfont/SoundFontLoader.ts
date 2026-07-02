import { SoundFontParser, Sf2ParsedData } from './SoundFontParser';
import { PresetManager } from './PresetManager';

export interface SoundFontLoadResult {
    name: string;
    presetCount: number;
    fileSize: number;
}

export interface SoundFontFileInfo {
    id: string;
    name: string;
    path?: string;
    data: ArrayBuffer;
    parsedData: Sf2ParsedData;
    presetManager: PresetManager;
}

export class SoundFontLoader {
    private loaded: Map<string, SoundFontFileInfo> = new Map();
    private parser = new SoundFontParser();

    get loadedFonts(): ReadonlyMap<string, SoundFontFileInfo> {
        return this.loaded;
    }

    getFontCount(): number {
        return this.loaded.size;
    }

    getFont(id: string): SoundFontFileInfo | undefined {
        return this.loaded.get(id);
    }

    async loadFromFile(file: File): Promise<SoundFontLoadResult> {
        const arrayBuffer = await file.arrayBuffer();
        return this.loadFromBuffer(arrayBuffer, file.name);
    }

    async loadFromBuffer(arrayBuffer: ArrayBuffer, name: string): Promise<SoundFontLoadResult> {
        const parsedData = this.parser.parse(arrayBuffer);

        if (parsedData.presets.length === 0) {
            throw new Error(`No presets found in SoundFont: ${name}`);
        }

        const id = this.generateId(name);
        const presetManager = new PresetManager();
        presetManager.load(parsedData);

        this.loaded.set(id, {
            id,
            name,
            data: arrayBuffer,
            parsedData,
            presetManager,
        });

        return {
            name,
            presetCount: parsedData.presets.length,
            fileSize: arrayBuffer.byteLength,
        };
    }

    async loadFromParsedData(parsedData: Sf2ParsedData, name: string, data: ArrayBuffer): Promise<SoundFontLoadResult> {
        const id = this.generateId(name);
        const presetManager = new PresetManager();
        presetManager.load(parsedData);

        this.loaded.set(id, {
            id,
            name,
            data,
            parsedData,
            presetManager,
        });

        return {
            name,
            presetCount: parsedData.presets.length,
            fileSize: data.byteLength,
        };
    }

    async loadFromPath(path: string): Promise<SoundFontLoadResult> {
        const response = await fetch(path);
        if (!response.ok) {
            throw new Error(`Failed to fetch SoundFont: ${path}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        const name = path.split('/').pop() ?? path;
        return this.loadFromBuffer(arrayBuffer, name);
    }

    unload(id: string): boolean {
        if (this.loaded.has(id)) {
            const font = this.loaded.get(id)!;
            font.presetManager.unload();
            this.loaded.delete(id);
            return true;
        }
        return false;
    }

    unloadAll() {
        for (const [id] of this.loaded) {
            this.unload(id);
        }
    }

    getPresetNames(id: string): { name: string; index: number; bank: number; program: number }[] {
        const font = this.loaded.get(id);
        if (!font) return [];
        return font.presetManager.getPresets().map((p, index) => ({
            name: p.name,
            index,
            bank: p.bank,
            program: p.preset,
        }));
    }

    getFontNames(): string[] {
        return Array.from(this.loaded.keys());
    }

    private generateId(name: string): string {
        const timestamp = Date.now();
        const cleanName = name.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 32);
        return `sf2-${cleanName}-${timestamp}`;
    }
}
