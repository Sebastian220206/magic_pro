import { type SampleZone } from './multiSamplerEngine';

/**
 * EXS24/EXS binary format parser.
 *
 * Parses Logic Pro's EXS24 sampler format (.exs files) into SampleZone[].
 * Format structure:
 *   - Header: "EXS2" magic (4 bytes) + version + offsets
 *   - Zone table: key range, velocity range, root note, sample index, flags
 *   - Sample table: file paths, root notes, etc.
 */

const EXS_MAGIC = 0x32535845; // "EXS2" in little-endian

interface ExsZone {
  loKey: number;
  hiKey: number;
  rootKey: number;
  loVel: number;
  hiVel: number;
  sampleIndex: number;
  seqPosition: number;
}

interface ExsSample {
  path: string;
  rootKey: number;
}

function readUint8(view: DataView, offset: number): number {
  return view.getUint8(offset);
}

function readUint16(view: DataView, offset: number): number {
  return view.getUint16(offset, true);
}

function readUint32(view: DataView, offset: number): number {
  return view.getUint32(offset, true);
}

function readString(view: DataView, offset: number, maxLen: number): string {
  let str = '';
  for (let i = 0; i < maxLen; i++) {
    const ch = view.getUint8(offset + i);
    if (ch === 0) break;
    str += String.fromCharCode(ch);
  }
  return str;
}

/**
 * Parse EXS24 binary format into SampleZone array.
 *
 * @param buffer - ArrayBuffer containing the .exs file data
 * @returns Array of SampleZone objects
 */
export function parseExs(buffer: ArrayBuffer): SampleZone[] {
  const view = new DataView(buffer);

  const magic = readUint32(view, 0);
  if (magic !== EXS_MAGIC) {
    throw new Error(`Invalid EXS file: expected magic 0x${EXS_MAGIC.toString(16)}, got 0x${magic.toString(16)}`);
  }

  const version = readUint32(view, 4);

  let offset = 8;

  const numZones = readUint32(view, offset);
  offset += 4;

  const zoneTableOffset = readUint32(view, offset);
  offset += 4;

  const numSamples = readUint32(view, offset);
  offset += 4;

  const sampleTableOffset = readUint32(view, offset);
  offset += 4;

  const zones: ExsZone[] = [];
  const samples: ExsSample[] = [];

  let zOff = zoneTableOffset;
  for (let i = 0; i < numZones; i++) {
    const loKey = readUint8(view, zOff);
    const hiKey = readUint8(view, zOff + 1);
    const rootKey = readUint8(view, zOff + 2);
    const loVel = readUint8(view, zOff + 3);
    const hiVel = readUint8(view, zOff + 4);
    const sampleIdx = readUint16(view, zOff + 6);
    const seqPosition = readUint16(view, zOff + 8);

    zones.push({
      loKey,
      hiKey,
      rootKey,
      loVel,
      hiVel,
      sampleIndex: sampleIdx,
      seqPosition,
    });

    zOff += 32;
  }

  let sOff = sampleTableOffset;
  for (let i = 0; i < numSamples; i++) {
    const path = readString(view, sOff, 64);
    const rootKey = readUint8(view, sOff + 64);

    samples.push({ path, rootKey });
    sOff += 128;
  }

  return zones.map((zone): SampleZone => {
    const sample = samples[zone.sampleIndex];
    return {
      path: sample?.path ?? '',
      rootNote: zone.rootKey,
      loNote: zone.loKey,
      hiNote: zone.hiKey,
      loVel: zone.loVel,
      hiVel: zone.hiVel,
      rrGroup: Math.max(1, zone.seqPosition || 1),
    };
  }).filter(z => z.path !== '');
}
