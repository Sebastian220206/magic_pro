import { audioEngine } from './AudioEngineAdapter';
type TrackNodes = any;

/**
 * AudioDiagnostics - Advanced diagnostic utility for the DAW audio graph.
 * Implements the audit and debug workflow for Web Audio API signal chains.
 */
export class AudioDiagnostics {
    private ctx: AudioContext | null = null;

    constructor() {
        // Access context via singleton if established
        this.ctx = audioEngine.getContext();
    }

    /**
     * Performs a full audit of a specific track's audio chain.
     */
    public async auditTrack(trackId: string) {
        if (!this.ctx) {
            return {
                isConnected: false,
                isAudible: false,
                brokenStage: "context",
                issues: ["AudioContext not initialized"],
                fixSuggestions: ["Initialize audioEngine by interacting with the page first."]
            };
        }

        const nodes = (audioEngine as any).trackNodes.get(trackId) as TrackNodes;
        if (!nodes) {
            return {
                isConnected: false,
                isAudible: false,
                brokenStage: "input",
                issues: [`No nodes found for track ${trackId}`],
                fixSuggestions: ["Ensure track is active and getTrackNodes has been called."]
            };
        }

        const report: any = {
            isConnected: true,
            isAudible: false,
            brokenStage: null,
            issues: [],
            fixSuggestions: []
        };

        // --- STEP 1 & 2: Verify Graph Connections ---
        console.log(`[Audit] Verifying Signal Path for Track: ${trackId}`);
        
        const masterGain = (audioEngine as any).masterGain;
        const masterAnalyzer = (audioEngine as any).masterAnalyzer;

        console.log("Track Chain:", {
            sourceGain: nodes.sourceGain,
            fxChainInput: nodes.fxChain,
            plugins: nodes?.nodes.map((n: any) => ({ type: n.type, node: n.node })),
            fxChainEnd: nodes.fxEnd,
            panner: nodes.panner,
            output: nodes.output,
            analyzer: nodes.analyzer,
            master: masterGain
        });

        // Basic connectivity check (Web Audio API doesn't expose list of connections, but we can verify node state)
        if (nodes.sourceGain.numberOfOutputs === 0) report.issues.push("sourceGain not connected to anything");
        if (nodes.output.numberOfOutputs === 0) report.issues.push("Track output not connected to anything");
        if (masterGain && masterGain.numberOfOutputs === 0) report.issues.push("Master gain not connected to destination");
        
        if (this.ctx.state === 'suspended') {
            report.issues.push("AudioContext is suspended");
            report.fixSuggestions.push("Call audioContext.resume() on a user gesture");
        }

        // --- STEP 5: Node State Check ---
        console.log("Output Gain:", nodes.output.gain.value);
        if (nodes.output.gain.value === 0) {
            report.issues.push("Track volume is at 0 (silent)");
        }

        // --- STEP 6: Audio Flow Test ---
        const isCurrentlyAudible = await this.testSignal(nodes.analyzer);
        report.isAudible = isCurrentlyAudible;

        if (!isCurrentlyAudible) {
            report.issues.push("No signal detected at track analyst node");
            report.brokenStage = "effect"; // Typical failure point
        }

        // --- STEP 3: Hard Effect Test (Forced Audible Change) ---
        console.log("[Audit] Running Hard Effect Test...");
        const testGain = this.ctx.createGain();
        testGain.gain.value = 0.0001; // Drastic drop
        
        const originalEndConnection = nodes.fxEnd;
        // Temporarily intercept the chain
        try {
            nodes.fxEnd.disconnect();
            nodes.fxEnd.connect(testGain);
            testGain.connect(nodes.panner);
            
            const signalWithHardEffect = await this.testSignal(nodes.analyzer);
            if (signalWithHardEffect && report.isAudible) {
                // If it was audible before and STILL audible with 0.0001 gain, the chain is bypassed or broken
                report.issues.push("Hard effect test failed: Volume did not drop. Signal may be bypassing the FX chain.");
                report.brokenStage = "fxEnd";
            }
        } finally {
            // Restore
            testGain.disconnect();
            nodes.fxEnd.disconnect();
            nodes.fxEnd.connect(nodes.panner);
        }

        // Final Report Synthesis
        if (report.issues.length === 0) {
            report.isConnected = true;
            report.isAudible = true;
        } else {
            report.isConnected = report.issues.every((i: string) => !i.includes("connection"));
        }

        return report;
    }

    /**
     * Helper to test if audio signal is passing through a node.
     */
    private async testSignal(analyzer: AnalyserNode): Promise<boolean> {
        const data = new Uint8Array(analyzer.frequencyBinCount);
        analyzer.getByteFrequencyData(data);
        const hasSignal = data.some(v => v > 0);
        return hasSignal;
    }

    /**
     * Check for common failures automatically.
     */
    public checkCommonFailures() {
        const failures = [];
        const ctx = (audioEngine as any).audioContext;
        
        if (!ctx) return ["AudioContext missing"];
        if (ctx.state === 'suspended') failures.push("AudioContext suspended");
        
        const masterGain = (audioEngine as any).masterGain;
        if (masterGain && masterGain.gain.value === 0) failures.push("Master volume is 0");
        
        return failures;
    }
}

export const audioDiagnostics = new AudioDiagnostics();
