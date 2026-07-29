# Solid Signals vs React Hooks

SolidJS and React both aim to build reactive UIs, but their reactivity models diverge fundamentally. React uses hooks with immutable state and virtual DOM diffing. Solid uses signals with fine-grained reactivity and direct DOM updates. The difference affects performance, mental models, and component architecture. Getting comfortable with Solid after years of React requires unlearning some deeply ingrained habits.

## How React Hooks Work

React's `useState` and `useEffect` hooks rely on referential equality. When state changes, the entire component function re-runs, producing a new virtual DOM tree. React diffs it against the previous tree and patches real DOM nodes. This is simple conceptually but wasteful—a single state change can re-execute dozens of hooks in unrelated components.

```js
// React: every render re-executes ALL hooks in order
function Counter() {
  const [count, setCount] = useState(0);
  const [name, setName] = useState('Alice');

  // This effect runs on every render where count hasn't changed
  // because the component function re-ran
  useEffect(() => {
    document.title = `Count: ${count}`;
  }, [count]);

  // This ALSO re-runs its function on every render (useState and useRef
  // initializers run each time, they just discard the result)
  const square = useMemo(() => count * count, [count]);

  return (
    <div>
      <p>{count} squared is {square}</p>
      <p>Name: {name}</p>
    </div>
  );
}
```

The crucial point: when `setName('Bob')` is called, the entire `Counter` function re-runs. `useState(0)` re-executes (though it returns the current value, not 0). `useMemo` checks its dependency array. `useEffect` checks its dependency array. The virtual DOM for the entire `<div>` is re-created. React diffs it. Only the name text changes in the real DOM, but the mental overhead of figuring out what runs and why is significant.

React's dependency arrays are a workaround for the fact that the component function has no intrinsic knowledge of which values it depends on. The developer must manually specify dependencies. The ESLint plugin catches missing deps, but it can't catch over-specifying deps (including values that don't affect the effect).

## How Solid Signals Work

Solid's `createSignal` returns a getter-setter pair. When the setter updates the value, only effects that explicitly read that signal re-run. There's no re-execution of the entire component. Solid compiles JSX into direct DOM manipulation calls, so there's no virtual DOM at all:

```jsx
const [count, setCount] = createSignal(0);
createEffect(() => console.log(count()));
```

The `count()` call creates a subscription. When `setCount(5)` fires, only that effect re-runs. In React, the whole component would re-render.

```jsx
// Solid: only the specific effect for the changed signal re-runs
function Counter() {
  const [count, setCount] = createSignal(0);
  const [name, setName] = createSignal('Alice');

  // This effect only runs when count changes
  createEffect(() => {
    document.title = `Count: ${count()}`;
  });

  // This is NOT a createEffect - it's a derived signal
  // It only recomputes when count changes
  const square = () => count() * count();

  return (
    <div>
      <p>{count()} squared is {square()}</p>
      <p>Name: {name()}</p>
    </div>
  );
}
```

When `setName('Bob')` is called: nothing re-runs. The `name` signal changes, but nothing subscribes to it in this component (it's only read in the JSX, which Solid compiled into an effect that updates the DOM node). The `count`-dependent effects are untouched.

When `setCount(5)` is called: the title effect re-runs (one `console.log` + one `document.title` assignment). The `square` derived signal recomputes. The DOM text nodes for `count` and `square` update. Nothing else.

This is the "fine-grained" in fine-grained reactivity. Updates touch only what changed, not everything that could have changed.

## Memory Management and Ownership

One subtle but important difference is how Solid and React handle memory. React's hook state is stored in the fiber tree's `memoizedState` linked list. When a component unmounts, the fiber is garbage collected along with its hooks state.

Solid's signals are stored in the reactive system's dependency graph. If you create a signal in a component and that component unmounts, the signal persists unless it's disposed through Solid's root system:

```jsx
function Counter() {
  const [count, setCount] = createSignal(0);

  // The signal count is created in the current reactive root
  // When the component unmounts, the root disposes all signals

  onCleanup(() => {
    console.log('Signal count will be disposed');
  });

  return <div>{count()}</div>;
}
```

Solid uses `onCleanup` (called inside `createEffect`) or root disposal to clean up reactive nodes. If you create a signal outside a component (at module scope), it lives forever unless explicitly disposed.

```jsx
// Module-level signal: lives forever unless manually disposed
const globalState = createSignal(initial);

// Component-level signal: auto-disposed when component unmounts
function Component() {
  const [localState, setLocalState] = createSignal(initial);
}
```

React doesn't have this distinction. Hook state is always tied to the component instance. Module-level state in React requires `useRef`, `useState` at the component level, or external state management (Redux, Zustand).

## State Mutation: Immutable vs. Mutable

React's state is immutable. You can't do `state.count = 5`—you must call `setState({ ...state, count: 5 })`. This is fundamental to React's reconciliation: it detects changes by reference equality (`prevState !== newState`).

Solid's signals wrap mutable values. The state object inside a signal can be mutated, but the signal's setter notifies subscribers:

```jsx
// React: must create new reference
const [user, setUser] = useState({ name: 'Alice', age: 30 });
setUser({ ...user, age: 31 }); // new object

// Solid: can mutate, but must call setter to notify
const [user, setUser] = createSignal({ name: 'Alice', age: 30 });
setUser({ ...user(), age: 31 }); // new object (immutable style)
setUser((prev) => ({ ...prev, age: 31 })); // functional updater

// With createStore (Solid's proxy-based state):
const [state, setState] = createStore({ name: 'Alice', age: 30 });
setState('age', 31); // path-based immutable update
```

`createStore` provides a more ergonomic API for nested state. It wraps the object in a reactive proxy and tracks access at the property level:

```jsx
const [state, setState] = createStore({
  user: {
    profile: { name: 'Alice', preferences: { theme: 'dark' } }
  }
});

// This only triggers effects that specifically read state.user.profile.preferences.theme
setState('user', 'profile', 'preferences', 'theme', 'light');
```

React can't do this because it doesn't have proxy-based tracking. React's `useState` with nested objects requires spreading at every level, and even with Immer, the virtual DOM reconciliation is still O(render tree).

## Handling Side Effects

Both frameworks handle side effects, but the timing and semantics differ:

| Aspect | React useEffect | Solid createEffect |
|--------|----------------|-------------------|
| When it runs | After commit, deferred | Immediately, synchronously |
| Dependencies | Manual array | Automatic tracking |
| Cleanup | Return function | `onCleanup` callback |
| Timing | Browser paints first | Before paint |
| Stale closures | Common bug | Impossible |

Solid's `createEffect` runs synchronously after signal changes, before the browser paints. This is closer to `useLayoutEffect` in React. The effect has direct DOM references, so it can synchronously update the DOM before the browser renders.

React's `useEffect` runs after the browser paints. It's intentionally deferred to avoid blocking the visual update. This means users may see a frame with stale data before the effect runs. For most cases this is fine, but for DOM measurements and synchronization, it requires `useLayoutEffect`.

Solid's effects are also used differently. Since Solid has no component re-rendering, effects are the primary mechanism for reacting to state changes. In React, effects are for escaping from the render cycle (e.g., talking to the browser API, setting up subscriptions). In Solid, effects are the normal way to express "do something when this data changes."

## The Mental Model Shift

This difference demands a different mental model. React encourages thinking in render cycles. Solid encourages thinking in dependency graphs. React's hooks must be called in the same order on every render. Solid's signals have no such constraint—you can use them conditionally, in loops, or outside components.

```jsx
// Solid: signals can be created anywhere, anytime
function DynamicComponent() {
  let signal;
  if (Math.random() > 0.5) {
    signal = createSignal('heads');
  } else {
    signal = createSignal('tails');
  }
  // This is perfectly valid in Solid, wouldn't work in React
  return <div>{signal()[0]()}</div>;
}
```

This is possible because Solid's reactive graph is not order-dependent. Each signal is an independent node in the graph. Subscriptions are created when a signal's getter is called inside a tracking context (effect, memo, or JSX compilation), not when `createSignal` is called.

In React, the order of hook calls creates the state storage. Hook 1's state is at position 0, hook 2's at position 1, etc. Conditional hooks break this mapping.

## Performance Characteristics

Solid's approach wins in performance benchmarks consistently. But React's model is more forgiving for beginners and has a massive ecosystem. The choice depends on whether your priority is raw performance and predictability or ecosystem size and developer familiarity.

The JS Framework Benchmark (krausest/js-framework-benchmark) consistently shows Solid in the top tier for CPU-bound operations. React is typically in the middle tier. The gap widens as component count increases—Solid stays at ~1ms per update at 10,000 components while React climbs to 10-15ms.

But benchmarks measure synthetic workloads. In real applications, the difference is often imperceptible unless you're building something like a spreadsheet (hundreds of cells updating independently) or a real-time dashboard (dozens of values updating every second). For a typical CRUD app with occasional updates, the framework's reactivity model rarely matters for performance.

## Conclusion

Solid's approach wins in performance benchmarks consistently. But React's model is more forgiving for beginners and has a massive ecosystem. The choice depends on whether your priority is raw performance and predictability or ecosystem size and developer familiarity. I use React for client projects where ecosystem matters and Solid for personal projects where I want to minimize boilerplate and maximize performance. Both are excellent tools—they just optimize for different things.
