/**
 * sf2Builder.ts
 * A minimal SF2 writer for tests.
 *
 * Synthetic bytes rather than a real font, so tests run without a 30 MB asset
 * and describe exactly the structure they depend on. Shared by the parser's own
 * tests and by the manifest test that pins the build script's independent
 * `phdr` reader against the engine parser.
 */

/** A single generator: an operator and its value. */
export type Gen = [oper: number, value: number];

/** One zone — a bag pointing at a run of generators. */
export interface Bag { gens: Gen[] }

export interface FontSpec {
    presets: { name: string; bank: number; program: number; bags: Bag[] }[];
    instruments: { name: string; bags: Bag[] }[];
    samples: { name: string; start: number; end: number; rootKey: number }[];
    sampleCount: number;
}

function chunk(id: string, body: Uint8Array): Uint8Array {
    const out = new Uint8Array(8 + body.length + (body.length % 2));
    out.set(new TextEncoder().encode(id), 0);
    new DataView(out.buffer).setUint32(4, body.length, true);
    out.set(body, 8);
    return out;
}

function concat(...parts: Uint8Array[]): Uint8Array {
    const total = parts.reduce((n, p) => n + p.length, 0);
    const out = new Uint8Array(total);
    let at = 0;
    for (const p of parts) { out.set(p, at); at += p.length; }
    return out;
}

function name20(s: string): Uint8Array {
    const out = new Uint8Array(20);
    out.set(new TextEncoder().encode(s).slice(0, 19));
    return out;
}

/** Pack a key or velocity range into the single word SF2 stores it as. */
export function range(lo: number, hi: number): number { return lo | (hi << 8); }

/** Flatten bags into a bag chunk (+ terminal record) and a generator chunk. */
function bagsAndGens(bags: Bag[]): { bag: Uint8Array; gen: Uint8Array } {
    const bag = new Uint8Array((bags.length + 1) * 4);
    const bagView = new DataView(bag.buffer);
    const gens: Gen[] = [];
    bags.forEach((b, i) => {
        bagView.setUint16(i * 4, gens.length, true);
        bagView.setUint16(i * 4 + 2, 0, true);
        gens.push(...b.gens);
    });
    bagView.setUint16(bags.length * 4, gens.length, true);
    bagView.setUint16(bags.length * 4 + 2, 0, true);

    // Generator chunk carries its own terminal record.
    const gen = new Uint8Array((gens.length + 1) * 4);
    const genView = new DataView(gen.buffer);
    gens.forEach(([oper, value], i) => {
        genView.setUint16(i * 4, oper, true);
        genView.setInt16(i * 4 + 2, value, true);
    });
    return { bag, gen };
}

/** Assemble a complete, parseable SF2 file. */
export function buildSf2(spec: FontSpec): ArrayBuffer {
    const presetBags = spec.presets.flatMap(p => p.bags);
    const instBags = spec.instruments.flatMap(i => i.bags);
    const pb = bagsAndGens(presetBags);
    const ib = bagsAndGens(instBags);

    // phdr: one record per preset plus the terminal EOP.
    const phdr = new Uint8Array((spec.presets.length + 1) * 38);
    const phdrView = new DataView(phdr.buffer);
    let bagAt = 0;
    spec.presets.forEach((p, i) => {
        phdr.set(name20(p.name), i * 38);
        phdrView.setUint16(i * 38 + 20, p.program, true);
        phdrView.setUint16(i * 38 + 22, p.bank, true);
        phdrView.setUint16(i * 38 + 24, bagAt, true);
        bagAt += p.bags.length;
    });
    phdr.set(name20('EOP'), spec.presets.length * 38);
    phdrView.setUint16(spec.presets.length * 38 + 24, bagAt, true);

    // inst: one record per instrument plus the terminal EOI.
    const inst = new Uint8Array((spec.instruments.length + 1) * 22);
    const instView = new DataView(inst.buffer);
    let ibagAt = 0;
    spec.instruments.forEach((it, i) => {
        inst.set(name20(it.name), i * 22);
        instView.setUint16(i * 22 + 20, ibagAt, true);
        ibagAt += it.bags.length;
    });
    inst.set(name20('EOI'), spec.instruments.length * 22);
    instView.setUint16(spec.instruments.length * 22 + 20, ibagAt, true);

    const shdr = new Uint8Array((spec.samples.length + 1) * 46);
    const shdrView = new DataView(shdr.buffer);
    spec.samples.forEach((s, i) => {
        shdr.set(name20(s.name), i * 46);
        shdrView.setUint32(i * 46 + 20, s.start, true);
        shdrView.setUint32(i * 46 + 24, s.end, true);
        shdrView.setUint32(i * 46 + 28, s.start, true);   // startLoop
        shdrView.setUint32(i * 46 + 32, s.end, true);     // endLoop
        shdrView.setUint32(i * 46 + 36, 44100, true);
        shdrView.setUint8(i * 46 + 40, s.rootKey);
        shdrView.setUint16(i * 46 + 44, 1, true);         // monoSample
    });
    shdr.set(name20('EOS'), spec.samples.length * 46);

    const smpl = new Uint8Array(spec.sampleCount * 2);

    const sdta = chunk('LIST', concat(new TextEncoder().encode('sdta'), chunk('smpl', smpl)));
    const pdta = chunk('LIST', concat(
        new TextEncoder().encode('pdta'),
        chunk('phdr', phdr),
        chunk('pbag', pb.bag),
        chunk('pmod', new Uint8Array(10)),
        chunk('pgen', pb.gen),
        chunk('inst', inst),
        chunk('ibag', ib.bag),
        chunk('imod', new Uint8Array(10)),
        chunk('igen', ib.gen),
        chunk('shdr', shdr),
    ));
    const info = chunk('LIST', concat(new TextEncoder().encode('INFO'), chunk('ifil', new Uint8Array(4))));

    const body = concat(new TextEncoder().encode('sfbk'), info, sdta, pdta);
    const riff = chunk('RIFF', body);
    return riff.buffer.slice(0, riff.length) as ArrayBuffer;
}
