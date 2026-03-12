export type ClipType = 'audio' | 'midi';

export interface Note {
    id: string;
    pitch: number; // MIDI note number
    velocity: number;
    start: number; // in beats (relative to clip start)
    duration: number; // in beats
    articulationId?: number;
}

export interface Clip {
    id: string;
    trackId: string;
    type: ClipType;
    name: string;
    color: string;
    alternativeId: string;

    // --- Timeline Placement ---
    start: number; // total beats from start of timeline
    duration: number; // total beats
    offset: number; // in beats (for audio starting late)

    // --- Take Folders ---
    isTakeFolder?: boolean;
    isTakeFolderOpen?: boolean;
    takes?: Clip[]; // Embedded inner clips for takes
    activeTakeIndex?: number;
    quickSwipeComping?: boolean;
    comps?: { id: string; name: string; takeIndex: number }[];
    activeCompId?: string;

    // --- Region Inspector Parameters (Logic Pro) ---
    muted: boolean;
    loop: boolean;
    quantize?: '1/16' | '1/8' | '1/4' | '1/2' | 'None';
    marker?: 'good' | 'ok' | 'poor';
    qSwing: number; // 0 to 1
    transpose: number; // semitones (-24 to 24)
    velocityOffset: number; // -127 to 127
    pitchSource?: 'Off' | 'On';

    flexEnabled?: boolean;
    flexMode?: 'off' | 'time' | 'pitch' | 'time+pitch';
    flexTimeFactor?: number; // 1.0 = original speed, >1 for stretch (slower), <1 for compress (faster)
    flexPitchOffset?: number; // semitones for flex pitch adjustment

    // --- Alias Support (Logic Pro) ---
    aliasOf?: string; // parent clip id
    aliasName?: string; // display name for alias differs from original

    // --- Media / Data ---
    fileUrl?: string; // For Audio
    notes?: Note[]; // For MIDI
}
