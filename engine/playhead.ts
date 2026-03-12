/**
 * Playhead Engine
 * Drives the timing and playback synchronization.
 */

export class Playhead {
    private currentTime: number = 0; // beats
    private isPlaying: boolean = false;
    private startTime: number = 0;
    private lastPosition: number = 0;
    private tempo: number = 120;

    constructor(tempo: number) {
        this.tempo = tempo;
    }

    start(fromPosition: number) {
        this.isPlaying = true;
        this.startTime = performance.now();
        this.lastPosition = fromPosition;
    }

    stop() {
        this.isPlaying = false;
    }

    update(): number {
        if (!this.isPlaying) return this.lastPosition;

        const now = performance.now();
        const elapsedMs = now - this.startTime;
        const beatsPerSecond = this.tempo / 60;
        const beatsElapsed = (elapsedMs / 1000) * beatsPerSecond;

        this.currentTime = this.lastPosition + beatsElapsed;
        return this.currentTime;
    }

    setTempo(tempo: number) {
        // Correct the start time so the playhead doesn't jump when tempo changes
        if (this.isPlaying) {
            this.lastPosition = this.update();
            this.startTime = performance.now();
        }
        this.tempo = tempo;
    }

    getPosition() {
        return this.isPlaying ? this.update() : this.lastPosition;
    }
}
