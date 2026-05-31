/**
 * nodePool.ts
 * Manages reuse of Web Audio nodes to minimize garbage collection spikes.
 */

export class AudioNodePool {
    private gainPool: GainNode[] = [];
    private pannerPool: StereoPannerNode[] = [];
    private ctx: AudioContext | null = null;

    constructor(ctx: AudioContext | null) {
        this.ctx = ctx;
    }

    setContext(ctx: AudioContext) {
        this.ctx = ctx;
    }

    getGain(): GainNode {
        if (!this.ctx) throw new Error("AudioContext not available for pooling");
        const node = this.gainPool.pop() || this.ctx.createGain();
        node.gain.value = 1.0; // Reset to default
        return node;
    }

    releaseGain(node: GainNode) {
        node.disconnect();
        this.gainPool.push(node);
    }

    getPanner(): StereoPannerNode {
        if (!this.ctx) throw new Error("AudioContext not available for pooling");
        const node = this.pannerPool.pop() || this.ctx.createStereoPanner();
        node.pan.value = 0; // Reset to default
        return node;
    }

    releasePanner(node: StereoPannerNode) {
        node.disconnect();
        this.pannerPool.push(node);
    }

    clear() {
        this.gainPool = [];
        this.pannerPool = [];
    }
}
