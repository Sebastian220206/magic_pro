'use client';

/**
 * Example usage of HorizontalSplitView in a DAW layout
 * 
 * This demonstrates how to integrate the resizable panels with:
 * - Timeline/Arrangement view (top)
 * - Audio Track Editor (bottom)
 */

import React from 'react';
import { HorizontalSplitView } from './HorizontalSplitView';

// Example components (replace with your actual components)
const TimelineView: React.FC = () => (
  <div style={{ 
    background: '#1a1a2e', 
    padding: '20px',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '1px solid #333'
  }}>
    <div>
      <h3 style={{ margin: 0, marginBottom: '10px' }}>Timeline / Arrangement View</h3>
      <p style={{ margin: 0, opacity: 0.7 }}>Your timeline component goes here</p>
    </div>
  </div>
);

const TrackEditor: React.FC = () => (
  <div style={{ 
    background: '#0f0f23', 
    padding: '20px',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '1px solid #333'
  }}>
    <div>
      <h3 style={{ margin: 0, marginBottom: '10px' }}>Audio Track Editor</h3>
      <p style={{ margin: 0, opacity: 0.7 }}>Your track editor component goes here</p>
    </div>
  </div>
);

// Example usage component
export const DAWLayoutExample: React.FC = () => {
  const handleResize = (topHeight: number) => {
    console.log('Top panel resized to:', topHeight);
  };

  return (
    <div style={{ 
      height: '600px', 
      background: '#050510',
      border: '1px solid #333',
      borderRadius: '8px',
      overflow: 'hidden'
    }}>
      <HorizontalSplitView
        top={<TimelineView />}
        bottom={<TrackEditor />}
        initialTopHeight={300}
        minTop={150}
        maxTop={500}
        storageKey="daw_layout_example_height"
        onResize={handleResize}
      />
    </div>
  );
};

export default DAWLayoutExample;
