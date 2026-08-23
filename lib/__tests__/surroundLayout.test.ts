import {
    SURROUND_FORMAT_CHANNELS,
    channelCount,
    hasChannel,
    defaultAssignments,
    portOptions,
    defaultExtensions,
    DEFAULT_BOUNCE_EXTENSIONS,
} from '../surroundLayout';

describe('surround layouts', () => {
    it('counts the channels a format carries', () => {
        expect(channelCount('5.1 (ITU 775)')).toBe(6);
        expect(channelCount('7.1')).toBe(8);
        expect(channelCount('7.1.4')).toBe(12);
    });

    it('falls back to 5.1 for a format it does not know', () => {
        expect(channelCount('made up')).toBe(6);
        expect(hasChannel('made up', 'lfe')).toBe(true);
        expect(hasChannel('made up', 'lts')).toBe(false);
    });

    it('knows which channels a format does not address', () => {
        // The reference screenshot dims exactly these five under 7.1.4.
        for (const channel of ['lc', 'rc', 'surround', 'ltm', 'rtm'] as const) {
            expect(hasChannel('7.1.4', channel)).toBe(false);
        }
        for (const channel of ['left', 'right', 'center', 'lfe', 'lm', 'rm', 'ls', 'rs', 'lt', 'rt', 'lts', 'rts'] as const) {
            expect(hasChannel('7.1.4', channel)).toBe(true);
        }
    });

    it('numbers 7.1.4 outputs the way the reference does', () => {
        expect(defaultAssignments('7.1.4', 'Output', 'Default')).toEqual({
            left: 'Output 1',
            right: 'Output 2',
            ls: 'Output 3',
            rs: 'Output 4',
            center: 'Output 5',
            lfe: 'Output 6',
            lm: 'Output 7',
            rm: 'Output 8',
            lt: 'Output 9',
            rt: 'Output 10',
            lts: 'Output 11',
            rts: 'Output 12',
        });
    });

    it('gives each Initialize button a different wiring', () => {
        const dflt = defaultAssignments('5.1 (ITU 775)', 'Output', 'Default');
        const itu = defaultAssignments('5.1 (ITU 775)', 'Output', 'ITU');
        const wg4 = defaultAssignments('5.1 (ITU 775)', 'Output', 'WG-4');

        // ITU-R BS.775 is L R C LFE Ls Rs.
        expect(itu.center).toBe('Output 3');
        expect(itu.lfe).toBe('Output 4');
        // Logic's film order puts the surrounds before the centre.
        expect(dflt.ls).toBe('Output 3');
        expect(dflt.center).toBe('Output 5');
        // WG-4 runs the front row left to right.
        expect(wg4.center).toBe('Output 2');
        expect(wg4.right).toBe('Output 3');
    });

    it('assigns every carried channel exactly one port, in every order', () => {
        for (const format of Object.keys(SURROUND_FORMAT_CHANNELS)) {
            for (const order of ['Default', 'ITU', 'WG-4'] as const) {
                const assignments = defaultAssignments(format, 'Input', order);
                const ports = Object.values(assignments);
                expect(ports).toHaveLength(channelCount(format));
                expect(new Set(ports).size).toBe(ports.length);
                for (const channel of SURROUND_FORMAT_CHANNELS[format]) {
                    expect(assignments[channel]).toMatch(/^Input \d+$/);
                }
            }
        }
    });

    it('offers more ports than the layout needs, so channels can be moved', () => {
        const options = portOptions('7.1.4', 'Output');
        expect(options.length).toBeGreaterThan(channelCount('7.1.4'));
        expect(options[0]).toBe('Output 1');
    });

    it('extends only the channels a format carries', () => {
        const extensions = defaultExtensions('5.1 (ITU 775)');
        expect(extensions.left).toBe('.L');
        expect(extensions.lfe).toBe('.LFE');
        expect(extensions.lts).toBeUndefined();
        expect(DEFAULT_BOUNCE_EXTENSIONS.surround).toBe('.Cs');
    });

    it('gives every channel a distinct bounce extension', () => {
        const values = Object.values(DEFAULT_BOUNCE_EXTENSIONS);
        expect(new Set(values).size).toBe(values.length);
    });
});
