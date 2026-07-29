# React Fiber: The Architecture Behind Concurrent React

When React 16 shipped Fiber, the reconciliation engine was rewritten from the ground up. The old Stack reconciler was synchronous — once rendering started, it couldn't pause until the entire tree was committed. Fiber replaced that with an incremental, interruptible architecture that paved the way for Suspense, concurrent rendering, and transitions. Understanding Fiber is the key to understanding why React works the way it does today, and where it's heading next.

## The Problem with Stack Reconciliation

The old Stack reconciler was simple: walk the component tree recursively, collect DOM mutations, apply them all at once. The problem was that this was synchronous and uninterruptible. A render triggered by a `setState` call would block the main thread until the entire tree was processed. If you rendered a deep component tree (say, a 500-row data table with complex cells), the UI would freeze for hundreds of milliseconds. There was no way to say "pause this render, someone just typed in an input field."

```javascript
// Simplified Stack reconciler — synchronous and uninterruptible
function renderComponent(component) {
  const children = component.render();  // Can't pause here
  for (let child of children) {
    renderComponent(child);  // Recursive, blocks the call stack
  }
}
```

The call stack grew linearly with the tree depth, and there was no mechanism to save progress and resume later. This is what Fiber fundamentally changes.

## What is a Fiber?

A Fiber is a JavaScript object that represents a unit of work — a component instance plus its pending state updates, side effects, and position in the tree. Unlike the Stack reconciler's call-frame-based approach, fibers form a linked list that can be traversed incrementally:

```typescript
// Simplified Fiber node structure
interface Fiber {
  // Identity
  tag: WorkTag;  // FunctionComponent, ClassComponent, HostComponent, etc.
  type: any;     // The component class/function
  key: string | null;

  // Tree structure (linked list)
  child: Fiber | null;        // First child
  sibling: Fiber | null;      // Next sibling
  return: Fiber | null;       // Parent (called "return" because it's where you return after finishing)

  // State
  memoizedState: any;         // Hooks state or class instance state
  memoizedProps: any;
  pendingProps: any;

  // Effects
  updateQueue: UpdateQueue<any> | null;
  effectTag: SideEffectTag;   // Placement, Update, Deletion, etc.
  nextEffect: Fiber | null;   // Next fiber with side effect

  // Alternate (the "current" fiber on the other tree)
  alternate: Fiber | null;    // Allows double-buffering
}
```

The linked list structure (child, sibling, return) replaces the recursive traversal. Instead of the call stack tracking where we are in the tree, each fiber has explicit pointers to its children, next sibling, and parent. This means we can traverse the tree, pause mid-traversal, store the current fiber pointer, and resume later by following the links from where we left off.

## The Work Loop

Fiber's work loop drives the entire reconciliation process. It's a cooperative scheduling system that processes units of work (fibers) in small chunks, yielding control back to the browser between chunks:

```typescript
// Simplified version of the Fiber work loop
let nextUnitOfWork: Fiber | null = null;

function workLoop(deadline: IdleDeadline) {
  // Process fibers while we have time remaining
  while (nextUnitOfWork !== null && deadline.timeRemaining() > 1) {
    nextUnitOfWork = performUnitOfWork(nextUnitOfWork);
  }

  if (nextUnitOfWork === null) {
    // All work done — commit the changes to the DOM
    commitRoot();
  } else {
    // More work remains — schedule continuation
    requestIdleCallback(workLoop);
  }
}

function performUnitOfWork(fiber: Fiber): Fiber | null {
  // 1. Process this fiber: create child fibers, collect effects
  beginWork(fiber);

  // 2. Return the next fiber to process (child-first, depth-first)
  if (fiber.child !== null) return fiber.child;

  // No more children, move to siblings or backtrack to parent
  let next = fiber;
  while (next !== null) {
    completeUnitOfWork(next);
    if (next.sibling !== null) return next.sibling;
    next = next.return;  // Backtrack to parent
  }

  return null;  // All done
}
```

The `requestIdleCallback` API (or a polyfill using `MessageChannel` or `requestAnimationFrame` + `setTimeout`) gives Fiber a time budget. If the browser has pending input or paint work, the idle callback is delayed. If the `deadline.timeRemaining()` returns 0, Fiber yields and schedules continuation.

## The Two Phases: Render and Commit

Fiber splits the reconciliation work into two distinct phases:

**Render** (can be interrupted): Walk the fiber tree, compute differences between current and work-in-progress, collect side effects. This phase can be paused, resumed, or restarted. Multiple renders may begin and be abandoned.

**Commit** (cannot be interrupted): Apply collected side effects to the DOM. This runs synchronously because the user should never see an inconsistent UI.

```typescript
function commitRoot() {
  // Commit is synchronous — must not be interrupted
  const finishedWork = rootFiber.alternate;

  // 1. Before-mutation effects (getSnapshotBeforeUpdate)
  commitBeforeMutationEffects(finishedWork);

  // 2. DOM mutations — placements, updates, deletions
  commitMutationEffects(finishedWork);

  // 3. After-mutation effects (componentDidUpdate, useEffect cleanup)
  commitLayoutEffects(finishedWork);

  // 4. Schedule passive effects (useEffect callbacks)
  schedulePassiveEffects();
}
```

This separation is what makes concurrent features possible. React can start a render, get interrupted by a higher-priority update, abandon the first render, and start a fresh one — all without the DOM ever seeing an inconsistent state.

## Priority and Scheduling

Every update in Fiber has a priority level. React defines several lane priorities (in React 18, this is the "Lanes" model):

```typescript
// Conceptual priority levels (React 18+ uses binary lanes)
const SyncLane = 1;            // User interactions, layout effects
const InputContinuousLane = 2; // Continuous input (mouse move)
const DefaultLane = 4;         // Normal state updates
const IdleLane = 8;            // Low-priority background work

// Higher-priority updates interrupt lower-priority work
function scheduleUpdate(fiber, lane) {
  const root = getRootForFiber(fiber);
  markRootUpdated(root, lane);

  if (lane === SyncLane) {
    // Synchronous: run immediately, can't be interrupted
    performSyncWorkOnRoot(root);
  } else {
    // Concurrent: schedule with priority
    ensureRootIsScheduled(root);
  }
}
```

The lanes system uses a bitmask approach — multiple lanes can be active simultaneously, and the scheduler merges them. When you call `startTransition`, the enclosed state updates are assigned to a transition lane (lower priority). When you type in an input, the onChange handler gets a sync lane (higher priority). The scheduler always processes sync lanes first.

## Double Buffering

Fiber uses a double-buffering technique inspired by graphics rendering. There are two fiber trees:

- **current**: The tree that's currently committed to the DOM (the "visible" tree)
- **workInProgress**: The tree being built during the render phase (the "next" tree)

Each fiber has an `alternate` property pointing to its counterpart in the other tree. During rendering, Fiber clones current fibers into workInProgress, applying updates to the clone. This means the current tree is never mutated during rendering — it stays consistent for the user. When the render phase completes, the pointer flips: `root.current = root.current.alternate`. The old current tree becomes the new workInProgress tree for the next render.

```typescript
function cloneChildFibers(current: Fiber, workInProgress: Fiber) {
  // Current and workInProgress share the same structure
  // but workInProgress gets updated props and state
  let child = current.child;
  while (child !== null) {
    const newChild = createWorkInProgress(child, child.pendingProps);
    workInProgress.child = newChild;
    child = child.sibling;
  }
}
```

## Effects: Passive vs. Layout

Fiber introduced the distinction between passive effects (useEffect) and layout effects (useLayoutEffect):

- **Layout effects** (`useLayoutEffect`): Run synchronously after DOM mutations, before the browser paints. Use for reading layout and making visual measurements.
- **Passive effects** (`useEffect`): Run asynchronously after paint, scheduled via `requestIdleCallback` or `setTimeout(fn, 0)`. Use for subscriptions, data fetching, and non-urgent work.

Fiber tracks these with different `effectTag` values — `UpdateEffect` for passive, `UpdateLayoutEffect` for layout. During the commit phase, layout effects fire synchronously before paint, while passive effects are deferred.

## Error Boundaries and Suspense

Fiber's linked list structure made error boundaries practical. When a component throws during rendering, Fiber can catch the error, walk up the `return` chain to find the nearest error boundary, and switch to an error state — without corrupting the component state. Similarly, Suspense uses Fiber's interruptibility: when a component suspends (throws a promise), Fiber abandons the current render, shows the fallback, and retries the render when the promise resolves.

```typescript
function handleError(fiber: Fiber, error: Error) {
  // Walk up the return chain to find an error boundary
  let parent = fiber.return;
  while (parent !== null) {
    if (parent.tag === ClassComponent && isErrorBoundary(parent)) {
      // Found it — switch to error state
      parent.stateNode.componentDidCatch(error, errorInfo);
      return;
    }
    parent = parent.return;
  }
  // No error boundary found — throw globally
  throw error;
}
```

## The Impact on React Development

Fiber's architecture enabled everything modern React relies on. Concurrent rendering (React 18) lets the framework prioritize urgent updates. Suspense enables async data loading with fallback UI. Transitions keep the UI responsive during expensive re-renders. Server Components leverage Fiber's work loop for streaming server-rendered HTML incrementally.

You don't need to think about fibers when writing React components — that's the point of the abstraction. But when you're debugging performance issues, choosing between `useEffect` and `useLayoutEffect`, or wondering why `startTransition` makes the UI feel smoother, it helps to know that the answer lies in this architecture. Fiber isn't just a reconciler — it's a scheduling framework that treats UI rendering as a resource allocation problem, not a synchronous computation. That shift in perspective is what makes React capable of handling increasingly complex UIs without sacrificing responsiveness.
