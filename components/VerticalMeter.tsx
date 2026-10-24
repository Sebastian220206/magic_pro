"use client"

import { useEffect, useRef } from "react"
import { meterBandColor, METER_NOMINAL } from "@/lib/meterPalette"

interface VerticalMeterProps {
  analyzer: AnalyserNode | null
  side?: 'L' | 'R'
  className?: string
}

// Authentic Logic Pro PPM Meter styling
// Reverse-engineered from MAMixerAssetMapping.plist & LevelMeterStereoDark
const LOGIC_METER_GRADIENT = 'linear-gradient(to top, #4cd964 0%, #4cd964 55%, #ffd203 70%, #ffd203 87%, #e53939 88%, #ff3b30 100%)';

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
        }
        
        const bufferLength = 32;
        const dataArray = new Uint8Array(bufferLength);
        let rafId: number;

        const update = () => {
            analyzer.getByteTimeDomainData(dataArray);
            let max = 0;
            for (let i = 0; i < bufferLength; i++) {
                const v = Math.abs(dataArray[i] - 128);
                if (v > max) max = v;
            }

            let level = (max / 128);
            
            // Logic Pro ballistics: fast attack, smooth logarithmic decay
            if (level < lastValue.current) {
                level = lastValue.current * 0.88 + level * 0.12;
            }
            lastValue.current = level;

            const percent = Math.min(100, level * 100);
            
            // Logic Pro Peak Hold (1.2s hold duration)
            if (percent > lastPeak.current) {
                lastPeak.current = percent;
                peakDecayTime.current = Date.now() + 1200;
            } else if (Date.now() > peakDecayTime.current) {
                lastPeak.current *= 0.94;
            }

            if (barRef.current) {
                barRef.current.style.height = `${percent}%`;
            }
            if (peakRef.current) {
                peakRef.current.style.bottom = `${lastPeak.current}%`;
                peakRef.current.style.opacity = lastPeak.current > 1.5 ? '1' : '0';
            }

            rafId = requestAnimationFrame(update);
        };

        update();
        return () => cancelAnimationFrame(rafId);
    }, [analyzer]);

    return (
        <div 
            className={`h-full w-2 bg-[#090b0d] rounded-[1.5px] border border-[#1b1c1e] relative overflow-hidden flex flex-col justify-end shadow-inner ${className}`}
            style={{
                backgroundImage: 'repeating-linear-gradient(to bottom, rgba(0,0,0,0.45) 0px, rgba(0,0,0,0.45) 1px, transparent 1px, transparent 3px)'
            }}
        >
            {/* Logic Pro LED segmented meter bar */}
            <div 
                ref={barRef} 
                className="w-full transition-all duration-75 ease-out rounded-t-[0.5px]"
                style={{ 
                    height: '0%', 
                    background: LOGIC_METER_GRADIENT,
                    boxShadow: '0 0 4px rgba(76, 217, 100, 0.4)'
                }}
            />
            {/* Logic Pro Peak Hold Needle */}
            <div 
                ref={peakRef}
                className="absolute left-0 right-0 h-[1.5px] bg-[#ffffff] z-10 shadow-[0_0_2px_#ffffff]"
                style={{ bottom: '0%' }}
            />
        </div>
    );
}

export default VerticalMeter;
