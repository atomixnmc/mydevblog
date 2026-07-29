# React 18 Automatic Batching: Fewer Re-Renders

React 18 introduced automatic batching—a seemingly small optimization with profound implications for application performance and developer expectations about when components re-render.

**What is batching?** When multiple state updates occur in the same event handler or lifecycle hook, React groups them into a single re-render. Before React 18, batching only happened inside React event handlers (like `onClick`). State updates in promises, `setTimeout`, native event handlers, or any async callback each triggered a separate synchronous render.

**The classic gotcha**: `setCount(c => c + 1); setFlag(f => !f); setText("updated");` inside a `useEffect` cleanup or a fetch callback would cause three separate renders. Each `setState` call triggered a synchronous commit, causing three layout recalculations and three paint cycles. Developers worked around this with `unstable_batchedUpdates` from `react-dom` or by batching manually with `useReducer`.

**React 18 fixes this** by batching all state updates automatically, regardless of context. The same three `setState` calls inside a fetch callback, a promise `.then()`, or a `setTimeout` now produce a single render. The implementation wraps the callback passed to `setTimeout` and `Promise` prototype methods with React's batch context. Native event listeners attached via `addEventListener` also benefit from batching in React 18.

**The mechanism**: React maintains a batch context per task. When any state update is queued, React checks if a batch is already active. If not, it creates one—wrapping the surrounding code execution. When the context exits, React flushes all queued updates in a single pass. This is transparent to user code: there's no API change required to benefit.

**Edge cases and opt-out**: Batching doesn't change the rule that state updates are asynchronous reads—reading state immediately after a setter still returns the old value in the same batch. To flush updates synchronously (rarely needed), `flushSync` forces immediate commit. This is useful for DOM measurements between updates but should be used sparingly as it defeats batching.

**Performance impact**: Real-world apps see 2-4x reduction in render counts inside async flows. More importantly, it eliminates an entire category of bugs where callbacks fired in unexpected order cause inconsistent renders. Automatic batching is one of those features that makes React both faster and simpler—a rare combination.
