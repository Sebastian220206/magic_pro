import { NavigationLoop } from './NavigationLoop';
import { globalViewportGroup, ViewportChannelId } from './channels/ViewportChannel';

// Global instances for the main DAW surfaces
export const timelineNavigation = new NavigationLoop({
  startBeat: 0,
  pixelsPerBeat: 20,
  maxVisiblePitch: 127,
  pixelsPerPitch: 12,
  zoomY: 1
});

export const pianoRollNavigation = new NavigationLoop({
  startBeat: 0,
  pixelsPerBeat: 40,
  maxVisiblePitch: 100,
  pixelsPerPitch: 16,
  zoomY: 1
});

// Link Viewports horizontally
globalViewportGroup.registerChannel(ViewportChannelId.ARRANGEMENT, timelineNavigation.getState());
globalViewportGroup.registerChannel(ViewportChannelId.PIANO_ROLL, pianoRollNavigation.getState());
globalViewportGroup.linkHorizontal(ViewportChannelId.ARRANGEMENT, [ViewportChannelId.PIANO_ROLL]);

// Sync states to the group
timelineNavigation.subscribe(state => globalViewportGroup.commitTransaction(ViewportChannelId.ARRANGEMENT, state));
pianoRollNavigation.subscribe(state => globalViewportGroup.commitTransaction(ViewportChannelId.PIANO_ROLL, state));

/**
 * Viewport handle for debugging and end-to-end tests, alongside
 * `window.__projectStore` and `window.__midiStore`.
 *
 * Development only. A test that drives the piano-roll grid needs to know which
 * pitches and beats are actually on screen — without it, a drag that looks
 * correct in page coordinates can be nowhere near the notes.
 */
if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
    (window as unknown as Record<string, unknown>).__pianoRollNav = pianoRollNavigation;
}
