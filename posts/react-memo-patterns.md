# React.memo and useMemo Patterns

React.memo and useMemo are the primary tools for preventing unnecessary re-renders in React. Understanding when and how to use them — and when they're counterproductive — is essential for building performant applications.

`React.memo` is a higher-order component that memoizes the rendered output. If props haven't changed (by shallow equality), React reuses the last rendered result, skipping the component's render:

```jsx
const ExpensiveList = React.memo(({ items }) => {
  return items.map(item => <Item key={item.id} {...item} />);
});
```

`React.memo` helps when a component renders often with the same props. It hurts when the props comparison is more expensive than rendering, or when props change every frame (like animation progress values).

`useMemo` memoizes computed values:

```jsx
const sortedItems = useMemo(
  () => items.sort((a, b) => a.name.localeCompare(b.name)),
  [items]
);
```

Use `useMemo` when the computation is expensive (array sorting, data transformation, filtering). Don't use it for trivial computations — the memoization overhead exceeds the computation cost.

`useCallback` memoizes functions and complements `React.memo`:

```jsx
const handleClick = useCallback(() => {
  setCount(c => c + 1);
}, []);
```

Without `useCallback`, inline functions create a new reference on every render, defeating `React.memo`'s prop comparison. With `useCallback`, the reference stays stable as long as dependencies don't change.

Common anti-patterns: wrapping everything in `useMemo` (premature optimization), forgetting dependency arrays (stale closures), and memoizing components that accept children (children are new references every render). The last one is the most common — `<MemoizedComponent><div /></MemoizedComponent>` never memoizes because `children` is a new object each render.

React 19's React Compiler will automate memoization. Until then, profile before optimizing. Use React DevTools profiler to identify actual bottlenecks, then apply memoization surgically.
