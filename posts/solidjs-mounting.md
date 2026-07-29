# SolidJS Without Virtual DOM

SolidJS achieves its performance reputation by compiling JSX into direct DOM manipulations, eliminating the virtual DOM entirely. Understanding how Solid mounts and updates the DOM reveals why it's fast and where its constraints lie. The architecture is radically different from React's, and appreciating that difference is key to using Solid effectively.

## The Compilation Step

When you write Solid JSX:

```jsx
<div>{count()}</div>
```

The compiler transforms this into:

```js
const el = document.createElement('div');
createComponent(() => {
  el.textContent = count();
});
```

The `createComponent` call wraps the textContent assignment in a reactive effect. When `count` changes, only that specific `textContent` assignment re-executes. No diffing, no reconciliation, no component re-render.

But this simplification hides the actual complexity. The Solid compiler (a Babel plugin called `babel-plugin-jsx-dom-expressions`) does much more. Let's look at what really happens for a more complex component:

```jsx
function UserCard(props) {
  return (
    <div class="user-card">
      <h2>{props.name()}</h2>
      <p class="email">{props.email()}</p>
      <p class="role">{props.role()}</p>
    </div>
  );
}
```

The compiler transforms this into something closer to:

```js
import { template, createComponent, insert, effect } from 'solid-js/web';

const _tmpl$ = template('<div class="user-card"><h2></h2><p class="email"></p><p class="role"></p></div>', 4);

function UserCard(props) {
  const _el$ = _tmpl$.cloneNode(true);
  const _el$2 = _el$.firstChild;
  const _el$3 = _el$2.nextSibling;
  const _el$4 = _el$3.nextSibling;

  insert(_el$2, () => props.name());
  insert(_el$3, () => props.email());
  insert(_el$4, () => props.role());

  return _el$;
}
```

Several things to notice:

1. **Template cloning.** The `template` function creates an HTML `<template>` element and parses the static HTML once. The `cloneNode(true)` call creates a deep clone of this template, which is much faster than `document.createElement` for each node. This is the same optimization libraries like Lit and Svelte use.

2. **Static vs. dynamic separation.** The compiler extracts the static HTML structure (the `<div>` with its children and static attributes like `class="user-card"`) into the template. Only the dynamic expressions (`props.name()`, `props.email()`, `props.role()`) are wrapped in `insert` calls.

3. **Direct DOM references.** The compiler computes the DOM node references at creation time (`_el$2`, `_el$3`, `_el$4`). Updates don't need to traverse the DOM or recompute selectors—they have direct references to the nodes they update.

This is fundamentally different from React's approach. React creates a virtual DOM tree (a JavaScript object tree) during render, diffs it against the previous tree, and then patches the real DOM. Solid skips the virtual tree entirely. The "diff" is implicit in the reactive system: if a signal didn't change, the effect that updates its corresponding DOM node doesn't re-run.

## Mounting: render vs. hydrate

Mounting works through `hydrate` or `render` functions. `render` creates a root reactive context, evaluates the component tree, and appends to the DOM. During mounting, Solid creates all real DOM nodes immediately—there's no virtual tree to reconcile.

```js
import { render } from 'solid-js/web';

render(() => <App />, document.getElementById('root'));
```

The `render` function does three things:

1. Creates a root reactive context (a "root" that manages signal disposal)
2. Calls the component function to produce the real DOM tree
3. Appends the DOM tree to the container

Step 2 is where Solid differs most from React. The component function runs synchronously and produces real DOM nodes. All effects registered during this execution are captured and linked to the root context. When a signal changes and triggers an effect, that effect has a direct reference to the specific DOM node it manages.

The trade-off is that initial mount creates every DOM node upfront, which for massive lists could be slower than virtual DOM streaming. Solid solves this with the `For` component, which uses a referential keyed strategy that only creates DOM for items that exist:

```jsx
// Lazy rendering with For - only creates DOM for visible items
<For each={items()}>
  {(item) => <ExpensiveRow data={item} />}
</For>
```

The `For` component creates DOM nodes only for items in the `items()` array. If you paginate your data, only one page's worth of DOM exists. Compare this to React, where even with pagination, the entire list's virtual DOM is created during render (though React's virtual DOM creation is cheaper than real DOM creation).

## Hydration: Resuming on the Client

For server-rendered Solid, the `hydrate` function attaches reactivity to existing server-generated DOM:

```js
import { hydrate } from 'solid-js/web';

hydrate(() => <App />, document.getElementById('root'));
```

Hydration in Solid is faster than React's hydration because Solid doesn't need to create virtual DOM for the entire tree and diff it. Instead, Solid walks the existing DOM, attaches event listeners, and wraps the dynamic expression points in effects. The template compiler marks dynamic nodes in the DOM with special attributes during SSR, so the hydration code knows exactly which nodes need reactive bindings.

```html
<!-- Server-rendered HTML with hydration markers -->
<div class="user-card">
  <h2>Alice</h2>
  <!--$-->
  <p class="email">alice@example.com</p>
  <!--/$-->
  <!--$-->
  <p class="role">Admin</p>
  <!--/$-->
</div>
```

The `<!--$-->` comments mark "hydration boundaries"—DOM nodes whose content is dynamic. Solid's hydrator skips static nodes entirely and only processes these boundaries, attaching effects that will update the content when signals change.

## The Reactive System: Dependency Graph

The key to Solid's fine-grained updates is the reactive system. Signals, memos, and effects form a dependency graph. When a signal's value changes, it notifies all effects that depend on it. Each effect holds direct references to the DOM nodes it manages. The update path is: signal → effect → DOM node. No intermediate abstractions.

Let's trace through what happens when a signal changes:

```jsx
const [count, setCount] = createSignal(0);

// Component creation
createEffect(() => {
  // Step 1: count() is read, creating a subscription
  // Step 2: The effect is registered as a subscriber of count
  el.textContent = count();
});

// Later, somewhere else:
setCount(5);
// Step 3: count's internal value changes to 5
// Step 4: count notifies all subscribers (the effect above)
// Step 5: The effect re-runs: count() returns 5
// Step 6: el.textContent = 5 — direct DOM update
```

Steps 3-6 happen in a single synchronous flush after `setCount`. The time between step 3 and step 6 is O(1)—no tree traversal, no diff, no reconciliation. This is why Solid benchmarks so well.

Solid's reactive system uses a "push-pull" strategy. When a signal changes, it pushes a "dirty" notification to its subscribers. But the subscribers don't immediately re-execute. Instead, they mark themselves as dirty and wait to be pulled. This happens during Solid's batch processing, which groups signal changes within the same microtask:

```js
// Batch: both setCount and setName trigger within the same batch
batch(() => {
  setCount(5);
  setName('Bob');
});
// Only one update cycle: both effects re-run, DOM updates coalesce
```

Without batching, each `setCount` call would trigger immediate DOM updates. With batching, Solid collects all signal changes and runs effects once after all changes are applied.

## Memoization: createMemo vs. React's useMemo

Solid's `createMemo` is more than just `useMemo` with automatic dependency tracking. It's a full reactive node that caches its value and only recomputes when dependencies change:

```jsx
const [items, setItems] = createSignal([]);
const [taxRate, setTaxRate] = createSignal(0.08);

const total = createMemo(() => {
  const subtotal = items().reduce((sum, item) => sum + item.price, 0);
  return subtotal + subtotal * taxRate();
});

// Reading total() returns the cached value
// Only recomputes when items or taxRate change
```

The key difference from React's `useMemo` is that Solid's `createMemo` is zero-cost to read when dependencies haven't changed. React's `useMemo` runs during every render (just doesn't recompute), but the render itself has overhead. Solid's `createMemo` doesn't participate in any render cycle—it's a standalone reactive node in the dependency graph.

## The Cost of No Virtual DOM

Solid's architecture isn't without trade-offs:

**No React DevTools equivalent.** Solid's DevTools exist but don't have the same level of detail as React's. The component tree isn't as easily inspectable because components don't "exist" as entities after creation—they're just functions that produced DOM nodes.

**Memory for DOM references.** Every dynamic expression holds a direct reference to its DOM node. For a list of 10,000 items, each with 5 dynamic expressions, that's 50,000 DOM node references in memory. React's virtual DOM has similar memory usage for its fiber tree, but the trade-offs are different.

**The compiler is a dependency.** Solid requires a Babel plugin for compilation. You can't use Solid without a build step (unlike preact or some React CDN builds). This is fine for most applications but limits use cases like in-browser code editors or REPLs.

**Third-party library compatibility.** React libraries that expect to manipulate virtual DOM (like animation libraries) don't work with Solid. You need Solid-specific wrappers or alternatives.

## Conclusion

This architecture means Solid components don't "re-run" like React components. The component function executes once during setup, registering effects that handle future updates. This is why Solid doesn't need hooks rules—there's no re-execution to keep consistent. No dependency arrays, no `useCallback`, no `React.memo`. The result is a framework that updates the DOM in O(change) rather than O(render-tree). For apps with frequent updates on large component trees, this difference is dramatic. Solid proves that the virtual DOM is an implementation detail, not a requirement for declarative UI.
