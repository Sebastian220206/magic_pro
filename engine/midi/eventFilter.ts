/**
 * Event Filter - Filtering and Querying MIDI Events
 *
 * Supports:
 * - Filter by event type
 * - Filter by channel
 * - Filter by track
 * - Filter by pitch range
 * - Filter by velocity range
 * - Filter by time range
 * - Text search
 * - Combined filters
 */

import {
  MidiEvent,
  EventType,
  NoteEvent,
  ControlChangeEvent,
  ProgramChangeEvent,
  PitchBendEvent,
} from './eventTypes';

// =============================================================================
// Filter Types
// =============================================================================

export interface EventFilter {
  types?: EventType[];
  channels?: number[];
  trackIndices?: number[];
  pitchRange?: { min: number; max: number };
  velocityRange?: { min: number; max: number };
  timeRange?: { startTick: number; endTick: number };
  startBeat?: number;
  endBeat?: number;
  textSearch?: string;
  selectedOnly?: boolean;
  mutedOnly?: boolean;
  unmutedOnly?: boolean;
  controllers?: number[];
  programs?: number[];
}

export interface EventFilterPreset {
  name: string;
  filter: EventFilter;
  description: string;
}

// =============================================================================
// Filter Presets
// =============================================================================

export const EVENT_FILTER_PRESETS: EventFilterPreset[] = [
  {
    name: 'All Events',
    filter: {},
    description: 'Show all MIDI events',
  },
  {
    name: 'Notes Only',
    filter: { types: ['note-on'] },
    description: 'Show only note events',
  },
  {
    name: 'Control Changes',
    filter: { types: ['control-change'] },
    description: 'Show only CC events',
  },
  {
    name: 'Pitch Bend',
    filter: { types: ['pitch-bend'] },
    description: 'Show only pitch bend events',
  },
  {
    name: 'Program Changes',
    filter: { types: ['program-change'] },
    description: 'Show only program change events',
  },
  {
    name: 'Tempo Changes',
    filter: { types: ['meta-tempo'] },
    description: 'Show only tempo change events',
  },
  {
    name: 'Time Signature',
    filter: { types: ['meta-time-signature'] },
    description: 'Show only time signature events',
  },
  {
    name: 'Key Signature',
    filter: { types: ['meta-key-signature'] },
    description: 'Show only key signature events',
  },
  {
    name: 'Text Events',
    filter: { types: ['meta-text', 'meta-marker', 'meta-cue-point'] },
    description: 'Show all text and marker events',
  },
  {
    name: 'System Exclusive',
    filter: { types: ['system-exclusive'] },
    description: 'Show only SysEx events',
  },
  {
    name: 'Channel 1',
    filter: { channels: [0] },
    description: 'Show only channel 1 events',
  },
  {
    name: 'High Velocity',
    filter: { types: ['note-on'], velocityRange: { min: 100, max: 127 } },
    description: 'Show only notes with velocity 100-127',
  },
  {
    name: 'Low Velocity',
    filter: { types: ['note-on'], velocityRange: { min: 1, max: 32 } },
    description: 'Show only notes with velocity 1-32',
  },
  {
    name: 'Selected Notes',
    filter: { types: ['note-on'], selectedOnly: true },
    description: 'Show only selected notes',
  },
  {
    name: 'Sustain Pedal',
    filter: { types: ['control-change'], controllers: [64] },
    description: 'Show only sustain pedal (CC64) events',
  },
  {
    name: 'Modulation Wheel',
    filter: { types: ['control-change'], controllers: [1] },
    description: 'Show only modulation wheel (CC1) events',
  },
  {
    name: 'Volume',
    filter: { types: ['control-change'], controllers: [7] },
    description: 'Show only channel volume (CC7) events',
  },
  {
    name: 'Pan',
    filter: { types: ['control-change'], controllers: [10] },
    description: 'Show only pan (CC10) events',
  },
  {
    name: 'Expression',
    filter: { types: ['control-change'], controllers: [11] },
    description: 'Show only expression (CC11) events',
  },
];

// =============================================================================
// Filter Application
// =============================================================================

export function applyEventFilter(events: MidiEvent[], filter: EventFilter): MidiEvent[] {
  if (!filter || Object.keys(filter).length === 0) {
    return events;
  }

  return events.filter(event => matchesFilter(event, filter));
}

export function matchesFilter(event: MidiEvent, filter: EventFilter): boolean {
  // Type filter
  if (filter.types && filter.types.length > 0) {
    if (!filter.types.includes(event.type)) return false;
  }

  // Channel filter
  if (filter.channels && filter.channels.length > 0) {
    if (!filter.channels.includes(event.channel)) return false;
  }

  // Track filter
  if (filter.trackIndices && filter.trackIndices.length > 0) {
    if (!filter.trackIndices.includes(event.trackIndex)) return false;
  }

  // Pitch range filter (for note events)
  if (filter.pitchRange) {
    if ('pitch' in event) {
      const noteEvent = event as NoteEvent;
      if (noteEvent.pitch < filter.pitchRange.min || noteEvent.pitch > filter.pitchRange.max) {
        return false;
      }
    }
  }

  // Velocity range filter (for note events)
  if (filter.velocityRange) {
    if ('velocity' in event) {
      const noteEvent = event as NoteEvent;
      if (noteEvent.velocity < filter.velocityRange.min || noteEvent.velocity > filter.velocityRange.max) {
        return false;
      }
    }
  }

  // Time range filter (ticks)
  if (filter.timeRange) {
    if (event.tick < filter.timeRange.startTick || event.tick > filter.timeRange.endTick) {
      return false;
    }
  }

  // Time range filter (beats)
  if (filter.startBeat !== undefined) {
    if (event.beat < filter.startBeat) return false;
  }
  if (filter.endBeat !== undefined) {
    if (event.beat > filter.endBeat) return false;
  }

  // Text search
  if (filter.textSearch) {
    const searchLower = filter.textSearch.toLowerCase();
    const eventText = getEventSearchText(event);
    if (!eventText.toLowerCase().includes(searchLower)) {
      return false;
    }
  }

  // Selection filter
  if (filter.selectedOnly) {
    if (!event.selected) return false;
  }

  // Muted filter
  if (filter.mutedOnly) {
    if (!event.muted) return false;
  }

  // Unmuted filter
  if (filter.unmutedOnly) {
    if (event.muted) return false;
  }

  // Controller filter (for CC events)
  if (filter.controllers && filter.controllers.length > 0) {
    if (event.type === 'control-change') {
      const ccEvent = event as ControlChangeEvent;
      if (!filter.controllers.includes(ccEvent.controller)) {
        return false;
      }
    }
  }

  // Program filter (for PC events)
  if (filter.programs && filter.programs.length > 0) {
    if (event.type === 'program-change') {
      const pcEvent = event as ProgramChangeEvent;
      if (!filter.programs.includes(pcEvent.program)) {
        return false;
      }
    }
  }

  return true;
}

// =============================================================================
// Event Search Text
// =============================================================================

function getEventSearchText(event: MidiEvent): string {
  switch (event.type) {
    case 'note-on':
    case 'note-off': {
      const noteEvent = event as NoteEvent;
      return `Note ${noteEvent.pitch} Vel ${noteEvent.velocity}`;
    }
    case 'control-change': {
      const ccEvent = event as ControlChangeEvent;
      return `CC${ccEvent.controller} Value ${ccEvent.value} ${ccEvent.controllerName ?? ''}`;
    }
    case 'program-change': {
      const pcEvent = event as ProgramChangeEvent;
      return `Program ${pcEvent.program} ${pcEvent.programName ?? ''}`;
    }
    case 'pitch-bend': {
      const pbEvent = event as PitchBendEvent;
      return `Pitch Bend ${pbEvent.valueCentered.toFixed(2)}`;
    }
    case 'meta-tempo': {
      const tempoEvent = event as { bpm: number };
      return `Tempo ${tempoEvent.bpm.toFixed(1)} BPM`;
    }
    case 'meta-time-signature': {
      const tsEvent = event as { numerator: number; denominator: number };
      return `Time Sig ${tsEvent.numerator}/${tsEvent.denominator}`;
    }
    case 'meta-key-signature': {
      const ksEvent = event as { key: string };
      return `Key ${ksEvent.key}`;
    }
    case 'meta-text':
    case 'meta-marker':
    case 'meta-cue-point': {
      const textEvent = event as { text: string };
      return textEvent.text;
    }
    default:
      return event.type;
  }
}

// =============================================================================
// Filter Combining
// =============================================================================

export function combineFilters(...filters: EventFilter[]): EventFilter {
  const combined: EventFilter = {};

  for (const filter of filters) {
    if (filter.types) {
      combined.types = [...(combined.types ?? []), ...filter.types];
    }
    if (filter.channels) {
      combined.channels = [...(combined.channels ?? []), ...filter.channels];
    }
    if (filter.trackIndices) {
      combined.trackIndices = [...(combined.trackIndices ?? []), ...filter.trackIndices];
    }
    if (filter.textSearch) {
      combined.textSearch = filter.textSearch;
    }
    if (filter.selectedOnly) {
      combined.selectedOnly = true;
    }
    if (filter.mutedOnly) {
      combined.mutedOnly = true;
    }
    if (filter.unmutedOnly) {
      combined.unmutedOnly = true;
    }
  }

  return combined;
}

// =============================================================================
// Filter Statistics
// =============================================================================

export interface FilterStats {
  totalEvents: number;
  filteredEvents: number;
  typeCounts: Record<EventType, number>;
  channelCounts: Record<number, number>;
}

export function getFilterStats(events: MidiEvent[], filter: EventFilter): FilterStats {
  const filtered = applyEventFilter(events, filter);

  const typeCounts = {} as Record<EventType, number>;
  const channelCounts: Record<number, number> = {};

  for (const event of filtered) {
    typeCounts[event.type] = (typeCounts[event.type] ?? 0) + 1;
    channelCounts[event.channel] = (channelCounts[event.channel] ?? 0) + 1;
  }

  return {
    totalEvents: events.length,
    filteredEvents: filtered.length,
    typeCounts,
    channelCounts,
  };
}

export default applyEventFilter;
