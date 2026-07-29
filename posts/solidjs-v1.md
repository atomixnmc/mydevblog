# SolidJS 1.0: Reactive Without Virtual DOM

SolidJS 1.0, released in June 2021, brought a genuinely novel approach to UI reactivity: fine-grained reactivity without a virtual DOM. While React reconciles VDOM trees and Vue uses proxy-based reactivity, Solid compiles templates into direct DOM manipulations that update only what changed.

**The reactive system** is the heart of Solid. Signals (`createSignal`) are the primitive reactive cells: `const [count, setCount] = createSignal(0)`. When `setCount` updates the signal, any computation that read `count()` automatically re-executes. This is true push-based reactivity—no diffing, no dirty checking, no VDOM reconciliation. The tracking is synchronous, which means there's no stale closure problem and no useEffect dependency arrays.

**Compilation is key**: Solid's JSX compiler transforms templates into highly optimized DOM operations. `{count() > 5 ? <Big /> : <Small />}` compiles to a conditional that inserts or removes the exact DOM nodes for `<Big>` or `<Small>` when the signal crosses the threshold. No VDOM diffing, no component tree reconciliation. This compilation strategy means Solid apps are typically the smallest bundles among competing frameworks and often the fastest in rendering benchmarks.

**No re-rendering**: In Solid, components execute exactly once. There's no concept of re-rendering—when a signal changes, only the specific DOM nodes or derived computations that depend on that signal update. This eliminates entire categories of React bugs: no unnecessary re-renders, no `useCallback` or `useMemo` for performance, no `React.memo` wrapping. The mental model is simpler despite the reactive primitives being more fundamental.

**The ecosystem** is smaller than React's, but growing. Solid has official router, form library, and animation primitives. SolidStart (the meta-framework) offers file-based routing, server rendering, and streaming. Porting React components requires rewriting lifecycle logic into reactive primitives, but the results are consistently faster and more memory-efficient.

SolidJS proves that the virtual DOM was never necessary—just an engineering convenience that became orthodoxy. Its approach is closer to Knockout and MobX than React, and for applications where performance and bundle size matter, it's a compelling alternative.
