import { useCallback } from 'react';

export function useErrorHandler(name: string) {
  return useCallback((error: Error) => {
    console.error(`[${name}]`, error);
    // hook into your error reporting here
  }, [name]);
}
