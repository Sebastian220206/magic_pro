"use client"

import { useEffect, useRef } from "react"
import { meterBandColor, METER_NOMINAL } from "@/lib/meterPalette"

interface VerticalMeterProps {
  analyzer: AnalyserNode | null
  side?: 'L' | 'R'
  className?: string
}

/**
 * VerticalMeter
 * 
 * A high-performance vertical level meter for channel strips.
 * Uses requestAnimationFrame for real-time visualization.
 */
export function VerticalMeter({ analyzer, side, className = "" }: VerticalMeterProps) {
    const barRef = useRef<HTMLDivElement>(null);
    const peakRef = useRef<HTMLDivElement>(null);
    const lastValue = useRef(0);
    const lastPeak = useRef(0);
    const peakDecayTime = useRef(0);

    useEffect(() => {
        if (!analyzer) {
            if (barRef.current) barRef.current.style.height = '0%';
            if (peakRef.current) peakRef.current.style.bottom = '0%';
            return;
        };
        
        const bufferLength = 32; // Small buffer for performance
        const dataArray = new Uint8Array(bufferLength);
        let rafId: number;

        const update = () => {
            analyzer.getByteTimeDomainData(dataArray);
            let max = 0;
            // Get instantaneous peak from time domain data
            for (let i = 0; i < bufferLength; i++) {
                const v = Math.abs(dataArray[i] - 128);
                if (v > max) max = v;
            }

            // Convert to 0-1.0 range
            let level = (max / 128);
            
            // Smoothed falling edge
            if (level < lastValue.current) {
                level = lastValue.current * 0.85 + level * 0.15;
            }
            lastValue.current = level;

            const percent = level * 100;
            
            // Peak Hold logic
            if (percent > lastPeak.current) {
                lastPeak.current = percent;
                peakDecayTime.current = Date.now() + 1000;
            } else if (Date.now() > peakDecayTime.current) {
                lastPeak.current *= 0.95;
            }

            if (barRef.current) {
                const band = meterBandColor(level);
                barRef.current.style.height = `${percent}%`;
                barRef.current.style.backgroundColor = band;
                // The glow tracks the band, so a clipping meter flares red.
                barRef.current.style.boxShadow = `0 0 8px ${band}`;
            }
            if (peakRef.current) {
                peakRef.current.style.bottom = `${lastPeak.current}%`;
                peakRef.current.style.opacity = lastPeak.current > 1 ? '1' : '0';
            }

            rafId = requestAnimationFrame(update);
        };

        update();
        return () => cancelAnimationFrame(rafId);
    }, [analyzer]);

    return (
        <div className={`h-full w-1.5 bg-studio-void rounded-full border border-studio-line relative overflow-hidden flex flex-col justify-end ${className}`}>
            <div 
                ref={barRef} 
                className="w-full transition-all duration-75 ease-out rounded-t-[1px]"
                style={{ height: '0%', backgroundColor: METER_NOMINAL, boxShadow: `0 0 8px ${METER_NOMINAL}` }}
            ></div>
            <div 
                ref={peakRef}
                className="absolute left-0 right-0 h-[1px] bg-white z-10"
                style={{ bottom: '0%' }}
            ></div>
        </div>
    );
}

export default VerticalMeter;
