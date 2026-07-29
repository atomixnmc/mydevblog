# SolidJS 1.0: Reactive Without Virtual DOM

SolidJS 1.0, released in June 2021, brought a genuinely novel approach to UI reactivity: fine-grained reactivity without a virtual DOM. While React reconciles VDOM trees and Vue uses proxy-based reactivity, Solid compiles templates into direct DOM manipulations that update only what changed. I remember downloading the 1.0 release candidate on a Friday evening, expecting to play with another React-like framework. By Sunday, I had rewritten a small production app in Solid and was questioning every assumption I had about frontend architecture.

## The Reactive System: Signals as the Primitive

The reactive system is the heart of Solid. Signals (`createSignal`) are the primitive reactive cells: `const [count, setCount] = createSignal(0)`. When `setCount` updates the signal, any computation that read `count()` automatically re-executes. This is true push-based reactivity — no diffing, no dirty checking, no VDOM reconciliation. The tracking is synchronous, which means there's no stale closure problem and no `useEffect` dependency arrays.

For anyone coming from React, this immediacy is disorienting at first. In React, `useState` returns the current value and a setter that schedules a re-render. The value doesn't change until the component re-renders, which happens in the next microtask. In Solid, `count()` returns the current value, and `setCount()` updates it synchronously. Any effect that reads `count()` fires immediately. This means the timing of your code matters in ways it doesn't in React — but it also means no stale closures, no outdated callbacks in event handlers, no "I captured an old value in a closure" bugs.

```tsx
// React — stale closure problem
function Counter() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => {
      setCount(count + 1); // Bug: count is always 0 (stale closure)
    }, 1000);
    return () => clearInterval(timer);
  }, []); // Empty deps array — closure captures initial count
  return <div>{count}</div>;
}

// Solid — no stale closures, synchronous signals
function Counter() {
  const [count, setCount] = createSignal(0);
  createEffect(() => {
    const timer = setInterval(() => {
      setCount(count() + 1); // count() reads the current value, always fresh
    }, 1000);
    onCleanup(() => clearInterval(timer));
  }); // No deps array needed — Solid auto-tracks
  return <div>{count()}</div>;
}
```

The `createEffect` in Solid tracks dependencies automatically. Any signal read inside the effect function gets registered as a dependency. When that signal changes, the effect re-runs. No dependency arrays, no `useCallback`, no `useMemo`. The tradeoff is that the tracking happens synchronously during execution — you can't conditionally depend on different signals based on runtime values (well, you can, but the behavior changes based on which branch actually executes).

## Compilation: Where the Magic Happens

Compilation is key: Solid's JSX compiler transforms templates into highly optimized DOM operations. `{count() > 5 ? <Big /> : <Small />}` compiles to a conditional that inserts or removes the exact DOM nodes for `<Big>` or `<Small>` when the signal crosses the threshold. No VDOM diffing, no component tree reconciliation.

The compiler's output is remarkable to look at. Instead of generating JSX that creates a VDOM tree, Solid generates code that directly calls `document.createElement`, `textContent`, `appendChild`, and `removeChild`. The conditional above compiles to something like:

```javascript
// Simplified output of Solid's compiler for: {count() > 5 ? <Big /> : <Small />}
let _el, _cmp;
createEffect(() => {
  if (count() > 5) {
    if (!_cmp || _cmp !== "Big") {
      _cmp = "Big";
      _el?.replaceWith(bigEl = createComponent(Big));
      _el = bigEl;
    }
  } else {
    if (!_cmp || _cmp !== "Small") {
      _cmp = "Small";
      _el?.replaceWith(smallEl = createComponent(Small));
      _el = smallEl;
    }
  }
});
```

This compilation strategy means Solid apps are typically the smallest bundles among competing frameworks and often the fastest in rendering benchmarks. The JSX compiler strips all runtime overhead during build time. What ships to the browser is imperative DOM manipulation code, not a framework runtime that interprets component trees. In the JS Framework Benchmark, Solid consistently outperforms React, Vue, Svelte, and Angular on memory allocation and time-to-interactive metrics.

## No Re-Rendering — A Fundamental Shift

In Solid, components execute exactly once. There's no concept of re-rendering — when a signal changes, only the specific DOM nodes or derived computations that depend on that signal update. This eliminates entire categories of React bugs: no unnecessary re-renders, no `useCallback` or `useMemo` for performance, no `React.memo` wrapping. The mental model is simpler despite the reactive primitives being more fundamental.

The practical consequence is that performance optimization in Solid is opt-out rather than opt-in. In React, you wrap components in `React.memo`, memoize callbacks, and carefully structure your state to prevent cascading re-renders. In Solid, you just write components. A list with 10,000 items, where each item has its own signal? Only the item whose signal changed updates. The other 9,999 items don't even check. There's no diff to run, no tree to reconcile.

```tsx
// React — you need to optimize to prevent unnecessary work
const ExpensiveItem = React.memo(({ item, onToggle }) => {
  return <div onClick={() => onToggle(item.id)}>{item.name}</div>;
});
function List({ items }) {
  const [selected, setSelected] = useState(null);
  return items.map(item =>
    <ExpensiveItem key={item.id} item={item} onToggle={() => setSelected(item.id)} />
  );
}

// Solid — no optimization needed, granular updates by default
function List(props) {
  const [selected, setSelected] = createSignal(null);
  return <For each={props.items}>{(item) =>
    <div onClick={() => setSelected(item.id)}>{item.name}</div>
  }</For>;
}
```

The `For` component in Solid is a keyed iteration primitive that only inserts, moves, or removes DOM nodes when the array changes. Individual array items are not re-rendered unless their underlying data changes. It's the equivalent of a perfectly-memoized React list, but it's the default behavior, not an optimization you have to opt into.

## Reactive Primitives Beyond Signals

Solid's reactivity system includes more than just signals. `createMemo` creates derived values that only recompute when their dependencies change. `createResource` handles async data fetching with built-in Suspense integration. `createStore` provides deep reactive objects for complex state trees. Each primitive is composable — a memo derived from signals, a resource derived from a memo, a component that reads the resource.

The store system deserves special mention. React's `useReducer` requires you to return a new state object on every dispatch. Solid's `createStore` tracks changes at the property level:

```tsx
const [state, setState] = createStore({
  user: { name: "Alice", preferences: { theme: "dark" } }
});

// This only updates the theme property
setState("user", "preferences", "theme", "light");
// Only DOM nodes reading state.user.preferences.theme will update
// Nothing else in the component tree is affected
```

This granularity is impossible in React without manually splitting state into multiple `useState` or `useReducer` calls. In Solid, the store is a single reactive object, and updates target specific paths. The DOM nodes that read `state.user.name` don't update when `state.user.preferences.theme` changes. This is the fine-grained promise delivered.

## Ecosystem and Production Readiness

The ecosystem is smaller than React's, but growing. Solid has an official router, form library, and animation primitives. SolidStart — the meta-framework — offers file-based routing, server rendering, and streaming. Porting React components requires rewriting lifecycle logic into reactive primitives, but the results are consistently faster and more memory-efficient.

The ecosystem gap is real, though. If you need a rich text editor, a data grid, a charting library, or a drag-and-drop system, you'll likely find a Solid port that works or a vanilla JS library you can wrap. But you won't find the same depth of React-specific components. The community is enthusiastic and productive, but small. PRs get reviewed quickly, and the core team is responsive, but there are fewer blog posts, fewer Stack Overflow answers, fewer tutorials for edge cases.

I've been using Solid in production for two years now, across three applications. The developer experience is genuinely better than React for the things Solid is good at. The compile-time error messages are clear, the reactivity model is consistent, and the performance is best-in-class. But I wouldn't recommend it for every project. If your team is new to reactive programming, or if you depend heavily on React-specific libraries, the learning curve and ecosystem friction will slow you down.

SolidJS proves that the virtual DOM was never necessary — just an engineering convenience that became orthodoxy. Its approach is closer to Knockout and MobX than React, and for applications where performance and bundle size matter, it's a compelling alternative. The 1.0 release was a watershed moment — not because it threatened React's dominance, but because it showed that there was another path, one that had been hiding in plain sight all along.

## Performance Benchmarks: SolidJS vs. React in Practice

Benchmarks are always contentious, but the JS Framework Benchmark data tells a consistent story. SolidJS consistently scores lowest in memory allocation (less GC pressure), fastest in DOM manipulation time, and smallest in bundle size. React is 2-5x slower in synthetic benchmarks like creating 10,000 rows, updating individual cells, and clearing the table. These synthetic benchmarks map to real scenarios: financial dashboards, real-time monitoring tools, and data-heavy admin panels.

I ran my own benchmarks on a real production app I maintain — an inventory management dashboard with ~5,000 rows of data, real-time updates via WebSocket, and inline editing. The React version had a baseline bundle of 142KB (gzipped), a time-to-interactive of 2.1 seconds, and occasional jank during bulk updates. I ported the same app to SolidJS: bundle dropped to 38KB (gzipped), time-to-interactive dropped to 0.8 seconds, and the bulk updates were imperceptible. The porting process took about a week, mostly rewriting lifecycle logic and state management.

What surprised me was the memory usage. The React version allocated about 8MB of DOM nodes during peak usage (large table renders). The Solid version allocated 3.2MB for the same view. Less DOM allocation means less GC pressure, which means fewer frame drops. For an app that runs all day in a browser tab, that memory efficiency translates to a noticeably smoother experience by hour six.

## Error Handling and Edge Cases

Solid's error handling has sharp edges that took me a while to understand. In React, an error in a component's render breaks only that component tree. In Solid, an error in a reactive computation can cascade unpredictably because computations are interleaved. If a signal's value is used in ten different effects, and one of those effects throws, the other nine are unaffected — which is good — but the thrown effect might leave the DOM in an inconsistent state. The solution is to wrap error-prone computations in Solid's `catchError` boundary, similar to React's `ErrorBoundary`.

Another edge case is conditional tracking. Solid's reactive system tracks dependencies during execution. If you have a conditional inside an effect:

```tsx
createEffect(() => {
  if (someCondition()) {
    console.log(signalA()); // tracked only when someCondition is true
  } else {
    console.log(signalB()); // tracked only when someCondition is false
  }
});
```

The effect tracks different signals depending on the branch that executes. If `signalA` changes while `someCondition` is false, the effect won't re-run. This is technically correct — the effect only reads `signalA` when the condition is true — but it's surprising if you're used to React's "the whole effect re-runs whenever any dependency changes" model. The fix is to read all signals unconditionally at the top of the effect, even if you don't use them in every branch.

## The SolidJS Learning Curve

I'll be honest: SolidJS is harder to learn than React if you're coming from an imperative background. React's mental model — "components are functions that return UI, re-run on state changes" — is intuitive. Solid's mental model — "components are factory functions that execute once, setting up reactive subscriptions between signals and DOM nodes" — requires understanding reactive programming concepts.

But here's the thing: once that mental model clicks, it's simpler than React. You don't need to think about re-renders, memoization, or dependency arrays because those concepts simply don't exist. Every React performance optimization you've ever learned becomes irrelevant. The learning curve is front-loaded but the payoff is a dramatically simpler development experience for anything beyond trivial apps.

## Should You Switch?

The honest answer: probably not, unless you have a specific pain point that React can't solve. If your React app is fast enough, your team is productive, and your users are happy, switching frameworks offers minimal upside with massive migration cost. SolidJS is worth evaluating for new projects where performance is critical — real-time data, large lists, frequent updates — or for teams exploring reactive programming patterns. It's also a fantastic learning tool to understand what fine-grained reactivity feels like.

SolidJS isn't a React killer. It's a reminder that even dominant technologies can be improved upon, and that the virtual DOM — like jQuery before it — was a stepping stone, not a destination. The 1.0 release proved that fine-grained reactivity could be ergonomic, fast, and production-ready. Three years later, the framework has only gotten better.
