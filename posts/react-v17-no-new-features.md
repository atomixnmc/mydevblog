# React v17: The "No New Features" Upgrade

React v17 was intentionally boring. The team promised "no new features" and delivered exactly that—no breaking changes for most apps, no developer-facing additions. But the upgrade mattered enormously for the platform. v17 was a **stepping stone** to v18's concurrent features, cleaning up internals that would have made the concurrent migration impossible if deferred.

The headline change was **gradual upgrades**. v17 allows you to embed multiple React versions on the same page. This was designed for large apps with independently-deployed micro-frontends or third-party widgets. Each React instance manages its own tree with its own event delegation:

```js
import { createRoot } from 'react-dom';

// v17 root - new API that isolates event delegation
const root1 = createRoot(document.getElementById('root1'));
root1.render(<App />);

// A different React version can coexist on the same page
const root2 = createRoot(document.getElementById('root2'));
root2.render(<LegacyWidget />);
```

**Event delegation changed**. React v16 delegated events to `document`. v17 delegates to the root DOM container (`createRoot`'s container). This matters for nested React trees, portal content, and third-party scripts that stop propagation on document-level events. If you had event handlers on `document` that relied on React events bubbling to document before a React listener fired, v17 broke that assumption.

```js
// v16: React listens on document
// v17: React listens on root container
// If you used this pattern, it no longer fires:
document.addEventListener('click', (e) => {
  // v16: fires after React's handler
  // v17: fires before React's handler (React is on container, not document)
});
```

**The upgrade path** was unusually smooth:
1. Replace `ReactDOM.render(<App />, container)` with `createRoot(container).render(<App />)`
2. Remove `event.persist()` calls—synthetic events no longer need to be retained (v17 removed the pooling optimisation that required it)
3. Update `useEffect` cleanup timing—effects now clean up asynchronously, mirroring v16.8 behaviour but codified in the release notes

The underlying changes—event delegation refactor, new JSX transform (`jsx()` instead of `React.createElement`, no import needed), native `Promise`-based scheduling primitives—were invisible to developers but critical for Fiber's evolution. v17's "boring" release was the quietest sign that React was maturing as a platform. The exciting stuff came 9 months later with v18's `startTransition` and concurrent rendering.
