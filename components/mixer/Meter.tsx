'use client';

/**
 * Meter Component - Real-time audio level meter with peak hold
 * 
 * Features:
 * - Peak and RMS level display
 * - Peak hold indicator
 * - dB scale (-60 to +6 dB)
 * - Clip detection
 * - Throttled updates (~60fps)
 */

import React, { useRef, useEffect, useCallback, memo } from 'react';

// =============================================================================
// Types
// =============================================================================

export interface MeterProps {
  peak: number;          // Peak level in dB
  rms: number;         // RMS level in dB
  peakHold?: number;     // Peak hold level in dB
  clipCount?: number;    // Number of clips detected
  width?: number;
  height?: number;
  orientation?: 'vertical' | 'horizontal';
  showScale?: boolean;
  className?: string;
}

// =============================================================================
// Constants
// =============================================================================

const MIN_DB = -60;
const MAX_DB = 6;
const CLIP_THRESHOLD = 0;

// Color stops for the meter gradient
const GRADIENT_STOPS = [
  { db: -60, color: '#1a1a2e' },
  { db: -36, color: '#16213e' },
  { db: -18, color: '#0f3460' },
  { db: -6, color: '#e94560' },
  { db: 0, color: '#ff6b6b' },
  { db: 6, color: '#ff0000' },
];

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Convert dB to percentage (0-1)
 */
function dbToPercent(db: number): number {
  if (db <= MIN_DB) return 0;
  if (db >= MAX_DB) return 1;
  
  // Logarithmic scale
  const normalized = (db - MIN_DB) / (MAX_DB - MIN_DB);
  return Math.max(0, Math.min(1, normalized));
}

/**
 * Get color for a given dB level
 */
function getColorForLevel(db: number): string {
  for (let i = GRADIENT_STOPS.length - 1; i >= 0; i--) {
    if (db >= GRADIENT_STOPS[i].db) {
      return GRADIENT_STOPS[i].color;
    }
  }
  return GRADIENT_STOPS[0].color;
}

// =============================================================================
// Components
// =============================================================================

export const Meter: React.FC<MeterProps> = memo(({
  peak,
  rms,
  peakHold = -Infinity,
  clipCount = 0,
  width = 12,
  height = 200,
  orientation = 'vertical',
  showScale = true,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const peakRef = useRef(peak);
  const rmsRef = useRef(rms);
  const peakHoldRef = useRef(peakHold);
  
  // Store latest values for RAF
  useEffect(() => {
    peakRef.current = peak;
    rmsRef.current = rms;
    peakHoldRef.current = peakHold;
  }, [peak, rms, peakHold]);
  
  // Drawing function
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    
    // Set canvas size with DPR
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    
    const w = rect.width;
    const h = rect.height;
    
    // Clear
    ctx.clearRect(0, 0, w, h);
    
    // Background
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, w, h);
    
    if (orientation === 'vertical') {
      // Calculate heights
      const rmsHeight = dbToPercent(rmsRef.current) * h;
      const peakHeight = dbToPercent(peakRef.current) * h;
      const holdHeight = dbToPercent(peakHoldRef.current) * h;
      
      // RMS bar (gradient)
      const gradient = ctx.createLinearGradient(0, h, 0, 0);
      GRADIENT_STOPS.forEach((stop) => {
        gradient.addColorStop(1 - dbToPercent(stop.db), stop.color);
      });
      
      ctx.fillStyle = gradient;
      ctx.fillRect(0, h - rmsHeight, w * 0.7, rmsHeight);
      
      // Peak bar (thin line)
      ctx.fillStyle = getColorForLevel(peakRef.current);
      ctx.fillRect(0, h - peakHeight, w, 2);
      
      // Peak hold line
      if (peakHoldRef.current > MIN_DB) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, h - holdHeight - 1, w, 2);
      }
    } else {
      // Horizontal orientation
      const rmsWidth = dbToPercent(rmsRef.current) * w;
      const peakWidth = dbToPercent(peakRef.current) * w;
      const holdWidth = dbToPercent(peakHoldRef.current) * w;
      
      // RMS bar
      const gradient = ctx.createLinearGradient(0, 0, w, 0);
      GRADIENT_STOPS.forEach((stop) => {
        gradient.addColorStop(dbToPercent(stop.db), stop.color);
      });
      
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, rmsWidth, h * 0.7);
      
      // Peak bar
      ctx.fillStyle = getColorForLevel(peakRef.current);
      ctx.fillRect(peakWidth, 0, 2, h);
      
      // Peak hold
      if (peakHoldRef.current > MIN_DB) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(holdWidth - 1, 0, 2, h);
      }
    }
    
    // Clip indicator
    if (clipCount > 0 || peakRef.current >= CLIP_THRESHOLD) {
      ctx.fillStyle = peakRef.current >= CLIP_THRESHOLD ? '#ff0000' : '#ffff00';
      ctx.beginPath();
      ctx.arc(w - 6, 6, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // Scale markers
    if (showScale) {
      ctx.fillStyle = '#666';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'left';
      
      const markers = [-60, -36, -18, -12, -6, 0, 6];
      markers.forEach((db) => {
        const pos = dbToPercent(db);
        
        if (orientation === 'vertical') {
          const y = h - pos * h;
          ctx.fillRect(w - 4, y, 4, 1);
          ctx.fillText(`${db > 0 ? '+' : ''}${db}`, w + 2, y + 3);
        } else {
          const x = pos * w;
          ctx.fillRect(x, h - 4, 1, 4);
        }
      });
    }
  }, [orientation, showScale]);
  
  // Animation loop
  useEffect(() => {
    let rafId: number;
    
    const animate = () => {
      draw();
      rafId = requestAnimationFrame(animate);
    };
    
    rafId = requestAnimationFrame(animate);
    
    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [draw]);
  
  return (
    <div
      className={`meter ${className}`}
      style={{
        width: orientation === 'vertical' ? width + (showScale ? 30 : 0) : width,
        height: orientation === 'vertical' ? height : height + (showScale ? 20 : 0),
        display: 'flex',
        flexDirection: orientation === 'vertical' ? 'row' : 'column',
        gap: '4px',
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          width: orientation === 'vertical' ? width : width,
          height: orientation === 'vertical' ? height : height,
          background: '#1a1a2e',
          borderRadius: '2px',
        }}
      />
    </div>
  );
});

Meter.displayName = 'Meter';

export default Meter;
