# React Concurrent Mode

React 18 introduced Concurrent Features, a ground-up rearchitecture of React's rendering engine. The goal: make React "interruptible" so the browser stays responsive during large renders. This changes how React prioritizes work and interacts with the browser's event loop.

Before Concurrent Mode, React rendering was synchronous and atomic. Once a render started, it blocked the main thread until complete. If a component tree took 200ms to render, the browser froze for 200ms — no user input, no animations, no scrolling.

Concurrent rendering splits work into units. React can pause between units, check for higher-priority updates, and yield back to the browser. This is powered by the new Scheduler, which coordinates work based on priority levels: immediate, user-blocking, normal, low, and idle. The scheduler integrates with the browser's `requestIdleCallback` and `MessageChannel` APIs.

The two main APIs are `startTransition` and `useDeferredValue`. `startTransition` marks a state update as low priority. The transition gets interrupted if a higher-priority update (like typing) occurs:

```jsx
startTransition(() => {
  setSearchResults(filter(query));
});
```

`useDeferredValue` creates a lagging version of a value that can be interrupted. The old value stays visible until the new one finishes rendering.

Suspense gets a companion feature: Transition Suspense. Instead of replacing old content with a fallback on every navigation, React shows the old content until the new content is ready. This eliminates flash-of-loading-state during navigation.

Concurrent Mode isn't enabled by default — you opt in with `createRoot`. The migration path is gradual because most existing React code works unchanged under concurrent rendering.
