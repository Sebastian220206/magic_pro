import type { Clip } from './Clip';

export type TrackType = 'audio' | 'midi' | 'software-instrument' | 'drummer' | 'external-midi' | 'folder' | 'bus' | 'output';

export interface AutomationPoint {
    time: number;
    value: number; // 0 to 100
}

export interface AutomationLane {
    parameter: 'volume' | 'pan' | string;
    points: AutomationPoint[];
}

export interface PluginSetting {
    id: string;
    pluginId: string;
    name: string;
    enabled: boolean;
    params: Record<string, number>;
}

export interface TrackAlternative {
    id: string;
    name: string;
}

export interface Track {
    id: string;
    name: string;
    type: TrackType;
    muted: boolean;
    soloed: boolean;
    volume: number; // 0 to 1
    pan: number; // -1 to 1
    color: string;
    orderIndex: number;
    recordEnabled: boolean;
    inputMonitoring: boolean;
    protected: boolean;
    frozen: boolean;
    enabled: boolean; // On/Off
    freezeMode: 'Source Only' | 'Pre Fader';

    // --- Track Alternatives ---
    alternatives: TrackAlternative[];
    activeAlternativeId: string;
    showInactiveAlternatives: boolean;

    // --- Track Instrument (for MIDI/software-instrument tracks) ---
    instrument?: string; // e.g., "Grand Piano", "Deep Bass", "Trap Drum Kit"
    instrumentLoaded?: boolean;

    // --- Track Inspector Parameters (Logic Pro) ---
    icon?: string;
    channel?: string; // e.g. "Inst 1"
    midiInput?: 'All' | string;
    midiInChannel?: 'All' | number;
    midiOutChannel?: 'All' | number;
    keyLimit?: [number, number]; // [min, max] MIDI note
    velocityLimit?: [number, number];
    transpose: number; // in semitones
    velocityOffset: number; // -127 to 127
    delay: number; // in ms
    midiChannel?: number; // 1 to 16 for multi-timbral instruments
    noTranspose?: boolean;
    noReset?: boolean;

    // --- Internal MIDI Routing (Logic Pro Internal MIDI In) ---
    internalMidiInSourceId?: string;
    internalMidiInType?: 'Off' | 'MIDI to Track' | 'Instrument Input' | 'Instrument Output';
    internalMidiInRecordMode?: 'Internal Only' | 'Internal + External';
    midiOutToTrackSlot?: number; // For "MIDI to Track" tap point

    // --- Advanced Signal Chain ---
    plugins: PluginSetting[];
    sends: { busId: string; level: number }[];
    outputBusId: string; // "stereo-out" by default
    channelStripId?: string; // used for multiple tracks sharing the same mixer channel
    defaultRegionType?: 'midi' | 'pattern' | 'session-player';
    zoom: number; // individual vertical zoom factor

    // --- Clips ---
    clips?: Clip[];

    // --- Track Stacks & Automation (Professional Features) ---
    parentId?: string;
    isStack?: boolean;
    isCollapsed?: boolean;
    stackType?: 'Folder' | 'Summing';
    isGrooveTrack?: boolean;
    matchGrooveTrack?: boolean;
    automation?: AutomationLane[];
    hidden: boolean;
    articulationSetId?: string;
    currentArticulationId?: number;
}
