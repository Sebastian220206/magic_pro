import { useEffect, useState } from 'react';
import { NavigationLoop } from './NavigationLoop';
import { ViewportState } from './types';

/**
 * Hook to synchronize a React component with the 60fps Navigation Frame Graph.
 * Use this sparingly (e.g. at the container level) to avoid React re-render storms.
 * Canvas elements should ideally bypass this and subscribe directly inside their render loops.
 */
export function useNavigation(loop: NavigationLoop): ViewportState {
  const [viewport, setViewport] = useState<ViewportState>(loop.getState());

  useEffect(() => {
    const unsubscribe = loop.subscribe((newState) => {
      setViewport(newState);
    });
    
    return unsubscribe;
  }, [loop]);

  return viewport;
}
