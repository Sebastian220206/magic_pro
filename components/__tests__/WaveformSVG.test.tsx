/**
 * A clip with no peaks used to draw a lie.
 *
 * `WaveformSVG` carried two hard-coded zig-zag paths as its fallback, so a file
 * that failed to decode on import — `store/projectStore.ts` leaves
 * `waveformPeaks` undefined in that case — was shown a convincing picture of
 * audio that does not exist.
 */

import { render } from '@testing-library/react';
import { WaveformSVG } from '@/components/WaveformSVG';

const peaks = (n: number, lo: number, hi: number) => ({
    channels: [{ min: new Float32Array(n).fill(lo), max: new Float32Array(n).fill(hi) }],
    resolution: n,
    numChannels: 1,
});

describe('a waveform with no data', () => {
    it('says so instead of drawing one', () => {
        const { container } = render(<WaveformSVG color="#22d3ee" width={100} height={40} />);

        const missing = container.querySelector('[data-waveform-missing]');
        expect(missing).toBeTruthy();
        expect(missing?.querySelector('title')?.textContent).toMatch(/could not be decoded/i);
    });

    it('draws no filled shape at all', () => {
        const { container } = render(<WaveformSVG color="#22d3ee" width={100} height={40} />);

        // The old fallback was two <path> elements. Any path here would be
        // invented audio.
        expect(container.querySelectorAll('path')).toHaveLength(0);
    });

    it('is dashed, so it cannot be mistaken for silence', () => {
        // Under the minimum-thickness rule, true silence draws a *solid*
        // hairline. The dash is what separates "no data" from "no sound".
        const { container } = render(<WaveformSVG color="#22d3ee" width={100} height={40} />);
        expect(container.querySelector('line')?.getAttribute('stroke-dasharray')).toBeTruthy();
    });

    it('treats an empty channel list as no data', () => {
        const { container } = render(
            <WaveformSVG color="#22d3ee" width={100} height={40} peaks={{ channels: [] }} />,
        );
        expect(container.querySelector('[data-waveform-missing]')).toBeTruthy();
    });
});

describe('a waveform with data', () => {
    it('draws one filled path', () => {
        const { container } = render(
            <WaveformSVG color="#ec4899" width={120} height={40} peaks={peaks(200, -0.6, 0.6)} />,
        );

        const paths = container.querySelectorAll('path');
        expect(paths).toHaveLength(1);
        expect(paths[0].getAttribute('fill')).toBe('#ec4899');
        expect(paths[0].getAttribute('d')?.startsWith('M')).toBe(true);
        expect(paths[0].getAttribute('d')?.endsWith('Z')).toBe(true);
    });

    it('sizes its viewBox to the box it was given, with no aspect override', () => {
        const { container } = render(
            <WaveformSVG color="#22d3ee" width={137} height={44} peaks={peaks(200, -1, 1)} />,
        );
        const svg = container.querySelector('svg');
        expect(svg?.getAttribute('viewBox')).toBe('0 0 137 44');
        // `preserveAspectRatio="none"` is what scaled the old stroke
        // anisotropically, so bar weight depended on the clip's width.
        expect(svg?.getAttribute('preserveAspectRatio')).toBeNull();
    });

    it('and no missing-data marker', () => {
        const { container } = render(
            <WaveformSVG color="#22d3ee" width={100} height={40} peaks={peaks(100, -0.3, 0.3)} />,
        );
        expect(container.querySelector('[data-waveform-missing]')).toBeNull();
    });
});
