"use client"

function peaksToPath(peaks: { channels: Array<{ min: number[] | Float32Array; max: number[] | Float32Array }>; resolution: number }, numPoints: number): string {
    const ch = peaks.channels[0];
    if (!ch) return '';
    const step = Math.max(1, Math.floor(ch.min.length / numPoints));
    const mid = 20;
    const scale = 18;
    let d = '';
    for (let i = 0; i < numPoints; i++) {
        const idx = Math.min(Math.floor(i * step), ch.min.length - 1);
        const minVal = Number(ch.min[idx]) || 0;
        const maxVal = Number(ch.max[idx]) || 0;
        const x = (i / numPoints) * 100;
        const top = mid - maxVal * scale;
        const bot = mid - minVal * scale;
        d += `M${x} ${top} L${x} ${bot} `;
    }
    return d;
}

export function WaveformSVG({ color = "#38bdf8", peaks }: { color?: string; peaks?: { channels: Array<{ min: number[] | Float32Array; max: number[] | Float32Array }>; resolution: number } }) {
    const pathD = peaks ? peaksToPath(peaks, 100) : null;

    return (
        <svg
            viewBox="0 0 100 40"
            preserveAspectRatio="none"
            className="w-full h-full opacity-60 drop-shadow-[0_0_2px_rgba(0,0,0,0.4)]"
        >
            {pathD ? (
                <path d={pathD} fill="none" stroke={color} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            ) : (
                <>
                    <path
                        d="M0 20 L2 15 L5 25 L8 10 L12 30 L15 15 L20 22 L25 5 L30 35 L35 18 L40 22 L45 8 L50 32 L55 15 L60 25 L65 10 L70 30 L75 15 L80 22 L85 5 L90 35 L95 18 L100 20"
                        fill="none"
                        stroke={color}
                        strokeWidth="1.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                    <path
                        d="M0 20 L3 18 L6 22 L10 15 L14 25 L18 18 L22 21 L27 10 L32 30 L37 20 L42 21 L47 12 L52 28 L57 18 L62 22 L67 15 L72 25 L77 18 L82 21 L87 10 L92 30 L97 20 L100 20"
                        fill="none"
                        stroke={color}
                        strokeWidth="0.6"
                        strokeOpacity="0.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                </>
            )}
        </svg>
    )
}
