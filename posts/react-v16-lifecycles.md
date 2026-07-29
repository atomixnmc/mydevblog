# React Lifecycle Evolution: From v16 to the Future

React's lifecycle API has been through three distinct eras. Understanding the evolution—from the original class lifecycle, through the v16 deprecations, to hooks—explains why certain patterns exist and which ones to avoid in new code.

**Era 1: The Original Lifecycle (v0.14–v15)**. Components had `componentWillMount`, `componentDidMount`, `componentWillReceiveProps`, `shouldComponentUpdate`, `componentWillUpdate`, `componentDidUpdate`, and `componentWillUnmount`. Developers used `componentWillMount` for setup and `componentWillReceiveProps` for responding to prop changes—until the React team realised these methods were frequently misused for side effects.

**Era 2: The v16.3 Deprecations**. React renamed unsafe methods with the `UNSAFE_` prefix: `UNSAFE_componentWillMount`, `UNSAFE_componentWillReceiveProps`, `UNSAFE_componentWillUpdate`. Two new lifecycles arrived:

```js
// Replaces componentWillReceiveProps
static getDerivedStateFromProps(props, state) {
  const derivedCount = Math.max(props.minCount, state.count);
  if (derivedCount !== state.count) {
    return { count: derivedCount };
  }
  return null; // No state update
}

// Replaces componentWillUpdate - snapshot result passed to componentDidUpdate
getSnapshotBeforeUpdate(prevProps, prevState) {
  const scrollPos = this.listRef.scrollHeight - this.listRef.scrollTop;
  return scrollPos; // Passed as third arg to componentDidUpdate
}
```

The `getDerivedStateFromProps` static method was controversial—it runs on every render and is easy to misuse. Most cases where you think you need derived state are better solved with fully controlled components or memoisation.

**Era 3: Hooks (v16.8+)**. Hooks collapsed the lifecycle methods into `useEffect`, `useLayoutEffect`, and `useMemo`:

```js
// componentDidMount + componentDidUpdate + componentWillUnmount, all in one
useEffect(() => {
  // Runs after paint
  ChatAPI.subscribe(props.channel);
  return () => ChatAPI.unsubscribe(props.channel); // Cleanup
}, [props.channel]); // Re-run when channel changes

// componentDidMount equivalent (empty deps)
useEffect(() => { fetchData(); }, []);

// componentDidUpdate equivalent (no deps)
useEffect(() => { /* runs on every render */ });
```

The migration path was clear: start new components with hooks, refactor class components that require lifecycle changes, and leave stable class components alone until you have a reason to touch them. The `react-lifecycles-compat` package helped during the transition.

Today, the class lifecycle methods remain supported but static. All new React development uses hooks, and the React docs now teach hooks first.
