/**
 * Event List Editor - Professional MIDI Event List Editing
 *
 * Features:
 * - Display all MIDI events in a sortable table
 * - Inline editing of event properties
 * - Multi-select with keyboard navigation
 * - Event insertion and deletion
 * - Copy/paste events
 * - Undo/redo support
 * - Column-based sorting
 * - Event grouping (note on/off pairs)
 * - Auto-scroll to current playback position
 */

import {
  MidiEvent,
  EventType,
  NoteEvent,
  ControlChangeEvent,
  ProgramChangeEvent,
  PitchBendEvent,
  ChannelAftertouchEvent,
  PolyAftertouchEvent,
  MetaTempoEvent,
  MetaTimeSignatureEvent,
  MetaKeySignatureEvent,
  MetaTextEvent,
  SystemExclusiveEvent,
  EventSortField,
  SortDirection,
  EventSortOptions,
  EventEditDelta,
  EVENT_TYPE_COLORS,
  getControllerName,
  midiNoteToEvent,
  eventToMidiNote,
} from './eventTypes';

import {
  EventFilter,
  applyEventFilter,
  matchesFilter,
  EVENT_FILTER_PRESETS,
} from './eventFilter';

import { MidiNote, MidiClip } from './types';

// =============================================================================
// Editor State
// =============================================================================

export interface EventListEditorState {
  events: MidiEvent[];
  filteredEvents: MidiEvent[];
  selectedIds: Set<string>;
  focusedId: string | null;
  sortOptions: EventSortOptions;
  filter: EventFilter;
  viewStartTick: number;
  viewEndTick: number;
  cursorTick: number;
  editMode: EventEditMode;
  clipboard: MidiEvent[];
  undoStack: EventEditAction[];
  redoStack: EventEditAction[];
  columnWidths: Record<string, number>;
  visibleColumns: EventColumn[];
}

export type EventEditMode = 'select' | 'insert' | 'edit';

export interface EventColumn {
  id: string;
  field: string;
  label: string;
  width: number;
  minWidth: number;
  editable: boolean;
  sortable: boolean;
  format?: (event: MidiEvent) => string;
}

export interface EventEditAction {
  type: 'insert' | 'delete' | 'modify' | 'move';
  events: MidiEvent[];
  oldEvents?: MidiEvent[];
  timestamp: number;
}

// =============================================================================
// Default Columns
// =============================================================================

export const DEFAULT_COLUMNS: EventColumn[] = [
  {
    id: 'tick',
    field: 'tick',
    label: 'Tick',
    width: 80,
    minWidth: 60,
    editable: false,
    sortable: true,
    format: (e) => String(e.tick),
  },
  {
    id: 'beat',
    field: 'beat',
    label: 'Beat',
    width: 80,
    minWidth: 60,
    editable: false,
    sortable: true,
    format: (e) => formatBeat(e.beat),
  },
  {
    id: 'type',
    field: 'type',
    label: 'Type',
    width: 120,
    minWidth: 80,
    editable: false,
    sortable: true,
    format: (e) => formatEventType(e.type),
  },
  {
    id: 'channel',
    field: 'channel',
    label: 'Ch',
    width: 40,
    minWidth: 30,
    editable: true,
    sortable: true,
    format: (e) => String(e.channel + 1),
  },
  {
    id: 'trackIndex',
    field: 'trackIndex',
    label: 'Track',
    width: 50,
    minWidth: 40,
    editable: false,
    sortable: true,
    format: (e) => String(e.trackIndex + 1),
  },
  {
    id: 'pitch',
    field: 'pitch',
    label: 'Note',
    width: 80,
    minWidth: 60,
    editable: true,
    sortable: true,
    format: (e) => {
      if ('pitch' in e) {
        return midiPitchToName((e as NoteEvent).pitch);
      }
      return '';
    },
  },
  {
    id: 'velocity',
    field: 'velocity',
    label: 'Vel',
    width: 50,
    minWidth: 40,
    editable: true,
    sortable: true,
    format: (e) => {
      if ('velocity' in e) {
        return String((e as NoteEvent).velocity);
      }
      return '';
    },
  },
  {
    id: 'duration',
    field: 'duration',
    label: 'Dur',
    width: 70,
    minWidth: 50,
    editable: true,
    sortable: false,
    format: (e) => {
      if ('durationBeats' in e) {
        return formatDuration((e as NoteEvent).durationBeats);
      }
      return '';
    },
  },
  {
    id: 'controller',
    field: 'controller',
    label: 'CC',
    width: 150,
    minWidth: 100,
    editable: true,
    sortable: true,
    format: (e) => {
      if (e.type === 'control-change') {
        const cc = e as ControlChangeEvent;
        return `${cc.controller}: ${getControllerName(cc.controller)}`;
      }
      return '';
    },
  },
  {
    id: 'value',
    field: 'value',
    label: 'Value',
    width: 60,
    minWidth: 40,
    editable: true,
    sortable: true,
    format: (e) => {
      if (e.type === 'control-change') {
        return String((e as ControlChangeEvent).value);
      }
      if (e.type === 'program-change') {
        return String((e as ProgramChangeEvent).program);
      }
      if (e.type === 'pitch-bend') {
        return String((e as PitchBendEvent).value);
      }
      if (e.type === 'channel-aftertouch') {
        return String((e as ChannelAftertouchEvent).pressure);
      }
      if (e.type === 'poly-aftertouch') {
        return String((e as PolyAftertouchEvent).pressure);
      }
      return '';
    },
  },
  {
    id: 'text',
    field: 'text',
    label: 'Text',
    width: 200,
    minWidth: 100,
    editable: true,
    sortable: false,
    format: (e) => {
      if ('text' in e) {
        return (e as MetaTextEvent).text;
      }
      return '';
    },
  },
  {
    id: 'bpm',
    field: 'bpm',
    label: 'BPM',
    width: 70,
    minWidth: 50,
    editable: true,
    sortable: true,
    format: (e) => {
      if (e.type === 'meta-tempo') {
        return (e as MetaTempoEvent).bpm.toFixed(1);
      }
      return '';
    },
  },
  {
    id: 'timeSig',
    field: 'timeSig',
    label: 'Time',
    width: 60,
    minWidth: 40,
    editable: true,
    sortable: false,
    format: (e) => {
      if (e.type === 'meta-time-signature') {
        const ts = e as MetaTimeSignatureEvent;
        return `${ts.numerator}/${ts.denominator}`;
      }
      return '';
    },
  },
  {
    id: 'keySig',
    field: 'keySig',
    label: 'Key',
    width: 60,
    minWidth: 40,
    editable: true,
    sortable: false,
    format: (e) => {
      if (e.type === 'meta-key-signature') {
        return (e as MetaKeySignatureEvent).key;
      }
      return '';
    },
  },
];

// =============================================================================
// Formatting Helpers
// =============================================================================

function formatBeat(beat: number): string {
  const bar = Math.floor(beat / 4) + 1;
  const beatInBar = (beat % 4) + 1;
  const sub = Math.round((beat % 1) * 100) / 100;
  if (sub === 0) {
    return `${bar}.${beatInBar}`;
  }
  return `${bar}.${beatInBar}${sub.toFixed(2).slice(1)}`;
}

function formatDuration(beats: number): string {
  if (beats < 1) {
    const sixteenths = Math.round(beats * 4);
    if (sixteenths === 1) return '1/16';
    if (sixteenths === 2) return '1/8';
    if (sixteenths === 3) return '3/16';
    if (sixteenths === 4) return '1/4';
    if (sixteenths === 6) return '3/8';
    if (sixteenths === 8) return '1/2';
    if (sixteenths === 12) return '3/4';
    return `${sixteenths}/16`;
  }
  const bars = Math.floor(beats / 4);
  const remaining = beats % 4;
  if (bars === 0) {
    return `${remaining.toFixed(2)} beats`;
  }
  return `${bars}+${remaining.toFixed(1)}`;
}

function formatEventType(type: EventType): string {
  const names: Record<EventType, string> = {
    'note-on': 'Note On',
    'note-off': 'Note Off',
    'poly-aftertouch': 'Poly AT',
    'control-change': 'CC',
    'program-change': 'PC',
    'channel-aftertouch': 'Chan AT',
    'pitch-bend': 'Pitch Bend',
    'system-exclusive': 'SysEx',
    'meta-text': 'Text',
    'meta-tempo': 'Tempo',
    'meta-time-signature': 'Time Sig',
    'meta-key-signature': 'Key Sig',
    'meta-marker': 'Marker',
    'meta-cue-point': 'Cue',
    'meta-program-name': 'Program Name',
    'meta-track-name': 'Track Name',
  };
  return names[type] ?? type;
}

function midiPitchToName(pitch: number): string {
  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const octave = Math.floor(pitch / 12) - 1;
  const noteIndex = pitch % 12;
  return `${noteNames[noteIndex]}${octave}`;
}

// =============================================================================
// Event List Editor
// =============================================================================

export class EventListEditor {
  private state: EventListEditorState;
  private listeners: Array<(state: EventListEditorState) => void> = [];
  private maxUndoSize: number;

  constructor(options: {
    events?: MidiEvent[];
    filter?: EventFilter;
    sortOptions?: EventSortOptions;
    visibleColumns?: EventColumn[];
    maxUndoSize?: number;
  } = {}) {
    this.maxUndoSize = options.maxUndoSize ?? 100;

    const sortOptions = options.sortOptions ?? { field: 'tick' as EventSortField, direction: 'asc' as SortDirection };
    const filter = options.filter ?? {};
    const events = options.events ?? [];
    const filteredEvents = applyEventFilter(events, filter);

    this.state = {
      events,
      filteredEvents: this.sortEvents(filteredEvents, sortOptions),
      selectedIds: new Set(),
      focusedId: null,
      sortOptions,
      filter,
      viewStartTick: 0,
      viewEndTick: 480 * 16, // 16 bars at 480 ticks/bar
      cursorTick: 0,
      editMode: 'select',
      clipboard: [],
      undoStack: [],
      redoStack: [],
      columnWidths: {},
      visibleColumns: options.visibleColumns ?? DEFAULT_COLUMNS,
    };
  }

  // ===========================================================================
  // State Access
  // ===========================================================================

  public getState(): Readonly<EventListEditorState> {
    return this.state;
  }

  public getEvents(): ReadonlyArray<MidiEvent> {
    return this.state.filteredEvents;
  }

  public getSelectedEvents(): MidiEvent[] {
    return this.state.filteredEvents.filter(e => this.state.selectedIds.has(e.id));
  }

  public getFocusedEvent(): MidiEvent | null {
    return this.state.filteredEvents.find(e => e.id === this.state.focusedId) ?? null;
  }

  public getEventById(id: string): MidiEvent | null {
    return this.state.events.find(e => e.id === id) ?? null;
  }

  public getEventCount(): number {
    return this.state.events.length;
  }

  public getFilteredCount(): number {
    return this.state.filteredEvents.length;
  }

  // ===========================================================================
  // Event Management
  // ===========================================================================

  public setEvents(events: MidiEvent[]): void {
    this.pushUndo({ type: 'insert', events: [...this.state.events], timestamp: Date.now() });
    this.state.events = [...events];
    this.applyFilter();
    this.notifyListeners();
  }

  public addEvent(event: MidiEvent): void {
    this.pushUndo({ type: 'insert', events: [event], timestamp: Date.now() });
    this.state.events.push(event);
    this.applyFilter();
    this.notifyListeners();
  }

  public addEvents(events: MidiEvent[]): void {
    this.pushUndo({ type: 'insert', events: [...events], timestamp: Date.now() });
    this.state.events.push(...events);
    this.applyFilter();
    this.notifyListeners();
  }

  public deleteEvent(id: string): boolean {
    const index = this.state.events.findIndex(e => e.id === id);
    if (index >= 0) {
      const removed = this.state.events.splice(index, 1)[0];
      this.pushUndo({ type: 'delete', events: [removed], timestamp: Date.now() });
      this.state.selectedIds.delete(id);
      this.applyFilter();
      this.notifyListeners();
      return true;
    }
    return false;
  }

  public deleteSelectedEvents(): number {
    const selectedIds = new Set(this.state.selectedIds);
    if (selectedIds.size === 0) return 0;

    const removedEvents: MidiEvent[] = [];
    this.state.events = this.state.events.filter(e => {
      if (selectedIds.has(e.id)) {
        removedEvents.push(e);
        return false;
      }
      return true;
    });

    this.pushUndo({ type: 'delete', events: removedEvents, timestamp: Date.now() });
    this.state.selectedIds.clear();
    this.applyFilter();
    this.notifyListeners();
    return removedEvents.length;
  }

  public modifyEvent(id: string, delta: EventEditDelta): boolean {
    const event = this.state.events.find(e => e.id === id);
    if (!event) return false;

    const oldEvent = { ...event };
    this.applyEditDelta(event, delta);
    this.pushUndo({ type: 'modify', events: [event], oldEvents: [oldEvent], timestamp: Date.now() });
    this.applyFilter();
    this.notifyListeners();
    return true;
  }

  public modifySelectedEvents(delta: EventEditDelta): number {
    const selectedIds = new Set(this.state.selectedIds);
    if (selectedIds.size === 0) return 0;

    const modifiedEvents: MidiEvent[] = [];
    const oldEvents: MidiEvent[] = [];

    for (const event of this.state.events) {
      if (selectedIds.has(event.id)) {
        const oldEvent = { ...event };
        this.applyEditDelta(event, delta);
        modifiedEvents.push(event);
        oldEvents.push(oldEvent);
      }
    }

    this.pushUndo({ type: 'modify', events: modifiedEvents, oldEvents, timestamp: Date.now() });
    this.applyFilter();
    this.notifyListeners();
    return modifiedEvents.length;
  }

  private applyEditDelta(event: MidiEvent, delta: EventEditDelta): void {
    if (delta.tick !== undefined) {
      event.tick = delta.tick;
      event.beat = delta.tick / 480; // Assuming 480 ticks per beat
    }
    if (delta.channel !== undefined) {
      event.channel = Math.max(0, Math.min(15, delta.channel));
    }

    if (event.type === 'note-on' || event.type === 'note-off') {
      const noteEvent = event as NoteEvent;
      if (delta.pitch !== undefined) {
        noteEvent.pitch = Math.max(0, Math.min(127, delta.pitch));
      }
      if (delta.velocity !== undefined) {
        noteEvent.velocity = Math.max(0, Math.min(127, delta.velocity));
      }
    }

    if (event.type === 'control-change') {
      const ccEvent = event as ControlChangeEvent;
      if (delta.controller !== undefined) {
        ccEvent.controller = Math.max(0, Math.min(127, delta.controller));
        ccEvent.controllerName = getControllerName(ccEvent.controller);
      }
      if (delta.value !== undefined) {
        ccEvent.value = Math.max(0, Math.min(127, delta.value));
      }
    }

    if (event.type === 'program-change') {
      const pcEvent = event as ProgramChangeEvent;
      if (delta.program !== undefined) {
        pcEvent.program = Math.max(0, Math.min(127, delta.program));
      }
    }

    if (event.type === 'pitch-bend') {
      const pbEvent = event as PitchBendEvent;
      if (delta.value !== undefined) {
        pbEvent.value = Math.max(0, Math.min(16383, delta.value));
        pbEvent.valueCentered = (pbEvent.value - 8192) / 8192;
      }
    }

    if (event.type === 'meta-tempo') {
      const tempoEvent = event as MetaTempoEvent;
      if (delta.bpm !== undefined) {
        tempoEvent.bpm = Math.max(1, Math.min(999, delta.bpm));
        tempoEvent.microsecondsPerBeat = Math.round(60000000 / tempoEvent.bpm);
      }
    }

    if (event.type === 'meta-time-signature') {
      const tsEvent = event as MetaTimeSignatureEvent;
      if (delta.numerator !== undefined) {
        tsEvent.numerator = Math.max(1, Math.min(64, delta.numerator));
      }
      if (delta.denominator !== undefined) {
        tsEvent.denominator = Math.max(1, Math.min(64, delta.denominator));
      }
    }

    if ('text' in event && delta.text !== undefined) {
      (event as MetaTextEvent).text = delta.text;
    }
  }

  // ===========================================================================
  // Selection
  // ===========================================================================

  public selectEvent(id: string, addToSelection: boolean = false): void {
    if (!addToSelection) {
      this.state.selectedIds.clear();
    }
    this.state.selectedIds.add(id);
    this.state.focusedId = id;
    this.notifyListeners();
  }

  public deselectEvent(id: string): void {
    this.state.selectedIds.delete(id);
    if (this.state.focusedId === id) {
      this.state.focusedId = null;
    }
    this.notifyListeners();
  }

  public selectAll(): void {
    for (const event of this.state.filteredEvents) {
      this.state.selectedIds.add(event.id);
    }
    this.notifyListeners();
  }

  public deselectAll(): void {
    this.state.selectedIds.clear();
    this.state.focusedId = null;
    this.notifyListeners();
  }

  public invertSelection(): void {
    const newSelection = new Set<string>();
    for (const event of this.state.filteredEvents) {
      if (!this.state.selectedIds.has(event.id)) {
        newSelection.add(event.id);
      }
    }
    this.state.selectedIds = newSelection;
    this.notifyListeners();
  }

  public selectRange(startId: string, endId: string): void {
    const startIndex = this.state.filteredEvents.findIndex(e => e.id === startId);
    const endIndex = this.state.filteredEvents.findIndex(e => e.id === endId);
    if (startIndex < 0 || endIndex < 0) return;

    const [from, to] = startIndex <= endIndex ? [startIndex, endIndex] : [endIndex, startIndex];
    for (let i = from; i <= to; i++) {
      this.state.selectedIds.add(this.state.filteredEvents[i].id);
    }
    this.notifyListeners();
  }

  public selectByType(type: EventType): void {
    for (const event of this.state.filteredEvents) {
      if (event.type === type) {
        this.state.selectedIds.add(event.id);
      }
    }
    this.notifyListeners();
  }

  public selectByChannel(channel: number): void {
    for (const event of this.state.filteredEvents) {
      if (event.channel === channel) {
        this.state.selectedIds.add(event.id);
      }
    }
    this.notifyListeners();
  }

  public isSelected(id: string): boolean {
    return this.state.selectedIds.has(id);
  }

  // ===========================================================================
  // Navigation
  // ===========================================================================

  public setFocusedEvent(id: string | null): void {
    this.state.focusedId = id;
    this.notifyListeners();
  }

  public focusNext(): void {
    const currentIndex = this.state.filteredEvents.findIndex(e => e.id === this.state.focusedId);
    const nextIndex = Math.min(currentIndex + 1, this.state.filteredEvents.length - 1);
    if (nextIndex >= 0) {
      this.state.focusedId = this.state.filteredEvents[nextIndex].id;
      this.notifyListeners();
    }
  }

  public focusPrevious(): void {
    const currentIndex = this.state.filteredEvents.findIndex(e => e.id === this.state.focusedId);
    const prevIndex = Math.max(currentIndex - 1, 0);
    if (prevIndex >= 0) {
      this.state.focusedId = this.state.filteredEvents[prevIndex].id;
      this.notifyListeners();
    }
  }

  public focusFirst(): void {
    if (this.state.filteredEvents.length > 0) {
      this.state.focusedId = this.state.filteredEvents[0].id;
      this.notifyListeners();
    }
  }

  public focusLast(): void {
    if (this.state.filteredEvents.length > 0) {
      this.state.focusedId = this.state.filteredEvents[this.state.filteredEvents.length - 1].id;
      this.notifyListeners();
    }
  }

  // ===========================================================================
  // Sorting
  // ===========================================================================

  public setSortOptions(options: EventSortOptions): void {
    this.state.sortOptions = options;
    this.applyFilter();
    this.notifyListeners();
  }

  public toggleSort(field: EventSortField): void {
    if (this.state.sortOptions.field === field) {
      this.state.sortOptions.direction = this.state.sortOptions.direction === 'asc' ? 'desc' : 'asc';
    } else {
      this.state.sortOptions = { field, direction: 'asc' };
    }
    this.applyFilter();
    this.notifyListeners();
  }

  private sortEvents(events: MidiEvent[], options: EventSortOptions): MidiEvent[] {
    return [...events].sort((a, b) => {
      let comparison = 0;

      switch (options.field) {
        case 'tick':
          comparison = a.tick - b.tick;
          break;
        case 'type':
          comparison = a.type.localeCompare(b.type);
          break;
        case 'channel':
          comparison = a.channel - b.channel;
          break;
        case 'pitch':
          comparison = ('pitch' in a ? (a as NoteEvent).pitch : 0) - ('pitch' in b ? (b as NoteEvent).pitch : 0);
          break;
        case 'velocity':
          comparison = ('velocity' in a ? (a as NoteEvent).velocity : 0) - ('velocity' in b ? (b as NoteEvent).velocity : 0);
          break;
        case 'controller':
          comparison = ('controller' in a ? (a as ControlChangeEvent).controller : 0) - ('controller' in b ? (b as ControlChangeEvent).controller : 0);
          break;
        case 'trackIndex':
          comparison = a.trackIndex - b.trackIndex;
          break;
        default:
          comparison = 0;
      }

      return options.direction === 'asc' ? comparison : -comparison;
    });
  }

  // ===========================================================================
  // Filtering
  // ===========================================================================

  public setFilter(filter: EventFilter): void {
    this.state.filter = filter;
    this.applyFilter();
    this.notifyListeners();
  }

  public clearFilter(): void {
    this.state.filter = {};
    this.applyFilter();
    this.notifyListeners();
  }

  public getFilterPresets() {
    return EVENT_FILTER_PRESETS;
  }

  private applyFilter(): void {
    let filtered = applyEventFilter(this.state.events, this.state.filter);
    this.state.filteredEvents = this.sortEvents(filtered, this.state.sortOptions);

    // Remove selected IDs that are no longer visible
    const visibleIds = new Set(this.state.filteredEvents.map(e => e.id));
    for (const id of this.state.selectedIds) {
      if (!visibleIds.has(id)) {
        this.state.selectedIds.delete(id);
      }
    }
  }

  // ===========================================================================
  // Viewport
  // ===========================================================================

  public setViewport(startTick: number, endTick: number): void {
    this.state.viewStartTick = Math.max(0, startTick);
    this.state.viewEndTick = endTick;
    this.notifyListeners();
  }

  public setCursorTick(tick: number): void {
    this.state.cursorTick = Math.max(0, tick);
    this.notifyListeners();
  }

  public scrollToEvent(id: string): void {
    const event = this.state.filteredEvents.find(e => e.id === id);
    if (event) {
      const tickRange = this.state.viewEndTick - this.state.viewStartTick;
      this.state.viewStartTick = Math.max(0, event.tick - tickRange / 4);
      this.state.viewEndTick = this.state.viewStartTick + tickRange;
      this.notifyListeners();
    }
  }

  // ===========================================================================
  // Edit Mode
  // ===========================================================================

  public setEditMode(mode: EventEditMode): void {
    this.state.editMode = mode;
    this.notifyListeners();
  }

  public getEditMode(): EventEditMode {
    return this.state.editMode;
  }

  // ===========================================================================
  // Clipboard
  // ===========================================================================

  public copy(): MidiEvent[] {
    this.state.clipboard = this.getSelectedEvents().map(e => ({ ...e }));
    return this.state.clipboard;
  }

  public cut(): MidiEvent[] {
    const copied = this.copy();
    this.deleteSelectedEvents();
    return copied;
  }

  public paste(): MidiEvent[] {
    if (this.state.clipboard.length === 0) return [];

    const newEvents = this.state.clipboard.map(event => ({
      ...event,
      id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      tick: event.tick + this.state.cursorTick,
      beat: event.beat + this.state.cursorTick / 480,
    }));

    this.addEvents(newEvents);

    // Select pasted events
    this.state.selectedIds.clear();
    for (const event of newEvents) {
      this.state.selectedIds.add(event.id);
    }
    this.notifyListeners();

    return newEvents;
  }

  public duplicateSelected(): MidiEvent[] {
    const selected = this.getSelectedEvents();
    if (selected.length === 0) return [];

    const newEvents = selected.map(event => ({
      ...event,
      id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      tick: event.tick + 480, // Offset by 1 beat
      beat: event.beat + 1,
    }));

    this.addEvents(newEvents);
    return newEvents;
  }

  // ===========================================================================
  // Undo/Redo
  // ===========================================================================

  public undo(): boolean {
    const action = this.state.undoStack.pop();
    if (!action) return false;

    // Save current state for redo
    this.state.redoStack.push({
      ...action,
      events: [...this.state.events],
      oldEvents: action.events,
    });

    // Restore previous state
    if (action.oldEvents) {
      this.state.events = [...action.oldEvents];
    } else {
      // For inserts, remove the inserted events
      const insertedIds = new Set(action.events.map(e => e.id));
      this.state.events = this.state.events.filter(e => !insertedIds.has(e.id));
    }

    this.applyFilter();
    this.notifyListeners();
    return true;
  }

  public redo(): boolean {
    const action = this.state.redoStack.pop();
    if (!action) return false;

    // Save current state for undo
    this.state.undoStack.push({
      ...action,
      events: [...this.state.events],
      oldEvents: action.events,
    });

    // Apply the action
    if (action.type === 'insert') {
      this.state.events.push(...action.events);
    } else if (action.type === 'delete') {
      const deletedIds = new Set(action.events.map(e => e.id));
      this.state.events = this.state.events.filter(e => !deletedIds.has(e.id));
    } else if (action.type === 'modify' && action.oldEvents) {
      // Restore the modified events
      for (const oldEvent of action.oldEvents) {
        const index = this.state.events.findIndex(e => e.id === oldEvent.id);
        if (index >= 0) {
          this.state.events[index] = { ...oldEvent };
        }
      }
    }

    this.applyFilter();
    this.notifyListeners();
    return true;
  }

  public canUndo(): boolean {
    return this.state.undoStack.length > 0;
  }

  public canRedo(): boolean {
    return this.state.redoStack.length > 0;
  }

  private pushUndo(action: EventEditAction): void {
    this.state.undoStack.push(action);
    if (this.state.undoStack.length > this.maxUndoSize) {
      this.state.undoStack.shift();
    }
    this.state.redoStack = [];
  }

  // ===========================================================================
  // Clip Integration
  // ===========================================================================

  public loadFromClip(clip: MidiClip): void {
    const events = clip.notes.map(note => midiNoteToEvent(note, 0));
    this.setEvents(events);
  }

  public saveToClip(clip: MidiClip): MidiClip {
    const noteEvents = this.state.events.filter(
      (e): e is NoteEvent => e.type === 'note-on'
    );
    const notes = noteEvents.map(eventToMidiNote);
    return { ...clip, notes };
  }

  // ===========================================================================
  // Import/Export
  // ===========================================================================

  public exportEvents(format: 'csv' | 'json' = 'csv'): string {
    if (format === 'json') {
      return JSON.stringify(this.state.filteredEvents, null, 2);
    }

    // CSV export
    const headers = ['Tick', 'Beat', 'Type', 'Channel', 'Track', 'Pitch', 'Velocity', 'Duration', 'Controller', 'Value', 'Text'];
    const rows = this.state.filteredEvents.map(event => {
      const row = [
        String(event.tick),
        formatBeat(event.beat),
        event.type,
        String(event.channel + 1),
        String(event.trackIndex + 1),
      ];

      if ('pitch' in event) {
        row.push(midiPitchToName((event as NoteEvent).pitch));
        row.push(String((event as NoteEvent).velocity));
        row.push('durationBeats' in event ? formatDuration((event as NoteEvent).durationBeats) : '');
      } else {
        row.push('', '', '');
      }

      if (event.type === 'control-change') {
        row.push(String((event as ControlChangeEvent).controller));
        row.push(String((event as ControlChangeEvent).value));
      } else if (event.type === 'program-change') {
        row.push('', String((event as ProgramChangeEvent).program));
      } else if (event.type === 'pitch-bend') {
        row.push('', String((event as PitchBendEvent).value));
      } else {
        row.push('', '');
      }

      if ('text' in event) {
        row.push((event as MetaTextEvent).text);
      } else {
        row.push('');
      }

      return row.join(',');
    });

    return [headers.join(','), ...rows].join('\n');
  }

  public importEvents(data: string, format: 'csv' | 'json' = 'csv'): number {
    let events: MidiEvent[];

    if (format === 'json') {
      events = JSON.parse(data);
    } else {
      // Simple CSV parsing
      const lines = data.split('\n');
      events = [];
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const parts = line.split(',');
        if (parts.length >= 5) {
          const tick = parseInt(parts[0]) || 0;
          const type = parts[2] as EventType;
          const channel = (parseInt(parts[3]) || 1) - 1;
          const trackIndex = (parseInt(parts[4]) || 1) - 1;

          events.push({
            id: `imported-${Date.now()}-${i}`,
            type,
            tick,
            beat: tick / 480,
            channel,
            trackIndex,
            selected: false,
            muted: false,
          } as MidiEvent);
        }
      }
    }

    this.addEvents(events);
    return events.length;
  }

  // ===========================================================================
  // Events
  // ===========================================================================

  public subscribe(listener: (state: EventListEditorState) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index >= 0) {
        this.listeners.splice(index, 1);
      }
    };
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }

  // ===========================================================================
  // Column Management
  // ===========================================================================

  public setVisibleColumns(columns: EventColumn[]): void {
    this.state.visibleColumns = columns;
    this.notifyListeners();
  }

  public getVisibleColumns(): ReadonlyArray<EventColumn> {
    return this.state.visibleColumns;
  }

  public setColumnWidth(columnId: string, width: number): void {
    const column = this.state.visibleColumns.find(c => c.id === columnId);
    if (column) {
      column.width = Math.max(column.minWidth, width);
      this.notifyListeners();
    }
  }

  // ===========================================================================
  // Cleanup
  // ===========================================================================

  public dispose(): void {
    this.state.events = [];
    this.state.filteredEvents = [];
    this.state.selectedIds.clear();
    this.state.clipboard = [];
    this.state.undoStack = [];
    this.state.redoStack = [];
  }

  // ===========================================================================
  // Serialization
  // ===========================================================================

  public serialize(): {
    events: MidiEvent[];
    filter: EventFilter;
    sortOptions: EventSortOptions;
  } {
    return {
      events: this.state.events,
      filter: this.state.filter,
      sortOptions: this.state.sortOptions,
    };
  }

  public deserialize(data: {
    events: MidiEvent[];
    filter?: EventFilter;
    sortOptions?: EventSortOptions;
  }): void {
    this.state.events = data.events;
    if (data.filter) {
      this.state.filter = data.filter;
    }
    if (data.sortOptions) {
      this.state.sortOptions = data.sortOptions;
    }
    this.applyFilter();
    this.notifyListeners();
  }
}

// =============================================================================
// Factory
// =============================================================================

export function createEventListEditor(options?: {
  events?: MidiEvent[];
  filter?: EventFilter;
  sortOptions?: EventSortOptions;
}): EventListEditor {
  return new EventListEditor(options);
}

export default EventListEditor;
