import { RefObject, useLayoutEffect, useRef } from 'react';

/** The latest value for event handlers and effects, updated after each commit (never during render). */
export function useLatest<T>(value: T): RefObject<T> {
  const ref = useRef(value);
  useLayoutEffect(() => {
    ref.current = value;
  });
  return ref;
}
