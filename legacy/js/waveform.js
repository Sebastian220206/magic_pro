/* ═══════════════════════════════════════════════════════════
   Waveform Utility — Generates fake peak data for demo clips
   ═══════════════════════════════════════════════════════════ */

const WaveformUtil = (() => {
    /**
     * Generate an array of peak values (0–1) simulating an audio waveform.
     * Uses layered sine waves for a realistic look.
     */
    function generatePeaks(length = 200) {
        const peaks = [];
        const seed = Math.random() * 1000;

        for (let i = 0; i < length; i++) {
            const t = i / length;
            // Layered oscillations
            let value = 0;
            value += Math.sin(t * 12 + seed) * 0.3;
            value += Math.sin(t * 28 + seed * 1.3) * 0.2;
            value += Math.sin(t * 55 + seed * 0.7) * 0.15;
            value += Math.sin(t * 90 + seed * 2.1) * 0.1;
            value += (Math.random() - 0.5) * 0.25;

            // Envelope shape (fade in/out)
            const envelope = Math.min(t * 8, 1) * Math.min((1 - t) * 6, 1);
            value = Math.abs(value) * envelope;

            peaks.push(Math.max(0.05, Math.min(1, value)));
        }
        return peaks;
    }

    /**
     * Draw a waveform on a canvas context.
     */
    function drawWaveform(ctx, peaks, x, y, width, height, color, alpha = 0.8) {
        if (!peaks || peaks.length === 0) return;

        const barWidth = width / peaks.length;
        ctx.fillStyle = color;
        ctx.globalAlpha = alpha;

        for (let i = 0; i < peaks.length; i++) {
            const barHeight = peaks[i] * height * 0.9;
            const bx = x + i * barWidth;
            const by = y + (height - barHeight) / 2;
            ctx.fillRect(bx, by, Math.max(1, barWidth - 0.5), barHeight);
        }

        ctx.globalAlpha = 1;
    }

    /**
     * Draw mini MIDI note bars for a clip preview.
     */
    function drawMidiPreview(ctx, notes, clipStartBeat, clipDuration, x, y, width, height, color) {
        if (!notes || notes.length === 0) return;

        // Find pitch range
        let minPitch = 127, maxPitch = 0;
        notes.forEach(n => {
            if (n.pitch < minPitch) minPitch = n.pitch;
            if (n.pitch > maxPitch) maxPitch = n.pitch;
        });
        const pitchRange = Math.max(maxPitch - minPitch, 12);

        ctx.fillStyle = color;
        ctx.globalAlpha = 0.7;

        notes.forEach(note => {
            const nx = x + ((note.startBeat - clipStartBeat) / clipDuration) * width;
            const nw = (note.duration / clipDuration) * width;
            const ny = y + height - ((note.pitch - minPitch) / pitchRange) * (height - 6) - 3;
            const nh = Math.max(2, 3);

            ctx.fillRect(nx, ny, Math.max(1, nw), nh);
        });

        ctx.globalAlpha = 1;
    }

    return { generatePeaks, drawWaveform, drawMidiPreview };
})();
