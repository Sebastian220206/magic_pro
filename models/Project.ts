import { Track } from './Track';
import { Clip } from './Clip';

export interface Project {
    id: string;
    name: string;
    tempo: number;
    timeSignature: string; // e.g., "4/4"
    tracks: Track[];
    clips: Clip[];
    // Future: buses, masterChannel, etc.
}
