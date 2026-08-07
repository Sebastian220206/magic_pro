import { type SampleZone } from './multiSamplerEngine';

interface SfzOpcodes {
  sample?: string;
  key?: number;
  lokey?: number;
  hikey?: number;
  lovel?: number;
  hivel?: number;
  pitch_keycenter?: number;
  seq_position?: number;
  seq_length?: number;
}

function parseOpcodes(line: string): Record<string, string> {
  const opcodes: Record<string, string> = {};
  const tokens = line.split(/\s+/);
  for (const token of tokens) {
    const eqIdx = token.indexOf('=');
    if (eqIdx > 0) {
      opcodes[token.slice(0, eqIdx)] = token.slice(eqIdx + 1).trim();
    }
  }
  return opcodes;
}

function mergeOpcodes(group: SfzOpcodes, region: Record<string, string>): SfzOpcodes {
  return {
    sample: region['sample'] ?? group.sample,
    key: region['key'] !== undefined ? parseInt(region['key'], 10) : group.key,
    lokey: region['lokey'] !== undefined ? parseInt(region['lokey'], 10) : group.lokey,
    hikey: region['hikey'] !== undefined ? parseInt(region['hikey'], 10) : group.hikey,
    lovel: region['lovel'] !== undefined ? parseInt(region['lovel'], 10) : group.lovel,
    hivel: region['hivel'] !== undefined ? parseInt(region['hivel'], 10) : group.hivel,
    pitch_keycenter: region['pitch_keycenter'] !== undefined
      ? parseInt(region['pitch_keycenter'], 10)
      : group.pitch_keycenter,
    seq_position: region['seq_position'] !== undefined
      ? parseInt(region['seq_position'], 10)
      : group.seq_position,
    seq_length: region['seq_length'] !== undefined
      ? parseInt(region['seq_length'], 10)
      : group.seq_length,
  };
}

function buildZone(opcodes: SfzOpcodes): SampleZone | null {
  if (!opcodes.sample) return null;

  const key = opcodes.key;
  const loNote = opcodes.lokey ?? key ?? 0;
  const hiNote = opcodes.hikey ?? key ?? 127;
  const rootNote = opcodes.pitch_keycenter ?? key ?? loNote;
  const loVel = opcodes.lovel ?? 0;
  const hiVel = opcodes.hivel ?? 127;
  const rrGroup = opcodes.seq_position ?? 1;

  return {
    path: opcodes.sample,
    rootNote: Math.max(0, Math.min(127, rootNote)),
    loNote: Math.max(0, Math.min(127, loNote)),
    hiNote: Math.max(0, Math.min(127, hiNote)),
    loVel: Math.max(0, Math.min(127, loVel)),
    hiVel: Math.max(0, Math.min(127, hiVel)),
    rrGroup: Math.max(1, rrGroup),
  };
}

/**
 * Parse SFZ format text into SampleZone array.
 *
 * SFZ is a text-based format with `<group>` and `<region>` sections.
 * Each line is either a section header or a key=value opcode pair.
 * Group-level opcodes are inherited by subsequent regions.
 */
export function parseSfz(text: string): SampleZone[] {
  const zones: SampleZone[] = [];
  const lines = text.split(/\r?\n/);

  let groupOpcodes: SfzOpcodes = {};
  let regionOpcodes: Record<string, string> = {};
  let hasRegion = false;

  const flushRegion = () => {
    if (!hasRegion) return;
    const merged = mergeOpcodes(groupOpcodes, regionOpcodes);
    const zone = buildZone(merged);
    if (zone) zones.push(zone);
    regionOpcodes = {};
    hasRegion = false;
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (line === '' || line.startsWith('//') || line.startsWith('/*')) {
      continue;
    }

    const lower = line.toLowerCase();

    if (lower === '<group>') {
      flushRegion();
      continue;
    }

    if (lower === '<region>') {
      flushRegion();
      hasRegion = true;
      continue;
    }

    const opcodes = parseOpcodes(line);

    if (!hasRegion) {
      for (const [k, v] of Object.entries(opcodes)) {
        if (['sample', 'key', 'lokey', 'hikey', 'lovel', 'hivel',
             'pitch_keycenter', 'seq_position', 'seq_length'].includes(k)) {
          (groupOpcodes as Record<string, string | number>)[k] =
            ['key', 'lokey', 'hikey', 'lovel', 'hivel',
             'pitch_keycenter', 'seq_position', 'seq_length'].includes(k)
              ? parseInt(v, 10)
              : v;
        }
      }
    } else {
      Object.assign(regionOpcodes, opcodes);
    }
  }

  flushRegion();

  return zones;
}
