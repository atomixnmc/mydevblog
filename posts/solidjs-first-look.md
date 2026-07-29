# SolidJS: First Impressions After Years with React

After six years writing React day-to-day, switching to SolidJS felt like visiting a parallel universe where all the API proposals that "couldn't be done" actually shipped. No virtual DOM. No re-rendering. Signals and effects by default. It's a framework that takes React's declarative model and removes the performance indirection layer.

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

**Key differences from React:**

- **No re-renders.** The component function runs exactly once. `console.log('render')` fires once per mount. Changes to `count()` only touch the `<p>` that displays it, not the parent or siblings.
- **Reading is tracking.** `count()` returns the current value. The signal dependency graph is built automatically—no dependency arrays (`[]`) to manage or forget.
- **No stale closures.** Since components don't re-run, closures don't stale. Event handlers and effects capture the signals, not values at render time.
- **Flow control is JSX.** `Show` and `For` components replace ternary expressions and `Array.map`. `<For each={items()}>{(item) => <li>{item.name}</li>}</For>`—no key props needed.

The reactivity model is closer to Knockout or Svelte than React. But Solid uses JSX, unidirectional data flow, and a hooks-like API, making it feel familiar while being dramatically more performant. The DevTools show individual DOM nodes updating rather than component subtrees re-rendering.

SolidJS isn't "React without the problems"—it's a different philosophy about what a UI framework should track. But for performance-sensitive UIs where React forces you into `useMemo` and `React.memo` everywhere, Solid's fine-grained reactivity is a revelation.

The ecosystem is smaller. Tooling is younger. But the core runtime is production-ready and impressively fast.
