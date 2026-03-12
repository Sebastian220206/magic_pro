export interface Articulation {
    id: number;
    name: string;
    channel: number | '-';
    symbol: string | '-';
}

export type SwitchType = 'Note On' | 'Note Off' | 'Poly Aftertouch' | 'Controller' | 'Program' | 'Aftertouch' | 'Pitch Bend' | 'Velocity';
export type SwitchMode = 'Permanent' | 'Permanent (Retrigger)' | 'Permanent (Trigger)' | 'Momentary' | 'Momentary (Retrigger)' | 'Momentary (Trigger)' | 'Toggle' | 'Toggle (Retrigger)' | 'Toggle (Trigger)';

export interface ArticulationSwitch {
    type: SwitchType;
    selector: string | '-';
    valueStart: number | '-';
    valueEnd: number | '-';
    mode: SwitchMode;
    articulationId: number;
}

export interface ArticulationOutput {
    articulationId: number;
    type: SwitchType | '-';
    channel: number | '-';
    selector: string | '-';
    valueStart: number | '-';
    valueEnd: number | '-';
}

export interface ArticulationSet {
    id: string;
    name: string;
    articulations: Articulation[];
    switches: ArticulationSwitch[];
    outputs: ArticulationOutput[];
    midiRemote: boolean;
    midiChannel: number | 'All';
    octaveOffset: number;
}
