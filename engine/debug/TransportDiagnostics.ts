import { audioContextManager } from '../audioEngine/audioContext';
import { advancedScheduler } from '../audioEngine/scheduler';
import { ENABLE_PHASE3_TRANSPORT } from '../config/runtimeFlags';

class TransportDiagnostics {
    private duplicateTicksCount = 0;
    private lastTickBeat = -1;

    public init() {
        if (typeof window !== 'undefined') {
            (window as any).__TransportDiagnostics = this;
        }
        
        // Listen to legacy scheduler ticks
        advancedScheduler.addEventListener((event: any) => {
            if (event.type === 'transportTick') {
                if (event.beat === this.lastTickBeat) {
                    this.duplicateTicksCount++;
                    console.warn(`[TransportDiagnostics] Duplicate tick detected for beat ${event.beat}`);
                }
                this.lastTickBeat = event.beat;
            }
        });

        console.log('[TransportDiagnostics] Initialized.');
    }

    public report() {
        const ctx = audioContextManager.getContext();
        
        console.group('[TransportDiagnostics] Report');
        console.log(`Playback Authority: Legacy Scheduler`);
        console.log(`Phase 3 Enabled: ${ENABLE_PHASE3_TRANSPORT}`);
        console.log(`Scheduler Playing: ${advancedScheduler.isCurrentlyPlaying()}`);
        console.log(`Current Beat: ${advancedScheduler.getCurrentBeat()}`);
        console.log(`Audio Context State: ${ctx ? ctx.state : 'Uninitialized'}`);
        console.log(`Audio Context Current Time: ${ctx ? ctx.currentTime : 0}`);
        console.log(`Duplicate Transport Ticks detected: ${this.duplicateTicksCount}`);
        
        if (ENABLE_PHASE3_TRANSPORT && advancedScheduler.isCurrentlyPlaying()) {
            console.error('[TransportDiagnostics] WARNING: Worklet and Legacy Scheduler both active!');
        }

        console.groupEnd();
    }
}

export const transportDiagnostics = new TransportDiagnostics();
