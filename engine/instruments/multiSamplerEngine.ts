/**
 * MultiSamplerEngine
 * Generic sampler engine supporting velocity layers and round robin.
 * Supports DecentSampler (.dspreset), SFZ, and EXS24 formats.
 */

import { parseSfz } from './sfzParser';
import { parseExs } from './exsParser';

export type SampleZone = {
  path: string;
  rootNote: number;
  loNote: number;
  hiNote: number;
  loVel: number;
  hiVel: number;
  rrGroup: number;
};

export async function parseDspreset(xmlText: string): Promise<SampleZone[]> {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, "text/xml");
  
  const zones: SampleZone[] = [];
  
  // DecentSampler structure: <groups><group><sample /></group></groups>
  // loVel/hiVel are often on the <group> tag.
  const groups = doc.querySelectorAll('group');
  
  groups.forEach(group => {
    const gLoVel = parseInt(group.getAttribute('loVel') || '0', 10);
    const gHiVel = parseInt(group.getAttribute('hiVel') || '127', 10);
    
    const sampleNodes = group.querySelectorAll('sample');
    sampleNodes.forEach((node) => {
      const path = node.getAttribute('path') || '';
      const rootNote = parseInt(node.getAttribute('rootNote') || '60', 10);
      const loNote = parseInt(node.getAttribute('loNote') || rootNote.toString(), 10);
      const hiNote = parseInt(node.getAttribute('hiNote') || rootNote.toString(), 10);
      
      const loVel = parseInt(node.getAttribute('loVel') || gLoVel.toString(), 10);
      const hiVel = parseInt(node.getAttribute('hiVel') || gHiVel.toString(), 10);
      
      let rrGroup = parseInt(node.getAttribute('seqPosition') || '1', 10);
      if (node.getAttribute('seqPosition') == null) {
          const match = path.match(/RR(\d+)/i);
          if (match) rrGroup = parseInt(match[1], 10);
          else rrGroup = 1; 
      }
      
      zones.push({ path, rootNote, loNote, hiNote, loVel, hiVel, rrGroup });
    });
  });

  // Handle samples not in groups (flat structure)
  if (zones.length === 0) {
      const flatSamples = doc.querySelectorAll('sample');
      flatSamples.forEach(node => {
          if (node.parentElement?.tagName === 'group') return;
          const path = node.getAttribute('path') || '';
          const rootNote = parseInt(node.getAttribute('rootNote') || '60', 10);
          const loNote = parseInt(node.getAttribute('loNote') || rootNote.toString(), 10);
          const hiNote = parseInt(node.getAttribute('hiNote') || rootNote.toString(), 10);
          const loVel = parseInt(node.getAttribute('loVel') || '0', 10);
          const hiVel = parseInt(node.getAttribute('hiVel') || '127', 10);
          let rrGroup = parseInt(node.getAttribute('seqPosition') || '1', 10);
          zones.push({ path, rootNote, loNote, hiNote, loVel, hiVel, rrGroup });
      });
  }
  
  return zones;
}

const bufferCache = new Map<string, AudioBuffer>();

function getSampleUrl(path: string, basePath: string): string {
    let urlPath = path;
    if (urlPath.startsWith('Samples/')) { urlPath = urlPath.slice(8); }
    // Add cache buster to prevent persistent 204 errors from browser cache
    const cb = `?v=${Date.now()}`;
    const encoded = encodeURIComponent(urlPath).replace(/%2F/g, '/');
    return `${basePath}${encoded}${cb}`;
}

async function fetchSample(ctx: AudioContext, url: string): Promise<AudioBuffer> {
    if (bufferCache.has(url)) return bufferCache.get(url)!;
    console.log(`[MultiSampler] Fetching: ${url}`);
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`[Sampler] ${response.status} for ${url}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength === 0) {
        throw new Error(`[Sampler] 0 bytes received for ${url}`);
    }
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    bufferCache.set(url, audioBuffer);
    return audioBuffer;
}

class SamplerNoteMapper {
    private zones: SampleZone[] = [];
    private rrIndex: Record<string, number> = {}; // key: note_velRange
    
    constructor(zones: SampleZone[]) { this.zones = zones; }
    
    getMapping(note: number, velocity: number): SampleZone | null {
        // Filter by note range AND velocity range
        const matchingZones = this.zones.filter(z => 
            note >= z.loNote && note <= z.hiNote && 
            velocity >= z.loVel && velocity <= z.hiVel
        );
        
        if (matchingZones.length === 0) {
            // Fallback: try to find matching velocity but nearest note
            const vZones = this.zones.filter(z => velocity >= z.loVel && velocity <= z.hiVel);
            if (vZones.length === 0) return this.zones[0] || null;
            
            let closest = vZones[0];
            let minDiff = Infinity;
            for (const z of vZones) {
                const diff = Math.abs(z.rootNote - note);
                if (diff < minDiff) { minDiff = diff; closest = z; }
            }
            const variants = vZones.filter(z => z.rootNote === closest.rootNote);
            return this.pickRR(closest.rootNote, velocity, variants);
        }
        
        const rootNote = matchingZones[0].rootNote;
        const variants = matchingZones.filter(z => z.rootNote === rootNote);
        return this.pickRR(rootNote, velocity, variants);
    }
    
    private pickRR(rootNote: number, velocity: number, variants: SampleZone[]): SampleZone {
        if (variants.length <= 1) return variants[0];
        variants.sort((a, b) => a.rrGroup - b.rrGroup);
        
        const velLayerId = `${variants[0].loVel}-${variants[0].hiVel}`;
        const key = `${rootNote}_${velLayerId}`;
        
        if (this.rrIndex[key] === undefined) { this.rrIndex[key] = 0; }
        const idx = this.rrIndex[key] % variants.length;
        this.rrIndex[key]++;
        
        return variants[idx];
    }
}

export class MultiSamplerEngine {
    private ctx: AudioContext;
    private masterGain: GainNode;
    private outputNode: GainNode;
    private activeVoices: Map<number, { source: AudioBufferSourceNode, gain: GainNode }> = new Map();
    private mapper: SamplerNoteMapper | null = null;
    private loaded = false;
    private basePath = '/';

    constructor(ctx: AudioContext) {
        this.ctx = ctx;
        this.masterGain = ctx.createGain();
        this.masterGain.gain.value = 1.0;
        this.outputNode = ctx.createGain();
        this.masterGain.connect(this.outputNode);
    }

    public getOutput(): AudioNode { return this.outputNode; }

    public async initialize(xmlText: string, basePath: string) {
        console.log('[MultiSampler] Initializing with on-demand loading...');
        this.basePath = basePath;
        const zones = await parseDspreset(xmlText);
        this.mapper = new SamplerNoteMapper(zones);
        this.loaded = true;
        console.log('[MultiSampler] Initialization Ready.');
    }

    public initializeFromZones(zones: SampleZone[], basePath: string = '/') {
        console.log(`[MultiSampler] Initializing from ${zones.length} zones...`);
        this.basePath = basePath;
        this.mapper = new SamplerNoteMapper(zones);
        this.loaded = true;
        console.log('[MultiSampler] Initialization Ready.');
    }

    public async playNote(note: number, velocity: number, time?: number): Promise<void> {
        if (!this.loaded || !this.mapper) return;
        const t = time ?? this.ctx.currentTime;
        const zone = this.mapper.getMapping(note, velocity);
        if (!zone) return;

        const url = getSampleUrl(zone.path, this.basePath);
        let buffer = bufferCache.get(url);
        
        if (!buffer) {
            try {
                buffer = await fetchSample(this.ctx, url);
            } catch (e) {
                console.warn('[MultiSampler] Play fail:', url, e);
                return;
            }
        }
        
        if (!buffer) return;

        const source = this.ctx.createBufferSource();
        source.buffer = buffer;
        source.playbackRate.value = Math.pow(2, (note - zone.rootNote) / 12);
        
        const gainNode = this.ctx.createGain();
        const peakGain = velocity / 127;
        
        gainNode.gain.setValueAtTime(0, t);
        gainNode.gain.linearRampToValueAtTime(peakGain, t + 0.005);
        // Piano usually has a long natural decay if pedal is down, 
        // but here we just let it fade over 5s unless noteOff called.
        gainNode.gain.exponentialRampToValueAtTime(0.001, t + 5.0);
        
        source.connect(gainNode);
        gainNode.connect(this.masterGain);
        source.start(t);
        
        this.activeVoices.set(note, { source, gain: gainNode });
        source.onended = () => {
             const active = this.activeVoices.get(note);
             if (active && active.source === source) { this.activeVoices.delete(note); }
        };
    }

    public noteOff(note: number, time?: number): void {
        const t = time ?? this.ctx.currentTime;
        const voice = this.activeVoices.get(note);
        if (voice) {
            voice.gain.gain.cancelScheduledValues(t);
            voice.gain.gain.setValueAtTime(voice.gain.gain.value, t);
            voice.gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3); // Smooth release
            try { voice.source.stop(t + 0.35); } catch { }
            this.activeVoices.delete(note);
        }
    }

    public stopAll(time?: number): void {
        const t = time ?? this.ctx.currentTime;
        this.activeVoices.forEach(({ source, gain }, note) => {
            try {
                gain.gain.cancelScheduledValues(t);
                gain.gain.setValueAtTime(gain.gain.value, t);
                gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
                source.stop(t + 0.35);
            } catch { }
        });
        this.activeVoices.clear();
    }

    public dispose(): void {
        this.activeVoices.forEach(v => { try { v.source.stop(); } catch{} });
        this.activeVoices.clear();
        this.masterGain.disconnect();
    }
}

export async function createSamplerInstrument(ctx: AudioContext, dspPath: string): Promise<MultiSamplerEngine> {
    const res = await fetch(dspPath);
    if (!res.ok) throw new Error(`[MultiSampler] DSP 404: ${dspPath}`);
    const xml = await res.text();
    const engine = new MultiSamplerEngine(ctx);
    // Ensure basePath ends with slash
    let basePath = dspPath.substring(0, dspPath.lastIndexOf('/') + 1);
    await engine.initialize(xml, basePath);
    return engine;
}

export async function createSfzInstrument(ctx: AudioContext, sfzPath: string): Promise<MultiSamplerEngine> {
    const res = await fetch(sfzPath);
    if (!res.ok) throw new Error(`[MultiSampler] SFZ 404: ${sfzPath}`);
    const text = await res.text();
    const zones = parseSfz(text);
    const engine = new MultiSamplerEngine(ctx);
    const basePath = sfzPath.substring(0, sfzPath.lastIndexOf('/') + 1);
    engine.initializeFromZones(zones, basePath);
    return engine;
}

export async function createExsInstrument(ctx: AudioContext, exsPath: string): Promise<MultiSamplerEngine> {
    const res = await fetch(exsPath);
    if (!res.ok) throw new Error(`[MultiSampler] EXS 404: ${exsPath}`);
    const buffer = await res.arrayBuffer();
    const zones = parseExs(buffer);
    const engine = new MultiSamplerEngine(ctx);
    const basePath = exsPath.substring(0, exsPath.lastIndexOf('/') + 1);
    engine.initializeFromZones(zones, basePath);
    return engine;
}
