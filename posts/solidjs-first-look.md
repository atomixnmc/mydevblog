# SolidJS: First Impressions After Years with React

After six years writing React day-to-day, switching to SolidJS felt like visiting a parallel universe where all the API proposals that "couldn't be done" actually shipped. No virtual DOM. No re-rendering. Signals and effects by default. It's a framework that takes React's declarative model and removes the performance indirection layer.

## The Moment It Clicked

I remember the exact moment Solid "clicked" for me. I was building a stock ticker dashboard—a React component that updates 50 prices every 500ms via websocket. In React, every price update meant the entire dashboard component re-rendered. I had `React.memo` wrappers everywhere, memoized selectors, and a carefully tuned `shouldComponentUpdate` equivalent. The DevTools still showed 200+ component re-renders per update.

I ported the same component to Solid. The component function ran once. Each price tick updated exactly one text node—`el.textContent = newPrice`. The DevTools showed one DOM update. Not one component re-render. One DOM update. That's when I understood: Solid's fine-grained reactivity wasn't just an optimization—it was a fundamentally different model.

## The Signal Primitive

Solid's core primitive is the **signal**—a reactive value with getter/setter semantics. Components run once (no re-render). When a signal changes, only the DOM nodes that depend on it update. This is fundamentally different from React, where calling `setState` re-runs the entire component function.

```jsx
import { createSignal, createEffect } from 'solid-js';

function Counter() {
  const [count, setCount] = createSignal(0);
  const doubled = () => count() * 2; // Derived signal, auto-tracked

  // Effect runs when count changes, not on every render
  createEffect(() => {
    console.log(`Count is now ${count()}`);
  });

  return (
    <div>
      <p>Count: {count()}</p>        {/* Fine-grained DOM update */}
      <p>Doubled: {doubled()}</p>     {/* Only this <p> updates */}
      <button onClick={() => setCount(c => c + 1)}>+1</button>
    </div>
  );
}
```

Notice that `createSignal` returns a getter function, not a value. `count()` reads the current value. This is crucial: Solid's reactivity is based on function calls, not property access. The getter is a subscription point. When `createEffect` calls `count()` during its execution, Solid records that this effect depends on the `count` signal. When `setCount(5)` is called, Solid re-runs only those effects that read `count()`.

This is called "push-pull" reactivity. The signal pushes a "dirty" notification to its subscribers, but they don't re-execute until they're actually read (pulled). This prevents wasted computation—an effect only runs if its output is actually observed.

## Key Differences from React

**No re-renders.** The component function runs exactly once. `console.log('render')` fires once per mount. Changes to `count()` only touch the `<p>` that displays it, not the parent or siblings. This eliminates an entire category of performance optimization.

```jsx
function ExpensiveList() {
  const [items, setItems] = createSignal([]);

  // This runs ONCE
  console.log('Component created');

  return (
    <For each={items()}>
      {(item) => <ListItem name={item.name} />}
    </For>
  );
}
```

In React, every `setItems` call would re-run the entire `ExpensiveList` function, re-creating all the `ListItem` virtual DOM elements. In Solid, `ExpensiveList` runs once, and only the DOM nodes inside the `<For>` loop update when items change.

**Reading is tracking.** `count()` returns the current value. The signal dependency graph is built automatically—no dependency arrays (`[]`) to manage or forget.

This is the biggest win over React hooks. React's `useEffect` requires you to manually list dependencies. Get it wrong, and you have stale closures. Solid's `createEffect` automatically tracks which signals are read during execution:

```jsx
createEffect(() => {
  // Solid automatically tracks every signal read here
  console.log(`User ${user().name} has ${items().length} items`);
  // Dependencies: user, items — automatically detected
});
```

If you read `user()` and `items()` inside the effect, Solid knows the effect depends on both. No dependency arrays, no `eslint-plugin-react-hooks`, no stale closure bugs.

**No stale closures.** Since components don't re-run, closures don't stale. Event handlers and effects capture the signals, not values at render time.

```jsx
function Timer() {
  const [count, setCount] = createSignal(0);

  // In React, this would need useCallback to avoid stale closure
  const handleClick = () => {
    setTimeout(() => {
      // count() reads the CURRENT value, not a captured one
      alert(`Count is ${count()}`);
    }, 1000);
  };

  return (
    <div>
      <span>{count()}</span>
      <button onClick={handleClick}>Check count in 1s</button>
    </div>
  );
}
```

In React, `handleClick` would capture `count` at render time. If set to 5 and then incremented to 10 before the timeout fires, the alert would show 5 (stale). In Solid, `count()` reads the signal's current value when called, so the alert always shows the latest value.

## Reactive Primitives Beyond Signals

Solid provides several derived primitives built on top of signals:

**createMemo** creates a derived value that only recomputes when its dependencies change. It's like `useMemo` in React, but it doesn't need dependency arrays and it batches updates lazily:

```jsx
const [items, setItems] = createSignal([]);
const totalPrice = createMemo(() => {
  return items().reduce((sum, item) => sum + item.price * item.quantity, 0);
}, 0);

// totalPrice only recomputes when items change
// Multiple reads of totalPrice without items changing = single recomputation
```

**createResource** handles async data fetching with built-in loading and error states:

```jsx
const [userId, setUserId] = createSignal(1);
const [user] = createResource(userId, async (id) => {
  const res = await fetch(`/api/users/${id}`);
  return res.json();
});

// user() returns { loading: true/false, data: {...}, error: null }
return (
  <Show when={user()} fallback={<Spinner />}>
    <p>{user().name}</p>
  </Show>
);
```

**createStore** provides deeply reactive objects with path-level subscriptions:

```jsx
const [state, setState] = createStore({
  user: { name: 'Alice', preferences: { theme: 'dark' } }
});

// This only triggers effects that read state.user.preferences.theme
setState('user', 'preferences', 'theme', 'light');
```

## The Control Flow Components

Solid replaces JavaScript control flow (`Array.map`, ternary expressions) with dedicated components that integrate with the reactive system:

```jsx
// Solid's Show (replaces ternary)
<Show when={loggedIn()} fallback={<LoginButton />}>
  <UserProfile />
</Show>

// Solid's For (replaces Array.map)
<For each={items()}>
  {(item, index) => <li>{index()}: {item.name}</li>}
</For>

// Solid's Switch/Match (replaces switch statement)
<Switch>
  <Match when={status() === 'loading'}>
    <Spinner />
  </Match>
  <Match when={status() === 'error'}>
    <ErrorMessage />
  </Match>
  <Match when={status() === 'success'}>
    <DataView />
  </Match>
</Switch>
```

These components are necessary because JavaScript's native control flow doesn't track reactive dependencies. `Array.map` creates an array once and never updates it. `<For each={items()}>` watches the `items()` signal and updates the DOM when items are added, removed, or reordered.

The `For` component uses referential identity for keys. It compares old and new arrays using reference equality. This means Solid doesn't need explicit `key` props—it uses the item reference itself as the key. For primitive values (strings, numbers), you may need `===` equality, but for objects, referential equality is the default.

## The Ecosystem Reality

SolidJS isn't "React without the problems"—it's a different philosophy about what a UI framework should track. But for performance-sensitive UIs where React forces you into `useMemo` and `React.memo` everywhere, Solid's fine-grained reactivity is a revelation.

The ecosystem is smaller. Tooling is younger. But the core runtime is production-ready and impressively fast.

I'll be honest: Solid's ecosystem is where the friction lives. The routing library (Solid Router) is excellent but has fewer features than React Router. State management is mostly unnecessary (signals cover most needs), but when you need it, the options are fewer. UI component libraries are sparse compared to React's ecosystem.

But the core experience—writing components that are faster than equivalent React code with less mental overhead—makes Solid compelling for performance-critical UIs. For a new project where performance matters and you control the stack choices, Solid deserves serious consideration.

## When to Use Solid (and When Not To)

Solid excels in apps with high-frequency updates: real-time dashboards, stock tickers, collaborative editing, animation-heavy interfaces, and data visualization. It also shines in constrained environments like mobile web where React's virtual DOM overhead makes a difference.

Solid struggles when you need deep ecosystem integrations. If your project depends on React-specific libraries (React DnD, React Spring's full feature set, React Three Fiber), Solid compatibility layers exist but add friction. For content-heavy sites with infrequent updates (blogs, documentation), React's virtual DOM overhead is negligible, and the ecosystem advantage swings the choice toward React.

The reactivity model is closer to Knockout or Svelte than React. But Solid uses JSX, unidirectional data flow, and a hooks-like API, making it feel familiar while being dramatically more performant. The DevTools show individual DOM nodes updating rather than component subtrees re-rendering.
