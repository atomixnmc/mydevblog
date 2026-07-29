# React Suspense Data Fetching

React Suspense provides a declarative way to handle asynchronous operations in React components. Instead of managing loading states with conditional logic, Suspense lets components "suspend" while data loads, with a fallback UI rendered by the nearest `<Suspense>` boundary.

The core pattern: a component throws a promise (or uses a framework that does). React catches the promise, looks up the nearest `<Suspense>` ancestor, and renders its `fallback` prop. When the promise resolves, React re-renders the suspended component with the now-available data:

```jsx
<Suspense fallback={<Spinner />}>
  <UserProfile userId={id} />
</Suspense>
```

This eliminates manual `isLoading` booleans and `useEffect` orchestration. The component expresses what it needs (data), not how to load it.

In practice, Suspense works with data fetching libraries that implement the Suspense integration contract. Relay, SWR, TanStack Query, and the new React `use()` hook (React 19) all support Suspense. The data source wraps fetch calls in a cache that throws promises on cache miss and returns data on cache hit.

Suspense composes naturally. Multiple suspended siblings load in parallel — React shows the nearest fallback until all are ready. Nested Suspense boundaries allow granular loading states: the main layout renders immediately while detail sections show their own spinners.

Error handling uses Error Boundaries with Suspense. An error in a suspended component propagates to the nearest Error Boundary, independent of the Suspense fallback. This clean separation lets you design loading states and error states as orthogonal concerns.

The mental model shift is significant: instead of orchestrating data loading in effects, you declare data dependencies and let React handle the orchestration. This leads to simpler components that are easier to reason about and test.
