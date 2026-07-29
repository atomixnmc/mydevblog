# React Fiber: The v16 Reconciler Rewrite

React v16 introduced Fiber—a complete rewrite of the reconciliation engine that changed React from a synchronous, stack-based renderer to an asynchronous, prioritized one. Most developers noticed only the new lifecycle methods and error boundaries, but Fiber was the foundation that made everything else possible. Understanding Fiber is the difference between being a React user and understanding React.

## The Problem with Stack-Based Reconciliation

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

The stack-based reconciler used the native call stack. When React encountered a component, it would recursively call `render()` on that component, then its children, then their children. The call stack grew as deep as the component tree. The problem is that the call stack is a LIFO (last-in, first-out) structure—you can't pause it mid-traversal and resume later. The entire tree had to be processed in one shot.

I worked on a dashboard app in 2015 that rendered a table of 10,000 financial instruments. Each row had 20 cells, each cell with conditional formatting, tooltips, and event handlers. The initial render took 400ms—long enough for the browser to show a "page unresponsive" warning. The old reconciler had no way to prioritize the visible viewport over offscreen rows. Everything was equal, and everything blocked until done.

## The Fiber Node Architecture

The key data structure is the **Fiber node**. Each fiber is a JavaScript object representing a component instance with pointers to its child, sibling, and return (parent). This linked-list tree enables walking the tree in any order—depth-first for commit, breadth-first for reconciliation—without the call stack.

```js
// Simplified Fiber node structure
function FiberNode(tag, pendingProps, key) {
  this.tag = tag;                // FunctionComponent, ClassComponent, HostComponent, etc.
  this.key = key;                // Key prop for list reconciliation
  this.elementType = null;       // The element type (div, MyComponent, etc.)
  this.type = null;              // Resolved type (after lazy resolution)

  // Tree structure pointers
  this.return = null;            // Parent fiber
  this.child = null;             // First child fiber
  this.sibling = null;           // Next sibling fiber

  // State
  this.memoizedState = null;     // Current state (for hooks: linked list of hook state)
  this.memoizedProps = null;     // Props from last render
  this.pendingProps = null;      // New props from current render

  // Effects
  this.effectTag = null;         // PLACEMENT, UPDATE, DELETION, etc.
  this.nextEffect = null;        // Next effect in the effect list
  this.firstEffect = null;       // First effect in this subtree
  this.lastEffect = null;        // Last effect in this subtree

  // Scheduling
  this.lanes = NoLanes;          // Priority lanes for scheduling
  this.childLanes = NoLanes;     // Lanes for child subtree
  this.alternate = null;         // The "work-in-progress" twin
}
```

The `alternate` pointer is the key to Fiber's dual-buffering approach. Each fiber has a "current" and "work-in-progress" version. React builds the work-in-progress tree by cloning fibers and computing new props. When the render phase completes, a single pointer swap makes the work-in-progress tree the new current tree. This is the "double buffering" pattern, similar to how graphics engines swap front and back buffers.

The linked-list structure (`return`, `child`, `sibling`) is what makes interruption possible. Instead of a call stack that can't be paused, React walks this explicit tree. At any node, React can check the frame budget (`deadline.timeRemaining()`) and yield by returning from the work loop. The `nextUnitOfWork` variable preserves the position for resumption.

## The Two-Phase Architecture

Fiber introduced two phases:

- **Render phase (async, interruptible)**: Walk fibers, compute effects, build the work-in-progress tree. Can be paused and resumed. Side effects (DOM mutations, lifecycle calls) are NOT performed here.
- **Commit phase (sync, uninterruptible)**: Apply the side effects list to the DOM. Runs in one shot to ensure UI consistency.

```
Timeline:
Render Phase (async, can be paused):
  [fiber 1] → [fiber 2] → [fiber 3] → [paused - no time] → [fiber 4] → [fiber 5] → done

Commit Phase (sync, single shot):
  [commitRoot] → apply effects → [done]
```

The render phase iterates through fibers in a depth-first, child-first traversal. At each fiber, React:

1. Calls `beginWork` to compute the fiber's children based on the new element type
2. If the fiber produces children, React assigns them to `fiber.child` and continues walking
3. If the fiber has no children, React looks at `fiber.sibling` instead
4. If neither child nor sibling exists, React pops up through `fiber.return` until it finds a sibling or reaches the root

This traversal is known as the "work loop." It's the heart of Fiber.

```js
// Conceptual beginWork
function beginWork(current, workInProgress, renderLanes) {
  switch (workInProgress.tag) {
    case FunctionComponent: {
      // Call the function component to get its children
      const children = workInProgress.type(workInProgress.pendingProps);
      // Reconcile children with current fiber's children
      reconcileChildren(current, workInProgress, children);
      return workInProgress.child;
    }
    case HostComponent: {
      // For DOM elements (div, span, etc.)
      const type = workInProgress.type;
      const props = workInProgress.pendingProps;
      // Create or reuse DOM element
      // Reconcile children
      reconcileChildren(current, workInProgress, props.children);
      return workInProgress.child;
    }
    case ClassComponent: {
      // Call the class component's render method
      const instance = workInProgress.stateNode;
      const children = instance.render();
      reconcileChildren(current, workInProgress, children);
      return workInProgress.child;
    }
  }
}
```

## Priority and Lanes

This two-phase design enabled **concurrent mode** (React 18) where urgent updates (typing in an input) can interrupt non-urgent ones (rendering a large list). The priority system uses 31 levels via `Scheduler.unstable_runWithPriority`.

React 18 replaced the simpler priority system with **lanes**—a bitmask-based approach for more granular scheduling:

```js
// Conceptual lane priorities
const NoLanes = 0b0000000000000000000000000000000;
const SyncLane = 0b0000000000000000000000000000001;
const InputContinuousLane = 0b0000000000000000000000000000010;
const DefaultLane = 0b0000000000000000000000000000100;
const TransitionLane = 0b0000000000000000000000000010000;
const IdleLane = 0b1000000000000000000000000000000;
```

Each state update is assigned a lane based on its source. `onChange` on an input field? That's `SyncLane`. `useTransition` wrapped setter? That's `TransitionLane`. The reconciler processes higher-lane work before lower-lane work. If a `SyncLane` update comes in while processing a `DefaultLane` update, React interrupts the lower-priority work, resolves the sync update, and then resumes.

This is how concurrent React prevents the "typing lag" problem. In React 17, typing into an input during a heavy render would be delayed until the render finished. In React 18, the input keystroke creates a `SyncLane` update that interrupts the heavy render.

## Error Boundaries and Portals

Fiber also shipped `createPortal`, `componentDidCatch`, and `getDerivedStateFromProps`. The error boundaries were a direct consequence of the fiber architecture—fiber's ability to catch errors during reconciliation and pass them up the return-pointer chain made `componentDidCatch` possible in a way the old stack-based reconciler couldn't support.

```jsx
class ErrorBoundary extends React.Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    logErrorToService(error, errorInfo.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return <h1>Something went wrong: {this.state.error.message}</h1>;
    }
    return this.props.children;
  }
}
```

Without Fiber, catching an error during reconciliation was nearly impossible. The recursive call stack would unwind completely, and there was no mechanism to intercept it. Fiber's return pointers (`fiber.return`) give React a structured way to walk up the tree and find the nearest error boundary.

Portals were similarly enabled by Fiber's tree structure. A portal's fiber is part of the React tree (for context propagation) but renders to a different DOM container (for the actual output). The old reconciler couldn't handle this because it assumed a 1:1 mapping between React components and DOM nodes.

## Concurrent Features Built on Fiber

Every React feature since v16—suspense, concurrent rendering, streaming SSR—is built on the fiber foundation.

**Suspense** uses Fiber's ability to "suspend" a component during rendering. When a component throws a promise (via `React.lazy` or data fetching in future versions), the fiber for that component is marked as suspended. React walks up the return chain to find the nearest `<Suspense>` boundary fiber. The boundary fiber's fallback content is rendered instead, and when the promise resolves, React schedules a new render that un-suspends the component.

```jsx
function ProfilePage() {
  return (
    <Suspense fallback={<Spinner />}>
      <ProfileContent />
    </Suspense>
  );
}
```

Under the hood, `ProfileContent` throws a promise during rendering. Fiber catches it, walks up to the `<Suspense>` boundary, and commits the `<Spinner />` fallback. When the promise resolves, Fiber re-renders `ProfileContent` and commits the actual profile UI.

**Streaming SSR** (`renderToPipeableStream`) works because Fiber can be rendered on the server in chunks. The server starts sending HTML while the tree is still being rendered. Suspense boundaries on the server produce "holes" in the HTML that get filled by streaming script tags. This was impossible with the old synchronous reconciler.

## The Cost of Fiber

Fiber isn't free. The linked-list architecture has memory overhead—each component instance has an associated fiber object that persists between renders. The reconciliation logic is significantly more complex than the recursive approach. The `Scheduler` module (responsible for priority-based scheduling) adds ~3KB to the bundle.

But the performance benefits far outweigh the costs. A React 17 app with a deeply nested tree of 10,000 components that previously caused 50ms frames now completes the same work in multiple chunks of 5ms each, staying well within the 16ms frame budget for 60fps.

## Conclusion

The recursive reconciler was elegant code. Fiber is production engineering. It's not simpler—it's more complex by design, because it has to handle real-world constraints like frame budgets, user interaction priorities, and network latency. Fiber doesn't make React faster in total work done—it makes React faster in perceived performance and responsiveness. And that's the metric that matters for user experience.
