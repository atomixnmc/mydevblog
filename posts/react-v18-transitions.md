# React Transitions API

React 18's transitions API lets you mark certain state updates as non-urgent, allowing React to keep showing the current UI while the next state renders behind the scenes. This solves the problem of UI jank during complex updates like filtering large lists or navigating between pages.

The primary API is `startTransition`:

```jsx
import { startTransition } from 'react';

startTransition(() => {
  setSearchQuery(newQuery);
});
```

Updates inside `startTransition` get marked as transitions. React may delay rendering these updates if a higher-priority update (like a keystroke or click) arrives. The transition rendering can also be interrupted and restarted if a newer transition arrives.

The `useTransition` hook adds a pending indicator:

```jsx
const [isPending, startTransition] = useTransition();
```

`isPending` is true while the transition is rendering. This lets you show a subtle loading indicator without blocking the UI. The key UX insight: showing stale content briefly is better than showing nothing or a full-screen spinner.

Transitions compose with Suspense. By default, a transition that triggers a Suspense fallback shows the old content instead of the fallback. This prevents layout shift when navigating between routes. You control this with `Suspense` boundary behavior configuration.

The `useDeferredValue` hook is the companion API. It lets you defer a derived value rather than a state update:

```jsx
const deferredQuery = useDeferredValue(query);
const results = useMemo(() => filter(items, deferredQuery), [items, deferredQuery]);
```

The deferred value lags behind the real value. When `query` changes, the old `deferredQuery` stays visible while the new filter computation runs. If a newer `query` arrives, the deferred computation restarts.

Transitions work with any concurrent-safe data library. React Router 6.4+ integrates transitions into its navigation model, providing seamless page transitions without manual startTransition usage.

The mental model: transitions are the React way of saying "this update can wait." They make applications feel responsive even when doing expensive work, by prioritizing user intent signals over rendering completeness.
