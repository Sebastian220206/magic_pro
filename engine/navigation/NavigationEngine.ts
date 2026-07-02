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
