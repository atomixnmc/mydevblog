# SolidJS Without Virtual DOM

SolidJS achieves its performance reputation by compiling JSX into direct DOM manipulations, eliminating the virtual DOM entirely. Understanding how Solid mounts and updates the DOM reveals why it's fast and where its constraints lie.

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

Mounting works through `hydrate` or `render` functions. `render` creates a root reactive context, evaluates the component tree, and appends to the DOM. During mounting, Solid creates all real DOM nodes immediately — there's no virtual tree to reconcile. The trade-off is that initial mount creates every DOM node upfront, which for massive lists could be slower than virtual DOM streaming. Solid solves this with the `For` component, which uses a referential keyed strategy that only creates DOM for items that exist.

The key to Solid's fine-grained updates is the reactive system. Signals, memos, and effects form a dependency graph. When a signal's value changes, it notifies all effects that depend on it. Each effect holds direct references to the DOM nodes it manages. The update path is: signal → effect → DOM node. No intermediate abstractions.

This architecture means Solid components don't "re-run" like React components. The component function executes once during setup, registering effects that handle future updates. This is why Solid doesn't need hooks rules — there's no re-execution to keep consistent.

The result is a framework that updates the DOM in O(change) rather than O(render-tree). For apps with frequent updates on large component trees, this difference is dramatic.
