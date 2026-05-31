'use client';

/**
 * SendControls Component - Send level controls for mixer channels
 * 
 * Features:
 * - Multiple send knobs
 * - Pre/post fader indicator
 * - Send level adjustment
 * - Send on/off toggle
 */

import React, { useCallback, useState, memo } from 'react';

// =============================================================================
// Types
// =============================================================================

export interface SendInfo {
  id: string;
  busName: string;
  level: number;     // dB (-60 to +12)
  preFader: boolean;
  active: boolean;
}

export interface SendControlsProps {
  sends: SendInfo[];
  onSendChange?: (sendId: string, level: number) => void;
  onSendToggle?: (sendId: string, active: boolean) => void;
  className?: string;
}

// =============================================================================
// Constants
// =============================================================================

const MIN_SEND_LEVEL = -60;
const MAX_SEND_LEVEL = 12;

// =============================================================================
// Utility Functions
// =============================================================================

function formatSendLevel(db: number): string {
  if (db <= MIN_SEND_LEVEL) return '-∞';
  return `${db > 0 ? '+' : ''}${db.toFixed(0)}`;
}

// =============================================================================
// Components
// =============================================================================

/**
 * Individual Send Knob
 */
interface SendKnobProps {
  send: SendInfo;
  onLevelChange: (id: string, level: number) => void;
  onToggle: (id: string, active: boolean) => void;
}

const SendKnob: React.FC<SendKnobProps> = memo(({ send, onLevelChange, onToggle }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartY, setDragStartY] = useState(0);
  const [dragStartLevel, setDragStartLevel] = useState(0);
  
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStartY(e.clientY);
    setDragStartLevel(send.level);
    e.preventDefault();
    
    const handleMouseMove = (e: MouseEvent) => {
      const deltaY = dragStartY - e.clientY;
      const sensitivity = 0.5;
      const newLevel = dragStartLevel + deltaY * sensitivity;
      const clampedLevel = Math.max(MIN_SEND_LEVEL, Math.min(MAX_SEND_LEVEL, newLevel));
      onLevelChange(send.id, clampedLevel);
    };
    
    const handleMouseUp = () => {
      setIsDragging(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [send.id, send.level, dragStartY, dragStartLevel, onLevelChange]);
  
  const handleClick = useCallback(() => {
    onToggle(send.id, !send.active);
  }, [send.id, send.active, onToggle]);
  
  // Calculate rotation angle (-135 to +135 degrees)
  const percent = (send.level - MIN_SEND_LEVEL) / (MAX_SEND_LEVEL - MIN_SEND_LEVEL);
  const angle = -135 + percent * 270;
  
  // Color based on level
  const getColor = () => {
    if (!send.active) return '#444';
    if (send.level > 0) return '#e94560';
    if (send.level > -12) return '#ffd700';
    return '#4a5568';
  };
  
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '2px',
        cursor: isDragging ? 'ns-resize' : 'pointer',
      }}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
    >
      {/* Knob */}
      <div
        style={{
          width: '20px',
          height: '20px',
          borderRadius: '50%',
          background: send.active ? '#1a1a2e' : '#2a2a4e',
          border: `2px solid ${getColor()}`,
          position: 'relative',
          transform: `rotate(${angle}deg)`,
          transition: 'border-color 0.1s',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: '2px',
            left: '50%',
            width: '2px',
            height: '6px',
            background: getColor(),
            transform: 'translateX(-50%)',
            borderRadius: '1px',
          }}
        />
      </div>
      
      {/* Label */}
      <span
        style={{
          fontSize: '8px',
          color: send.active ? '#aaa' : '#666',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
        }}
      >
        {send.busName.slice(0, 3)}
      </span>
      
      {/* Pre/Post Indicator */}
      <span
        style={{
          fontSize: '7px',
          color: send.preFader ? '#0f0' : '#888',
        }}
      >
        {send.preFader ? 'PRE' : 'POST'}
      </span>
      
      {/* Level Readout */}
      <span
        style={{
          fontSize: '8px',
          color: send.active ? (send.level > 0 ? '#e94560' : '#fff') : '#666',
          fontFamily: 'monospace',
          minWidth: '24px',
          textAlign: 'center',
        }}
      >
        {formatSendLevel(send.level)}
      </span>
    </div>
  );
});

SendKnob.displayName = 'SendKnob';

// =============================================================================
// Main Component
// =============================================================================

export const SendControls: React.FC<SendControlsProps> = memo(({
  sends,
  onSendChange,
  onSendToggle,
  className = '',
}) => {
  const handleLevelChange = useCallback((sendId: string, level: number) => {
    onSendChange?.(sendId, level);
  }, [onSendChange]);
  
  const handleToggle = useCallback((sendId: string, active: boolean) => {
    onSendToggle?.(sendId, active);
  }, [onSendToggle]);
  
  if (sends.length === 0) {
    return null;
  }
  
  return (
    <div
      className={`send-controls ${className}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        padding: '6px',
        background: '#1a1a2e',
        borderRadius: '2px',
        width: '100%',
      }}
    >
      <div
        style={{
          fontSize: '8px',
          color: '#666',
          textTransform: 'uppercase',
          letterSpacing: '1px',
          textAlign: 'center',
          borderBottom: '1px solid #333',
          paddingBottom: '2px',
        }}
      >
        Sends
      </div>
      
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
        }}
      >
        {sends.map((send) => (
          <SendKnob
            key={send.id}
            send={send}
            onLevelChange={handleLevelChange}
            onToggle={handleToggle}
          />
        ))}
      </div>
    </div>
  );
});

SendControls.displayName = 'SendControls';

export default SendControls;
