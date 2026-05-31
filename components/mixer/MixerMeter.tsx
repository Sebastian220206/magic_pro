'use client';

/**
 * Mixer Meter - Peak/RMS level meter with hold
 * 
 * Features:
 * - Peak level display
 * - RMS average display
 * - Peak hold indicator
 * - Clip indicator
 * - Smooth animation
 */

import React, { useRef, useEffect, memo } from 'react';
import { MeterData } from '../../engine/audioEngine/audioMeter';

interface MixerMeterProps {
  data: MeterData;
  width?: number;
  height?: number;
  orientation?: 'vertical' | 'horizontal';
  showPeakHold?: boolean;
  showRMS?: boolean;
}

export const MixerMeter = memo(function MixerMeter({
  data,
  width = 12,
  height = 180,
  orientation = 'vertical',
  showPeakHold = true,
  showRMS = true,
}: MixerMeterProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Draw meter
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear
    ctx.clearRect(0, 0, width, height);

    // Background
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, width, height);

    // Convert dB to position (0 = -60dB, 1 = +12dB)
    const dbToPos = (db: number): number => {
      const minDb = -60;
      const maxDb = 12;
      const normalized = (db - minDb) / (maxDb - minDb);
      return Math.max(0, Math.min(1, normalized));
    };

    const peakLeftPos = dbToPos(data.peakLeft);
    const peakRightPos = dbToPos(data.peakRight);
    const rmsLeftPos = dbToPos(data.rmsLeft);
    const rmsRightPos = dbToPos(data.rmsRight);

    if (orientation === 'vertical') {
      const centerX = width / 2;
      const barWidth = width / 2 - 1;

      // RMS bars (darker)
      if (showRMS) {
        ctx.fillStyle = '#4ade80';
        ctx.fillRect(0, height * (1 - rmsLeftPos), barWidth, height * rmsLeftPos);
        
        ctx.fillStyle = '#60a5fa';
        ctx.fillRect(centerX, height * (1 - rmsRightPos), barWidth, height * rmsRightPos);
      }

      // Peak bars (brighter)
      ctx.fillStyle = data.clipLeft ? '#ef4444' : '#22c55e';
      ctx.fillRect(0, height * (1 - peakLeftPos), barWidth, 2);
      
      ctx.fillStyle = data.clipRight ? '#ef4444' : '#3b82f6';
      ctx.fillRect(centerX, height * (1 - peakRightPos), barWidth, 2);

      // Peak hold lines
      if (showPeakHold) {
        const holdLeftPos = dbToPos(data.peakHoldLeft);
        const holdRightPos = dbToPos(data.peakHoldRight);
        
        ctx.fillStyle = '#fbbf24';
        ctx.fillRect(0, height * (1 - holdLeftPos) - 1, barWidth, 1);
        ctx.fillRect(centerX, height * (1 - holdRightPos) - 1, barWidth, 1);
      }
    } else {
      // Horizontal orientation
      const centerY = height / 2;
      const barHeight = height / 2 - 1;

      if (showRMS) {
        ctx.fillStyle = '#4ade80';
        ctx.fillRect(0, 0, width * rmsLeftPos, barHeight);
        
        ctx.fillStyle = '#60a5fa';
        ctx.fillRect(0, centerY, width * rmsRightPos, barHeight);
      }

      ctx.fillStyle = data.clipLeft ? '#ef4444' : '#22c55e';
      ctx.fillRect(width * peakLeftPos - 2, 0, 2, barHeight);
      
      ctx.fillStyle = data.clipRight ? '#ef4444' : '#3b82f6';
      ctx.fillRect(width * peakRightPos - 2, centerY, 2, barHeight);
    }

    // 0dB line marker
    const zeroDbPos = dbToPos(0);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    
    if (orientation === 'vertical') {
      ctx.moveTo(0, height * (1 - zeroDbPos));
      ctx.lineTo(width, height * (1 - zeroDbPos));
    } else {
      ctx.moveTo(width * zeroDbPos, 0);
      ctx.lineTo(width * zeroDbPos, height);
    }
    ctx.stroke();

  }, [data, width, height, orientation, showPeakHold, showRMS]);

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="rounded-sm"
        style={{ width, height }}
      />
      
      {/* Clip indicators */}
      {(data.clipLeft || data.clipRight) && (
        <div className="absolute -top-5 left-0 right-0 flex justify-center gap-1">
          {data.clipLeft && <span className="text-[10px] text-red-500 font-bold">L</span>}
          {data.clipRight && <span className="text-[10px] text-red-500 font-bold">R</span>}
        </div>
      )}
    </div>
  );
});

export default MixerMeter;
