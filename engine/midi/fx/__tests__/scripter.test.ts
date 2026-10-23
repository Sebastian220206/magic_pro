/**
 * The Scripter's sandbox.
 *
 * The fault these pin: `callFunction` took a handler name and ignored it,
 * running the script body instead and passing the event's arguments to a body
 * that declared no parameters to receive them. Since every preset in
 * `scripter.ts` declares `function onNoteOn(pitch, velocity, beat)`, running
 * the body only *defined* that function and returned nothing — so not one
 * preset ever emitted a note, and the catalogue's stated reason for the
 * Scripter being unavailable ("has no script editor yet") was not the only
 * thing wrong with it.
 *
 * The first test here would have failed against every build before the fix.
 */

import { createScripter, SCRIPTER_PRESETS } from '../scripter';

describe('the sandbox', () => {
    // Two tests below compile deliberately broken scripts, which the Scripter
    // logs. Silenced so a passing run stays readable.
    let consoleError: jest.SpyInstance;
    beforeEach(() => { consoleError = jest.spyOn(console, 'error').mockImplementation(() => { }); });
    afterEach(() => { consoleError.mockRestore(); });

    it('calls the handler the script declared', () => {
        const scripter = createScripter({
            script: 'function onNoteOn(pitch, velocity, beat) { addNote(pitch + 12, velocity, beat, 0.25); }',
        });

        const out = scripter.processEvent({ type: 'noteOn', pitch: 60, velocity: 100, beat: 0 });
        expect(out).toEqual([
            { type: 'note-on', pitch: 72, velocity: 100, beat: 0, duration: 0.25 },
        ]);
    });

    it('passes the event through to the handler\'s parameters', () => {
        const scripter = createScripter({
            script: 'function onNoteOn(pitch, velocity, beat) { addNote(pitch, velocity, beat, 1); }',
        });

        const [note] = scripter.processEvent({ type: 'noteOn', pitch: 41, velocity: 77, beat: 2 }) as never[];
        expect(note).toMatchObject({ pitch: 41, velocity: 77, beat: 2 });
    });

    it('reports which handlers a script declared', () => {
        const scripter = createScripter({
            script: 'function onNoteOn(p, v, b) {} function onTransportStop() {}',
        });
        expect(scripter.getHandlerNames().sort()).toEqual(['onNoteOn', 'onTransportStop']);
    });

    it('reports no handler for a script that declares none', () => {
        // A typo in `onNoteOn` is otherwise completely silent, which is what
        // the editor's readout exists to surface.
        const scripter = createScripter({ script: 'function onNoteon(p, v, b) {}' });
        expect(scripter.getHandlerNames()).toEqual([]);
    });

    it('is quiet for an event the script does not handle', () => {
        const scripter = createScripter({ script: 'function onNoteOn(p, v, b) { addNote(p, v, b, 1); }' });
        expect(scripter.processEvent({ type: 'noteOff', pitch: 60, beat: 1 })).toEqual([]);
    });

    it('runs top-level statements once, at compile time', () => {
        // The Scale Quantize preset declares `var scale = [...]` outside its
        // handler; evaluating that per note would be wasted work, and a script
        // that counted in a top-level variable would behave differently.
        const scripter = createScripter({
            script: 'var calls = 0; calls++; function onNoteOn(p, v, b) { addNote(calls, v, b, 1); }',
        });

        scripter.processEvent({ type: 'noteOn', pitch: 60, velocity: 100, beat: 0 });
        const [second] = scripter.processEvent({ type: 'noteOn', pitch: 60, velocity: 100, beat: 0 }) as never[];
        expect(second).toMatchObject({ pitch: 1 });
    });

    it('keeps the message from a script that will not compile', () => {
        const scripter = createScripter({ script: 'function onNoteOn( {' });
        expect(scripter.compile()).toBe(false);
        expect(scripter.getLastError()).toMatch(/compilation failed/i);
    });

    it('clears the error once a good script compiles', () => {
        const scripter = createScripter({ script: 'function onNoteOn( {' });
        scripter.compile();
        scripter.setScript('function onNoteOn(p, v, b) {}');
        expect(scripter.compile()).toBe(true);
        expect(scripter.getLastError()).toBeNull();
    });

    it('produces nothing while disabled', () => {
        const scripter = createScripter({ script: 'function onNoteOn(p, v, b) { addNote(p, v, b, 1); }' });
        scripter.setEnabled(false);
        expect(scripter.processEvent({ type: 'noteOn', pitch: 60, velocity: 100, beat: 0 })).toEqual([]);
    });
});

describe('the shipped presets', () => {
    // Each preset is a worked example someone will load first. One that
    // compiles but emits nothing teaches that the Scripter is broken.
    it.each(Object.entries(SCRIPTER_PRESETS))('%s compiles and emits a note', (_id, preset) => {
        const scripter = createScripter({ script: preset.script });
        expect(scripter.compile()).toBe(true);

        const out = scripter.processEvent({ type: 'noteOn', pitch: 62, velocity: 90, beat: 0 });
        expect(out.length).toBeGreaterThan(0);
    });
});
