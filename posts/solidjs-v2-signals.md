# SolidJS Signals Deep Dive

SolidJS 2.0's signal system is a fine-grained reactivity model that updates only the exact DOM nodes affected by a change. No VDOM diffing, no component re-renders — just targeted DOM mutations.

## The Signal Contract

A signal is a getter/setter pair with automatic dependency tracking:

```typescript
import { createSignal } from 'solid-js';

const [count, setCount] = createSignal(0);

// Reading tracks the dependency
console.log(count());       // 0 — creates a subscription

// Writing triggers subscribers
setCount(prev => prev + 1); // triggers all tracked effects
```

The magic is in the tracking. When you call `count()` inside `createEffect` or within the JSX template, Solid captures that access as a dependency. When `setCount` fires, Solid knows exactly which effects depend on `count` and re-runs only those.

## The Implementation

Under the hood, each signal is a linked list of subscriber nodes:

```typescript
class Signal<T> {
  private value: T;
  private subscribers: Set<Computation> = new Set();

  get(): T {
    // If inside a computation, subscribe to it
    if (currentComputation) {
      this.subscribers.add(currentComputation);
      currentComputation.deps.add(this);
    }
    return this.value;
  }

  set(next: T): void {
    this.value = next;
    // Batch updates and notify
    batch(() => {
      for (const comp of this.subscribers) {
        comp.schedule();
      }
    });
  }
}
```

The `currentComputation` global tracks whatever effect or derived signal is currently executing. When a signal's getter runs during a computation, it registers the computation as a subscriber. When the signal's value changes, it marks all subscribers as dirty.

## Batching

Without batching, `setCount(1); setCount(2); setCount(3)` would trigger three effect re-runs. Solid batches synchronously — effects run once after the outermost batch completes:

```typescript
// Microtask batching default
setCount(1);  // schedules microtask
setCount(2);  // same microtask — coalesced
setCount(3);  // same microtask

// Explicit batch for synchronous control
batch(() => {
  setCount(1);
  setName('Alice'); // also batched
});
// Effects run once here
```

The default batching uses a microtask — all synchronous signal writes within one tick get batched into a single effect run. Explicit `batch()` is for cases where you need the batching window to close synchronously (e.g., reading DOM measurements after writes).

## Memos

`createMemo` is a read-only derived signal that caches its value and only recomputes when its dependencies change:

```typescript
const double = createMemo(() => count() * 2);
// double() returns cached value — no recomputation
// unless count() changed since last read
```

Memos implement lazy evaluation — the memo function runs only when the memo is read AND at least one dependency has changed. This is different from Vue's computed properties (eager eval on dependency change). Lazy eval avoids wasted computation for derived values that aren't used in the current render path.

## Resource

`createResource` wraps async data fetching in the signal model:

```typescript
const [userData] = createResource(() => userId(), fetchUser);
// <div>{userData()?.name}</div> — auto-updates when userId changes
```

Resources are signals that go through `loading` → `ready` (or `error`) states. They automatically cancel pending requests when the source signal changes and support Suspense integration. Under the hood, they track the promise lifecycle and convert it to synchronous signal updates — `userData()` returns `undefined` during loading, the resolved value after.

The key insight of Solid's signals is that dependency tracking happens at call time, not at declaration time. This is what makes it "fine-grained": the system knows exactly which nodes in the DOM tree depend on which signals. When `count` changes, Solid updates the specific `<span>` that renders `count()`, not the entire component subtree. In a complex form with 1000 fields, changing one input updates one DOM node — not the whole form component.