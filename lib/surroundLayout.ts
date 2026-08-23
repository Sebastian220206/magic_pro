/**
 * Surround channel layouts, and what each one is wired to.
 *
 * The Audio > I/O Assignments panels drew a grid of surround channels whose
 * dropdowns held a single option and no handler: every one of them was a
 * picture of a control. Worse, which channels were dimmed was hardcoded, so the
 * panel showed a 7.1.4 layout no matter what the project was set to.
 *
 * A surround format is really just an ordered list of channels, so that is what
 * this module holds. Membership decides what the grid enables, and the order
 * decides the default hardware assignment — both derived, neither typed out.
 */

/** Every channel any supported layout can carry. */
export type SurroundChannel =
    | 'left' | 'lc' | 'center' | 'rc' | 'right'
    | 'lm' | 'lfe' | 'rm'
    | 'ls' | 'surround' | 'rs'
    | 'lt' | 'rt'
    | 'ltm' | 'rtm'
    | 'lts' | 'rts';

export const SURROUND_CHANNEL_LABELS: Record<SurroundChannel, string> = {
    left: 'Left',
    lc: 'L. center',
    center: 'Center',
    rc: 'R. center',
    right: 'Right',
    lm: 'L. mid',
    lfe: 'LFE',
    rm: 'R. mid',
    ls: 'L. surround',
    surround: 'Surround',
    rs: 'R. surround',
    lt: 'L. top',
    rt: 'R. top',
    ltm: 'L. top mid',
    rtm: 'R. top mid',
    lts: 'L. top surround',
    rts: 'R. top surround',
};

/**
 * The file-name suffix each channel gets when bouncing in split format.
 *
 * These are also read back on import to work out which file is which channel,
 * which is why they are one table rather than a default typed into the panel.
 */
export const DEFAULT_BOUNCE_EXTENSIONS: Record<SurroundChannel, string> = {
    left: '.L', lc: '.Lc', center: '.C', rc: '.Rc', right: '.R',
    lm: '.Lm', lfe: '.LFE', rm: '.Rm',
    ls: '.Ls', surround: '.Cs', rs: '.Rs',
    lt: '.Lt', rt: '.Rt',
    ltm: '.Ltm', rtm: '.Rtm',
    lts: '.Lts', rts: '.Rts',
};

/** Which channels each format carries. Anything absent is not addressable. */
export const SURROUND_FORMAT_CHANNELS: Record<string, SurroundChannel[]> = {
    'Quadraphonic': ['left', 'right', 'ls', 'rs'],
    'LCR (Pro Logic)': ['left', 'center', 'right'],
    '5.1 (ITU 775)': ['left', 'center', 'right', 'ls', 'rs', 'lfe'],
    '6.1 (ES/EX)': ['left', 'center', 'right', 'ls', 'surround', 'rs', 'lfe'],
    '7.1': ['left', 'center', 'right', 'lm', 'rm', 'ls', 'rs', 'lfe'],
    '7.1 (SDDS)': ['left', 'lc', 'center', 'rc', 'right', 'ls', 'rs', 'lfe'],
    '5.1.2': ['left', 'center', 'right', 'ls', 'rs', 'lfe', 'lt', 'rt'],
    '5.1.4': ['left', 'center', 'right', 'ls', 'rs', 'lfe', 'lt', 'rt', 'lts', 'rts'],
    '7.1.2': ['left', 'center', 'right', 'lm', 'rm', 'ls', 'rs', 'lfe', 'lt', 'rt'],
    '7.1.4': ['left', 'center', 'right', 'lm', 'rm', 'ls', 'rs', 'lfe', 'lt', 'rt', 'lts', 'rts'],
};

export const SURROUND_FORMATS = Object.keys(SURROUND_FORMAT_CHANNELS);

/** How many discrete channels a format needs. Drives the option lists. */
export function channelCount(format: string): number {
    return (SURROUND_FORMAT_CHANNELS[format] ?? SURROUND_FORMAT_CHANNELS['5.1 (ITU 775)']).length;
}

/** Whether a format addresses a channel at all. */
export function hasChannel(format: string, channel: SurroundChannel): boolean {
    const channels = SURROUND_FORMAT_CHANNELS[format] ?? SURROUND_FORMAT_CHANNELS['5.1 (ITU 775)'];
    return channels.includes(channel);
}

/**
 * The three orders the Initialize buttons offer.
 *
 * Each is a preference order over every channel; a format takes the ones it
 * carries, in that order, and numbers them from 1. That is what makes the
 * buttons differ: the same layout, wired to the hardware in a different order.
 */
export type InitializeOrder = 'Default' | 'ITU' | 'WG-4';

const ORDERS: Record<InitializeOrder, SurroundChannel[]> = {
    // Logic's film order: the stereo pair first, then the surrounds.
    Default: ['left', 'right', 'ls', 'rs', 'center', 'lfe', 'lm', 'rm', 'lc', 'rc', 'surround', 'lt', 'rt', 'lts', 'rts', 'ltm', 'rtm'],
    // ITU-R BS.775: L R C LFE Ls Rs.
    ITU: ['left', 'right', 'center', 'lfe', 'ls', 'rs', 'lm', 'rm', 'lc', 'rc', 'surround', 'lt', 'rt', 'lts', 'rts', 'ltm', 'rtm'],
    // AES/EBU WG-4: the front row left to right, then the surrounds, LFE last.
    'WG-4': ['left', 'center', 'right', 'ls', 'rs', 'lfe', 'lm', 'rm', 'lc', 'rc', 'surround', 'lt', 'rt', 'lts', 'rts', 'ltm', 'rtm'],
};

/**
 * Wire a format's channels to numbered hardware ports.
 *
 * Returns e.g. `{ left: 'Output 1', right: 'Output 2', ... }`. Channels the
 * format does not carry are absent rather than assigned, so a grid cell with no
 * entry is exactly the cell that should be dimmed.
 */
export function defaultAssignments(
    format: string,
    prefix: 'Output' | 'Input',
    order: InitializeOrder = 'Default',
): Partial<Record<SurroundChannel, string>> {
    const carried = new Set(SURROUND_FORMAT_CHANNELS[format] ?? SURROUND_FORMAT_CHANNELS['5.1 (ITU 775)']);
    const assignments: Partial<Record<SurroundChannel, string>> = {};
    let port = 1;
    for (const channel of ORDERS[order] ?? ORDERS.Default) {
        if (carried.has(channel)) assignments[channel] = `${prefix} ${port++}`;
    }
    return assignments;
}

/** The ports a grid dropdown can offer, sized to the format plus headroom. */
export function portOptions(format: string, prefix: 'Output' | 'Input'): string[] {
    // A port list only as long as the layout would make reassignment
    // impossible — every port would already be taken.
    const count = Math.max(channelCount(format) + 4, 8);
    return Array.from({ length: count }, (_, i) => `${prefix} ${i + 1}`);
}

/** The bounce extensions a format uses, absent channels omitted. */
export function defaultExtensions(format: string): Partial<Record<SurroundChannel, string>> {
    const carried = SURROUND_FORMAT_CHANNELS[format] ?? SURROUND_FORMAT_CHANNELS['5.1 (ITU 775)'];
    const extensions: Partial<Record<SurroundChannel, string>> = {};
    for (const channel of carried) extensions[channel] = DEFAULT_BOUNCE_EXTENSIONS[channel];
    return extensions;
}
