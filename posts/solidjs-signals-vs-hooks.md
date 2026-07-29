# Solid Signals vs React Hooks

SolidJS and React both aim to build reactive UIs, but their reactivity models diverge fundamentally. React uses hooks with immutable state and virtual DOM diffing. Solid uses signals with fine-grained reactivity and direct DOM updates. The difference affects performance, mental models, and component architecture.

React's `useState` and `useEffect` hooks rely on referential equality. When state changes, the entire component function re-runs, producing a new virtual DOM tree. React diffs it against the previous tree and patches real DOM nodes. This is simple conceptually but wasteful — a single state change can re-execute dozens of hooks in unrelated components.

Solid's `createSignal` returns a getter-setter pair. When the setter updates the value, only effects that explicitly read that signal re-run. There's no re-execution of the entire component. Solid compiles JSX into direct DOM manipulation calls, so there's no virtual DOM at all:

```jsx
const [count, setCount] = createSignal(0);
createEffect(() => console.log(count()));
```

The `count()` call creates a subscription. When `setCount(5)` fires, only that effect re-runs. In React, the whole component would re-render.

This difference demands a different mental model. React encourages thinking in render cycles. Solid encourages thinking in dependency graphs. React's hooks must be called in the same order on every render. Solid's signals have no such constraint — you can use them conditionally, in loops, or outside components.

Solid's approach wins in performance benchmarks consistently. But React's model is more forgiving for beginners and has a massive ecosystem. The choice depends on whether your priority is raw performance and predictability or ecosystem size and developer familiarity.
