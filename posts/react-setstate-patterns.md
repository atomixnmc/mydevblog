# React setState Batching: Patterns and Pitfalls

React's `setState` batching is one of those features that works beautifully until it doesn't. Understanding when React batches state updates—and when it doesn't—saves you from the stale-closure bugs that plague intermediate React developers.

In React <= 17, `setState` calls inside React event handlers are batched automatically. React wraps your handler in a synthetic event transaction, collects all `setState` calls, and performs a single re-render. But **outside** event handlers—in `setTimeout`, `fetch` callbacks, or native DOM listeners—each `setState` triggers a separate render:

```js
// Batched (React event handler)
handleClick = () => {
  this.setState({ a: 1 });  // enqueued
  this.setState({ b: 2 });  // enqueued
  // Single render with { a: 1, b: 2 }
};

// NOT batched (setTimeout)
handleLater = () => {
  setTimeout(() => {
    this.setState({ a: 1 });  // render 1
    this.setState({ b: 2 });  // render 2
  }, 100);
};
```

The functional updater pattern—passing a function instead of an object—solves the stale-state problem when updates depend on previous state:

```js
// Wrong: race condition if batched differently
this.setState({ count: this.state.count + 1 });
this.setState({ count: this.state.count + 1 });
// Result: count + 1, not +2

// Correct: functional updater
this.setState(prev => ({ count: prev.count + 1 }));
this.setState(prev => ({ count: prev.count + 1 }));
// Result: count + 2
```

React 18 introduced **automatic batching** via `createRoot`. Now all `setState` calls—even in `setTimeout` and promises—are batched. The `flushSync` API provides an escape hatch when you need synchronous DOM reads between updates.

The mental model I use: treat `setState` as asynchronous, always use the functional form when computing from previous state, and stop worrying about batching once you're on React 18 with `createRoot`. The patterns are simple, but the edge cases used to bite us constantly.
