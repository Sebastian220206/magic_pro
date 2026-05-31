export interface TempoEvent {
  beat: number;
  bpm: number;
}

export class TransportTimeline {
  constructor(private tempoMap: TempoEvent[]) {}

  /**
   * Converts a Transport Beat to absolute Seconds, traversing the tempo map.
   */
  public beatToSeconds(targetBeat: number): number {
    let accumulatedSeconds = 0;
    let currentBeat = 0;

    for (let i = 0; i < this.tempoMap.length; i++) {
      const currentTempo = this.tempoMap[i];
      const nextTempo = this.tempoMap[i + 1];
      const endBeat = nextTempo ? Math.min(targetBeat, nextTempo.beat) : targetBeat;

      const beatsInSegment = endBeat - Math.max(currentBeat, currentTempo.beat);
      if (beatsInSegment > 0) {
        accumulatedSeconds += beatsInSegment * (60 / currentTempo.bpm);
      }

      currentBeat = endBeat;
      if (currentBeat >= targetBeat) break;
    }
    return accumulatedSeconds;
  }
}
