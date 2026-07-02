export interface Take {
  id: string;
  name: string;
  channelData: Float32Array;
  sampleRate: number;
  startBeat: number;
  durationBeats: number;
  compSections: CompSection[];
}

export interface CompSection {
  id: string;
  startBeat: number;
  endBeat: number;
  takeId: string;
  crossfadeDuration: number;
}

export interface CompLane {
  id: string;
  trackId: string;
  takes: Take[];
  compSections: CompSection[];
  isRecording: boolean;
}

export class CompManager {
  private lanes: Map<string, CompLane> = new Map();

  createLane(trackId: string): CompLane {
    const lane: CompLane = {
      id: `comp-${trackId}`,
      trackId,
      takes: [],
      compSections: [],
      isRecording: false,
    };
    this.lanes.set(trackId, lane);
    return lane;
  }

  getLane(trackId: string): CompLane | undefined {
    return this.lanes.get(trackId);
  }

  addTake(trackId: string, take: Take): void {
    let lane = this.lanes.get(trackId);
    if (!lane) {
      lane = this.createLane(trackId);
    }
    lane.takes.push(take);
  }

  addCompSection(trackId: string, section: CompSection): void {
    const lane = this.lanes.get(trackId);
    if (!lane) return;

    // Remove overlapping sections from same time range
    lane.compSections = lane.compSections.filter(
      s => s.endBeat <= section.startBeat || s.startBeat >= section.endBeat
    );
    lane.compSections.push(section);
  }

  removeCompSection(trackId: string, sectionId: string): void {
    const lane = this.lanes.get(trackId);
    if (lane) {
      lane.compSections = lane.compSections.filter(s => s.id !== sectionId);
    }
  }

  /**
   * Render the final comped audio from sections.
   */
  renderComp(trackId: string, sampleRate: number): Float32Array | null {
    const lane = this.lanes.get(trackId);
    if (!lane || lane.compSections.length === 0) return null;

    // Find total duration
    const maxEnd = Math.max(...lane.compSections.map(s => s.endBeat));
    const maxDuration = (maxEnd / 120) * 60; // Assume 120 BPM for now
    const totalSamples = Math.ceil(maxDuration * sampleRate);
    const output = new Float32Array(totalSamples);

    // Sort sections by start time
    const sortedSections = [...lane.compSections].sort((a, b) => a.startBeat - b.startBeat);

    for (const section of sortedSections) {
      const take = lane.takes.find(t => t.id === section.takeId);
      if (!take) continue;

      const startSample = Math.round((section.startBeat / 120) * 60 * sampleRate);
      const endSample = Math.round((section.endBeat / 120) * 60 * sampleRate);
      const sectionLength = endSample - startSample;

      if (sectionLength <= 0) continue;

      // Find corresponding region in take
      const takeStartSample = Math.round((section.startBeat - take.startBeat) / 120 * 60 * sampleRate);
      const takeEndSample = Math.min(takeStartSample + sectionLength, take.channelData.length);

      // Crossfade at boundaries
      const crossfadeSamples = Math.round(section.crossfadeDuration * sampleRate);

      for (let i = 0; i < takeEndSample - takeStartSample && startSample + i < output.length; i++) {
        let gain = 1;

        // Apply crossfade at start
        if (i < crossfadeSamples) {
          gain *= i / crossfadeSamples;
        }

        // Apply crossfade at end
        if (i > (takeEndSample - takeStartSample) - crossfadeSamples) {
          const fadePos = (takeEndSample - takeStartSample) - i;
          gain *= fadePos / crossfadeSamples;
        }

        output[startSample + i] = take.channelData[takeStartSample + i] * gain;
      }
    }

    return output;
  }

  /**
   * Start recording a new take.
   */
  startTakeRecording(trackId: string, startBeat: number, sampleRate: number): Take | null {
    const lane = this.lanes.get(trackId);
    if (!lane) return null;

    lane.isRecording = true;
    const take: Take = {
      id: `take-${Date.now()}`,
      name: `Take ${lane.takes.length + 1}`,
      channelData: new Float32Array(0),
      sampleRate,
      startBeat,
      durationBeats: 0,
      compSections: [],
    };

    lane.takes.push(take);
    return take;
  }

  stopTakeRecording(trackId: string, channelData: Float32Array): void {
    const lane = this.lanes.get(trackId);
    if (!lane || !lane.isRecording) return;

    const currentTake = lane.takes[lane.takes.length - 1];
    if (currentTake) {
      currentTake.channelData = channelData;
      currentTake.durationBeats = (channelData.length / currentTake.sampleRate / 60) * 120;
    }

    lane.isRecording = false;
  }

  removeTake(trackId: string, takeId: string): void {
    const lane = this.lanes.get(trackId);
    if (!lane) return;

    lane.takes = lane.takes.filter(t => t.id !== takeId);
    lane.compSections = lane.compSections.filter(s => s.takeId !== takeId);
  }

  clearLane(trackId: string): void {
    this.lanes.delete(trackId);
  }
}

export const compManager = new CompManager();
