# React Fiber: The v16 Reconciler Rewrite

React v16 introduced Fiber—a complete rewrite of the reconciliation engine that changed React from a synchronous, stack-based renderer to an asynchronous, prioritized one. Most developers noticed only the new lifecycle methods and error boundaries, but Fiber was the foundation that made everything else possible.

Before Fiber, React's reconciler used recursive traversal. Once rendering started, it blocked the main thread until the full tree was processed. On large trees or complex updates, visible jank appeared as React held the thread for 50–100ms frames. Fiber solved this by breaking work into **units of work**—small chunks that can be interrupted, paused, and resumed.

```js
// Conceptual: Fiber's work loop (simplified)
let nextUnitOfWork = null;

function workLoop(deadline) {
  let shouldYield = false;
  while (nextUnitOfWork && !shouldYield) {
    nextUnitOfWork = performUnitOfWork(nextUnitOfWork);
    shouldYield = deadline.timeRemaining() < 1;
  }
  requestIdleCallback(workLoop);
}

requestIdleCallback(workLoop);
```

The key data structure is the **Fiber node**. Each fiber is a JavaScript object representing a component instance with pointers to its child, sibling, and return (parent). This linked-list tree enables walking the tree in any order—depth-first for commit, breadth-first for reconciliation—without the call stack.

Fiber introduced two phases:

- **Render phase (async, interruptible)**: Walk fibers, compute effects, build the work-in-progress tree. Can be paused and resumed. Side effects (DOM mutations, lifecycle calls) are NOT performed here.
- **Commit phase (sync, uninterruptible)**: Apply the side effects list to the DOM. Runs in one shot to ensure UI consistency.

This two-phase design enabled **concurrent mode** (React 18) where urgent updates (typing in an input) can interrupt non-urgent ones (rendering a large list). The priority system uses 31 levels via `Scheduler.unstable_runWithPriority`.

Fiber also shipped `createPortal`, `componentDidCatch`, and `getDerivedStateFromProps`. The error boundaries were a direct consequence of the fiber architecture—fiber's ability to catch errors during reconciliation and pass them up the return-pointer chain made `componentDidCatch` possible in a way the old stack-based reconciler couldn't support.

Every React feature since v16—suspense, concurrent rendering, streaming SSR—is built on the fiber foundation. The recursive reconciler was elegant code. Fiber is production engineering.
