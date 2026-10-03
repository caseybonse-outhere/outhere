import { useEffect, useRef } from 'react';

/**
 * Tiny app-wide signal for "jam data changed" (created, edited, deleted, joined).
 * Screens that list jams subscribe so they refresh immediately, even when the change
 * happened in a modal that didn't trigger a focus event on the screen underneath.
 */
const listeners = new Set<() => void>();

export function emitJamsChanged() {
  listeners.forEach((fn) => fn());
}

export function useOnJamsChanged(fn: () => void) {
  const ref = useRef(fn);
  useEffect(() => {
    ref.current = fn;
  });
  useEffect(() => {
    const handler = () => ref.current();
    listeners.add(handler);
    return () => {
      listeners.delete(handler);
    };
  }, []);
}
