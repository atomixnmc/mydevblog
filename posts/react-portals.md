# React Portals

React portals provide a way to render children into a DOM node outside the parent component's DOM hierarchy. This solves layout problems where the parent's CSS context (overflow, z-index, clipping) interferes with the child's positioning needs.

The API is straightforward:

```jsx
ReactDOM.createPortal(children, domNode);
```

The portal renders `children` into `domNode`, which must exist in the DOM before rendering. The portal event propagation follows the React tree, not the DOM tree. A click in a portal bubbles up through the React component tree as if the portal content were a child in the React hierarchy — CSS stacking context and DOM tree position don't affect event handling.

Common use cases include modals, tooltips, dropdown menus, and toast notifications. A modal rendered as a child of a deeply nested component would be clipped by `overflow: hidden` on parent containers. By rendering through a portal into `document.body`, the modal escapes all CSS constraints while maintaining logical component structure.

Portals integrate naturally with React context. Context values flow through the React tree, not the DOM tree, so a portal child receives context from its React parent (where the portal was created), not from its DOM parent (where it's rendered). This is often what developers expect but can cause confusion initially.

For ref handling, portal children can receive refs normally. The ref points to the actual DOM element in the portal container. This enables imperative animations, measurements, and third-party library integration.

Accessibility requires care. Portal content should be announced correctly to screen readers. Focus management for modals (trap focus within the portal) and proper ARIA attributes are essential. Libraries like `react-focus-lock` and `@radix-ui/react-dialog` build on portals with accessibility baked in.

React 18's `createRoot` and concurrent rendering are fully compatible with portals. Portal content participates in the same Suspense boundaries and transition semantics as in-tree content.
