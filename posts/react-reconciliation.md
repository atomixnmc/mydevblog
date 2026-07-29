# React Reconciliation: How the Virtual DOM Diff Works

React's reconciliation algorithm is often described as "the virtual DOM diff," but that undersells it. It's not a generic tree-diff (O(n³) in the general case) but a heuristic algorithm that makes two assumptions to achieve O(n): components of different types produce different trees, and keys identify stable elements across renders.

The reconciliation process starts at the root. When comparing two trees, React walks both simultaneously. A type mismatch (`<div>` vs `<span>`, `ComponentA` vs `ComponentB`) triggers a full rebuild—React tears down the old subtree and mounts a new one. This is why changing a component's root element type is expensive.

```jsx
// Bad: type change tears down and rebuilds
return isMobile ? <MobileNav /> : <DesktopNav />;

// Good: same type, different props
return <Nav variant={isMobile ? 'mobile' : 'desktop'} />;
```

For children of the same type, React reconciles by position. Without keys, it compares the first child of the old tree with the first child of the new tree. If you reorder a list, every element's rendered output differs from its old counterpart, causing full re-renders of the entire list.

```jsx
// Without keys: list reorder = O(n) re-renders
items.map(item => <li>{item.name}</li>);

// With keys: React moves DOM nodes instead of recreating them
items.map(item => <li key={item.id}>{item.name}</li>);
```

Keys should be stable, unique, and predictable. The index from `Array.map` is an anti-pattern for dynamic lists—inserting an item at index 0 shifts all old keys, forcing React to reconcile everything. Use the entity's database ID or a generated UUID.

The **commit phase** applies the effect list. React walks the fiber tree's effect list (a linked list of side effects—insert, update, delete) and applies them to the DOM. This is synchronous: no interruptions, no yielding. The effect list is built during the render phase and consumed atomically.

Measures that reduce reconciliation work:
- `React.memo` / `PureComponent` to skip re-rendering when props haven't changed (shallow comparison).
- `useMemo` for expensive computations that shouldn't re-run.
- Moving state down so high-frequency updates don't cascade through the tree.
- Using Context sparingly—every consumer re-renders when context value changes, reconciling its entire subtree.

Reconciliation isn't magic—it's an O(n) tree-walk with well-understood performance characteristics. Code that respects React's heuristics (stable keys, same element types, narrow state updates) reconciles fast.
