import { useRef } from "react";
import { useSyncExternalStore } from "preact/compat";

// Lightweight selector-aware hook to satisfy recharts under preact/compat
export function useSyncExternalStoreWithSelector(
  subscribe,
  getSnapshot,
  getServerSnapshot,
  selector,
  isEqual,
) {
  const lastSelector = useRef();
  const lastSnapshot = useRef();
  const lastValue = useRef();

  const selectedValue = useSyncExternalStore(
    subscribe,
    () => getSnapshot(),
    getServerSnapshot ? () => getServerSnapshot() : undefined,
  );

  const nextSnapshot = selectedValue;
  const nextSelector = selector || ((value) => value);
  const nextValue = nextSelector(nextSnapshot);

  const selectorChanged = lastSelector.current !== nextSelector;
  const snapshotChanged = lastSnapshot.current !== nextSnapshot;
  const equal = isEqual
    ? isEqual(lastValue.current, nextValue)
    : lastValue.current === nextValue;

  if (selectorChanged || snapshotChanged || !equal) {
    lastSelector.current = nextSelector;
    lastSnapshot.current = nextSnapshot;
    lastValue.current = nextValue;
  }

  return lastValue.current;
}

