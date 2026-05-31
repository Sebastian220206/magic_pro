/**
 * Mixer Store - Zustand store for professional mixer state management
 * 
 * Features:
 * - Channel strip state management
 * - Master bus control
 * - Plugin management
 * - Send routing
 * - Meter data
 * - Undo/Redo support
 */

import { create } from 'zustand';
import { devtools, subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { 
  ChannelStrip, 
  ChannelStripState, 
  MasterBus,
  MasterBusState,
  MeterData 
} from '../engine/audioEngine/index';

// =============================================================================
// Types
// =============================================================================

interface MixerTrack {
  id: string;
  name: string;
  channelStrip: ChannelStrip | null;
  meterData: MeterData;
  color: string;
}

interface SendBus {
  id: string;
  name: string;
  channelStrip: ChannelStrip | null;
  meterData: MeterData;
}

interface PluginInstance {
  id: string;
  pluginId: string;
  name: string;
  params: Record<string, number>;
  bypass: boolean;
}

interface MixerState {
  // Audio Context
  audioContext: AudioContext | null;
  
  // Tracks
  tracks: MixerTrack[];
  
  // Send Buses (A-D)
  sendBuses: SendBus[];
  
  // Master Bus
  masterBus: MasterBus | null;
  masterMeterData: MeterData;
  
  // Selection
  selectedTrackId: string | null;
  
  // Solo/Mute Groups
  soloedTracks: Set<string>;
  mutedTracks: Set<string>;
  
  // Plugin Registry
  plugins: Map<string, PluginInstance>;
  
  // UI State
  isMixerVisible: boolean;
  meterRefreshRate: number;
  
  // Initialization
  isInitialized: boolean;
}

interface MixerActions {
  // Initialization
  initialize: (audioContext: AudioContext) => void;
  dispose: () => void;
  
  // Track Management
  addTrack: (name: string) => string;
  removeTrack: (trackId: string) => void;
  renameTrack: (trackId: string, name: string) => void;
  setTrackColor: (trackId: string, color: string) => void;
  
  // Volume & Pan
  setTrackVolume: (trackId: string, db: number) => void;
  setTrackPan: (trackId: string, pan: number) => void;
  
  // Mute & Solo
  toggleTrackMute: (trackId: string) => void;
  toggleTrackSolo: (trackId: string) => void;
  clearAllSolos: () => void;
  clearAllMutes: () => void;
  
  // Sends
  setSendLevel: (trackId: string, sendId: string, db: number) => void;
  setSendPreFader: (trackId: string, sendId: string, preFader: boolean) => void;
  toggleSend: (trackId: string, sendId: string) => void;
  
  // Inserts
  addPlugin: (trackId: string, slotIndex: number, pluginId: string) => void;
  removePlugin: (trackId: string, slotIndex: number) => void;
  reorderPlugins: (trackId: string, fromSlot: number, toSlot: number) => void;
  togglePluginBypass: (trackId: string, slotIndex: number) => void;
  setPluginParam: (pluginId: string, paramId: string, value: number) => void;
  
  // Master
  setMasterVolume: (db: number) => void;
  toggleMasterLimiter: () => void;
  setMasterLimiterThreshold: (db: number) => void;
  resetMasterPeakHold: () => void;
  
  // Meter Updates
  updateMeterData: (trackId: string, data: MeterData) => void;
  updateMasterMeterData: (data: MeterData) => void;
  
  // Selection
  selectTrack: (trackId: string | null) => void;
  
  // UI
  toggleMixerVisibility: () => void;
  setMeterRefreshRate: (rate: number) => void;
}

// =============================================================================
// Default Meter Data
// =============================================================================

const defaultMeterData: MeterData = {
  peakLeft: -Infinity,
  peakRight: -Infinity,
  rmsLeft: -Infinity,
  rmsRight: -Infinity,
  peakHoldLeft: -Infinity,
  peakHoldRight: -Infinity,
  clipLeft: false,
  clipRight: false,
};

// =============================================================================
// Initial State
// =============================================================================

const initialState: MixerState = {
  audioContext: null,
  tracks: [],
  sendBuses: [
    { id: 'send-a', name: 'Send A', channelStrip: null, meterData: defaultMeterData },
    { id: 'send-b', name: 'Send B', channelStrip: null, meterData: defaultMeterData },
    { id: 'send-c', name: 'Send C', channelStrip: null, meterData: defaultMeterData },
    { id: 'send-d', name: 'Send D', channelStrip: null, meterData: defaultMeterData },
  ],
  masterBus: null,
  masterMeterData: defaultMeterData,
  selectedTrackId: null,
  soloedTracks: new Set(),
  mutedTracks: new Set(),
  plugins: new Map(),
  isMixerVisible: true,
  meterRefreshRate: 30,
  isInitialized: false,
};

// =============================================================================
// Store Creation
// =============================================================================

export const useMixerStore = create<MixerState & MixerActions>()(
  devtools(
    subscribeWithSelector(
      immer((set, get) => ({
        ...initialState,

        // =============================================================================
        // Initialization
        // =============================================================================

        initialize: (audioContext: AudioContext) => {
          set((state) => {
            state.audioContext = audioContext;
            
            // Create master bus
            state.masterBus = new MasterBus(audioContext);
            state.masterBus.connectToDestination(audioContext.destination);
            
            // Setup master meter callback
            state.masterBus.setMeterUpdateCallback((data) => {
              get().updateMasterMeterData(data);
            });
            
            // Initialize send buses
            for (const bus of state.sendBuses) {
              bus.channelStrip = new ChannelStrip(audioContext, {
                id: bus.id,
                name: bus.name,
                color: '#888',
                insertSlots: 8,
              });
            }
            
            state.isInitialized = true;
          });
        },

        dispose: () => {
          set((state) => {
            // Dispose all tracks
            for (const track of state.tracks) {
              track.channelStrip?.dispose();
            }
            
            // Dispose send buses
            for (const bus of state.sendBuses) {
              bus.channelStrip?.dispose();
            }
            
            // Dispose master bus
            state.masterBus?.dispose();
            
            state.audioContext = null;
            state.isInitialized = false;
          });
        },

        // =============================================================================
        // Track Management
        // =============================================================================

        addTrack: (name: string) => {
          const id = `track-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          const audioContext = get().audioContext;
          
          set((state) => {
            const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];
            const color = colors[state.tracks.length % colors.length];
            
            const track: MixerTrack = {
              id,
              name,
              channelStrip: null,
              meterData: defaultMeterData,
              color,
            };
            
            if (audioContext) {
              track.channelStrip = new ChannelStrip(audioContext, {
                id,
                name,
                color,
                insertSlots: 8,
                sendBuses: state.sendBuses.map(b => b.id),
              });
              
              // Connect to master
              track.channelStrip.connect(state.masterBus!.getInputNode());
              
              // Setup meter callback
              track.channelStrip.setMeterUpdateCallback((data) => {
                get().updateMeterData(id, data);
              });
            }
            
            state.tracks.push(track);
          });
          
          return id;
        },

        removeTrack: (trackId: string) => {
          set((state) => {
            const index = state.tracks.findIndex(t => t.id === trackId);
            if (index >= 0) {
              const track = state.tracks[index];
              track.channelStrip?.dispose();
              state.tracks.splice(index, 1);
              
              // Remove from solo/mute sets
              state.soloedTracks.delete(trackId);
              state.mutedTracks.delete(trackId);
            }
          });
        },

        renameTrack: (trackId: string, name: string) => {
          set((state) => {
            const track = state.tracks.find(t => t.id === trackId);
            if (track) {
              track.name = name;
              track.channelStrip?.setName(name);
            }
          });
        },

        setTrackColor: (trackId: string, color: string) => {
          set((state) => {
            const track = state.tracks.find(t => t.id === trackId);
            if (track) {
              track.color = color;
            }
          });
        },

        // =============================================================================
        // Volume & Pan
        // =============================================================================

        setTrackVolume: (trackId: string, db: number) => {
          set((state) => {
            const track = state.tracks.find(t => t.id === trackId);
            track?.channelStrip?.setVolume(db);
          });
        },

        setTrackPan: (trackId: string, pan: number) => {
          set((state) => {
            const track = state.tracks.find(t => t.id === trackId);
            track?.channelStrip?.setPan(pan);
          });
        },

        // =============================================================================
        // Mute & Solo
        // =============================================================================

        toggleTrackMute: (trackId: string) => {
          set((state) => {
            const track = state.tracks.find(t => t.id === trackId);
            if (track) {
              track.channelStrip?.toggleMute();
              
              if (track.channelStrip?.getMute()) {
                state.mutedTracks.add(trackId);
              } else {
                state.mutedTracks.delete(trackId);
              }
            }
          });
        },

        toggleTrackSolo: (trackId: string) => {
          set((state) => {
            const track = state.tracks.find(t => t.id === trackId);
            if (track) {
              track.channelStrip?.toggleSolo();
              
              if (track.channelStrip?.getSolo()) {
                state.soloedTracks.add(trackId);
              } else {
                state.soloedTracks.delete(trackId);
              }
              
              // Apply solo logic to all tracks
              const hasSolos = state.soloedTracks.size > 0;
              for (const t of state.tracks) {
                if (hasSolos) {
                  const shouldMute = !state.soloedTracks.has(t.id);
                  t.channelStrip?.setMute(shouldMute);
                } else {
                  // Restore mute state
                  const isMuted = state.mutedTracks.has(t.id);
                  t.channelStrip?.setMute(isMuted);
                }
              }
            }
          });
        },

        clearAllSolos: () => {
          set((state) => {
            state.soloedTracks.clear();
            for (const track of state.tracks) {
              track.channelStrip?.setSolo(false);
              // Restore mute state
              const isMuted = state.mutedTracks.has(track.id);
              track.channelStrip?.setMute(isMuted);
            }
          });
        },

        clearAllMutes: () => {
          set((state) => {
            state.mutedTracks.clear();
            for (const track of state.tracks) {
              track.channelStrip?.setMute(false);
            }
          });
        },

        // =============================================================================
        // Sends
        // =============================================================================

        setSendLevel: (trackId: string, sendId: string, db: number) => {
          set((state) => {
            const track = state.tracks.find(t => t.id === trackId);
            track?.channelStrip?.setSendLevel(sendId, db);
          });
        },

        setSendPreFader: (trackId: string, sendId: string, preFader: boolean) => {
          set((state) => {
            const track = state.tracks.find(t => t.id === trackId);
            track?.channelStrip?.setSendPreFader(sendId, preFader);
          });
        },

        toggleSend: (trackId: string, sendId: string) => {
          set((state) => {
            const track = state.tracks.find(t => t.id === trackId);
            if (!track) return;
            const sendState = track.channelStrip?.getSendState(sendId);
            if (sendState) {
              track.channelStrip?.enableSend(sendId, !sendState.enabled);
            }
          });
        },

        // =============================================================================
        // Inserts
        // =============================================================================

        addPlugin: (trackId: string, slotIndex: number, pluginId: string) => {
          // Placeholder - would need plugin registry
          console.log(`Add plugin ${pluginId} to track ${trackId} slot ${slotIndex}`);
        },

        removePlugin: (trackId: string, slotIndex: number) => {
          set((state) => {
            const track = state.tracks.find(t => t.id === trackId);
            track?.channelStrip?.removePlugin(slotIndex);
          });
        },

        reorderPlugins: (trackId: string, fromSlot: number, toSlot: number) => {
          set((state) => {
            const track = state.tracks.find(t => t.id === trackId);
            track?.channelStrip?.reorderPlugins(fromSlot, toSlot);
          });
        },

        togglePluginBypass: (trackId: string, slotIndex: number) => {
          set((state) => {
            const track = state.tracks.find(t => t.id === trackId);
            const slot = track?.channelStrip?.getInsertSlotState(slotIndex);
            if (slot) {
              track?.channelStrip?.setInsertBypass(slotIndex, !slot.bypass);
            }
          });
        },

        setPluginParam: (pluginId: string, paramId: string, value: number) => {
          set((state) => {
            const plugin = state.plugins.get(pluginId);
            if (plugin) {
              plugin.params[paramId] = value;
            }
          });
        },

        // =============================================================================
        // Master
        // =============================================================================

        setMasterVolume: (db: number) => {
          set((state) => {
            state.masterBus?.setVolume(db);
          });
        },

        toggleMasterLimiter: () => {
          set((state) => {
            const isEnabled = state.masterBus?.isLimiterEnabled();
            state.masterBus?.enableLimiter(!isEnabled);
          });
        },

        setMasterLimiterThreshold: (db: number) => {
          set((state) => {
            state.masterBus?.setLimiterThreshold(db);
          });
        },

        resetMasterPeakHold: () => {
          set((state) => {
            state.masterBus?.resetPeakHold();
          });
        },

        // =============================================================================
        // Meter Updates
        // =============================================================================

        updateMeterData: (trackId: string, data: MeterData) => {
          set((state) => {
            const track = state.tracks.find(t => t.id === trackId);
            if (track) {
              track.meterData = data;
            }
          });
        },

        updateMasterMeterData: (data: MeterData) => {
          set((state) => {
            state.masterMeterData = data;
          });
        },

        // =============================================================================
        // Selection
        // =============================================================================

        selectTrack: (trackId: string | null) => {
          set((state) => {
            state.selectedTrackId = trackId;
          });
        },

        // =============================================================================
        // UI
        // =============================================================================

        toggleMixerVisibility: () => {
          set((state) => {
            state.isMixerVisible = !state.isMixerVisible;
          });
        },

        setMeterRefreshRate: (rate: number) => {
          set((state) => {
            state.meterRefreshRate = rate;
          });
        },
      }))
    ),
    { name: 'mixer-store' }
  )
);

// =============================================================================
// Selectors
// =============================================================================

export const selectTrackById = (trackId: string) => (state: MixerState) => 
  state.tracks.find(t => t.id === trackId);

export const selectTrackMeterData = (trackId: string) => (state: MixerState) =>
  state.tracks.find(t => t.id === trackId)?.meterData || defaultMeterData;

export const selectMasterMeterData = (state: MixerState) => state.masterMeterData;

export const selectSelectedTrack = (state: MixerState) =>
  state.tracks.find(t => t.id === state.selectedTrackId);

export default useMixerStore;
