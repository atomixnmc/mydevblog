# React Reconciliation: How the Virtual DOM Diff Works

React's reconciliation algorithm is often described as "the virtual DOM diff," but that undersells it. It's not a generic tree-diff (O(n³) in the general case) but a heuristic algorithm that makes two assumptions to achieve O(n): components of different types produce different trees, and keys identify stable elements across renders.

## The Two Fundamental Assumptions

The theoretical minimum complexity for diffing two trees without assumptions is O(n³)—where n is the number of nodes. This is because you'd need to consider every possible mapping between old and new nodes. For a tree with 1000 elements, that's 1 billion operations. Unacceptable for UI rendering at 60fps.

React's heuristic makes two assumptions that reduce this to O(n):

1. **Different element types produce different trees.** If `<div>` becomes `<span>`, React assumes the entire subtree is different and rebuilds from scratch. This is usually correct—you rarely transform a div into a span while preserving children.

2. **Keys identify stable elements.** When comparing children lists, React uses `key` props to match old and new children. Without keys, React falls back to index-based matching, which breaks when lists are reordered.

These assumptions are wrong in edge cases, but they're right nearly all the time in practice. That's the trade-off: near-perfect O(n) matching instead of perfect O(n³).

## Tree Comparison at the Root

The reconciliation process starts at the root. When comparing two trees, React walks both simultaneously. A type mismatch (`<div>` vs `<span>`, `ComponentA` vs `ComponentB`) triggers a full rebuild—React tears down the old subtree and mounts a new one. This is why changing a component's root element type is expensive.

```jsx
// Bad: type change tears down and rebuilds
return isMobile ? <MobileNav /> : <DesktopNav />;

// Good: same type, different props
return <Nav variant={isMobile ? 'mobile' : 'desktop'} />;
```

I learned this lesson the hard way on a project where we conditionally rendered either a `TableView` or a `GridView` based on user preference. Both components rendered the same data but had different root elements. Every toggle between views caused a full unmount and remount—losing scroll position, selection state, and cached images. The fix was to give both components the same root type (`<div>`) and use CSS grid to switch layouts without triggering reconciliation.

The type comparison extends to custom components too. If you render `<UserProfile>` in one render and `<AdminProfile>` in the next, React destroys the entire `UserProfile` instance—including all its local state, refs, and effects. The new `AdminProfile` starts fresh. This is correct behavior: different component types likely represent different entities.

```jsx
function Profile({ user }) {
  // BAD: type changes based on condition
  return user.role === 'admin' ? <AdminProfile user={user} /> : <UserProfile user={user} />;

  // GOOD: same component type, different props
  return <ProfileBase user={user} variant={user.role === 'admin' ? 'admin' : 'user'} />;
}
```

## Position-Based Reconciliation

For children of the same type, React reconciles by position. Without keys, it compares the first child of the old tree with the first child of the new tree. If you reorder a list, every element's rendered output differs from its old counterpart, causing full re-renders of the entire list.

```jsx
// Without keys: list reorder = O(n) re-renders
items.map(item => <li>{item.name}</li>);

// With keys: React moves DOM nodes instead of recreating them
items.map(item => <li key={item.id}>{item.name}</li>);
```

Without keys, React compares position 0's old content with position 0's new content. Since the items shifted, every comparison fails, and React updates every DOM node. The DOM itself doesn't get fully rebuilt (React reuses the same DOM elements), but the text content of each `<li>` changes. For a list of 1000 items where one item was added at index 0, that's 1000 textContent updates instead of 1 insertion + 999 no-ops.

With stable keys, React recognizes that key "42" was at position 0 and is now at position 1. It moves the DOM node instead of updating its content. The new item at position 0 gets a new DOM node. The other 999 nodes are left untouched.

## Keys: The Most Misunderstood Prop

Keys should be stable, unique, and predictable. The index from `Array.map` is an anti-pattern for dynamic lists—inserting an item at index 0 shifts all old keys, forcing React to reconcile everything. Use the entity's database ID or a generated UUID.

```jsx
// Anti-pattern: index as key
{todos.map((todo, index) => (
  <TodoItem key={index} todo={todo} />
))}

// Correct: unique ID as key
{todos.map((todo) => (
  <TodoItem key={todo.id} todo={todo} />
))}
```

Wait, is index-as-key always bad? No. It's acceptable when:

- The list is static (items are never added, removed, or reordered)
- The list items have no local state (no uncontrolled inputs, no state derived from position)
- You understand the trade-off and accept it

But even for static lists, index-as-key can cause subtle bugs. Consider a list of input fields:

```jsx
function EditableList() {
  const [items, setItems] = useState(['a', 'b', 'c']);

  return (
    <ul>
      {items.map((item, index) => (
        <li key={index}>
          <input defaultValue={item} /> {/* BUG: if items shift, input values shift */}
        </li>
      ))}
    </ul>
  );
}
```

If 'b' is removed, the input that was displaying 'c' now displays 'b' in its defaultValue, but the user might have typed something in the third input. Position-based reconciliation means React reuses the third input DOM node (because the key matches by position), but the defaultValue is now wrong. With `key={item.id}`, React would destroy the third input and create a new one for 'c', losing any user input in that field.

## The Render Phase: Building the Effect List

When reconciliation identifies a difference, it doesn't immediately mutate the DOM. Instead, it builds an **effect list**—a linked list of side effects scheduled during the render phase.

```
Fiber Tree (simplified):
  App → Nav → [Li(0), Li(1), Li(2)]
                   ↓          ↓          ↓
                  Effect:  Effect:   Effect:
                  UPDATE   UPDATE   INSERT
```

Each fiber node can have side effects: placement (insert into DOM), update (change props/text), deletion (remove from DOM), or ref attachment. These effects are collected into a singly-linked list during reconciliation.

The effect list is a clever optimization. During the render phase, React walks the fiber tree and appends to the effect list. The commit phase simply walks this list—no tree traversal needed. This separates the work of "figuring out what changed" from "applying the changes."

## The Commit Phase: Atomic DOM Mutations

The **commit phase** applies the effect list. React walks the fiber tree's effect list (a linked list of side effects—insert, update, delete) and applies them to the DOM. This is synchronous: no interruptions, no yielding. The effect list is built during the render phase and consumed atomically.

Why must the commit phase be synchronous? Because the DOM must be in a consistent state between renders. If React paused during commit, the user would see a half-updated UI—some DOM mutations applied, others pending. This would lead to visual glitches and layout inconsistencies.

```js
// Conceptual commit phase
function commitRoot(rootFiber) {
  let nextEffect = rootFiber.firstEffect;
  while (nextEffect !== null) {
    switch (nextEffect.effectTag) {
      case 'PLACEMENT':
        // Insert DOM node
        parentNode.appendChild(nextEffect.stateNode);
        break;
      case 'UPDATE':
        // Update DOM node properties
        commitUpdate(nextEffect.stateNode, nextEffect.memoizedProps);
        break;
      case 'DELETION':
        // Remove DOM node
        parentNode.removeChild(nextEffect.stateNode);
        break;
    }
    nextEffect = nextEffect.nextEffect;
  }
}
```

The commit phase is also where lifecycle methods fire. `componentDidMount`, `componentDidUpdate`, and the `useLayoutEffect` callback all run during commit. `useEffect` runs after commit, in a separate "passive effects" phase scheduled via `requestIdleCallback` or microtasks.

## Performance Optimization Strategies

Understanding reconciliation leads to targeted optimizations. Here are the techniques I use based on how reconciliation works:

**React.memo for referential equality.** `React.memo` wraps a component to skip re-rendering if props haven't changed (by shallow comparison). This bypasses the entire reconciliation subtree of that component:

```jsx
const ExpensiveList = React.memo(({ items }) => {
  return items.map(item => <ExpensiveItem key={item.id} item={item} />);
});

// Only re-renders when items reference changes
// (or items.length changes behavior—be careful with arrays)
```

**Moving state down.** If only part of the tree needs the state, move the state closer to that part:

```jsx
// BAD: state at the top, entire tree re-renders
function App() {
  const [count, setCount] = useState(0);
  return (
    <div>
      <Header /> {/* re-renders when count changes */}
      <Sidebar /> {/* re-renders when count changes */}
      <Content count={count} setCount={setCount} />
      <Footer /> {/* re-renders when count changes */}
    </div>
  );
}

// GOOD: state lifted only to where it's needed
function App() {
  return (
    <div>
      <Header />
      <Sidebar />
      <CounterSection />
      <Footer />
    </div>
  );
}

function CounterSection() {
  const [count, setCount] = useState(0);
  return <Content count={count} setCount={setCount} />;
}
```

With `CounterSection` isolated, changing `count` only re-renders `CounterSection` and `Content`. `Header`, `Sidebar`, and `Footer` don't even know about it.

**Context splitting.** As discussed in the Context API article, splitting contexts by change frequency prevents cascading re-renders:

```jsx
const ThemeContext = createContext('light');
const UserContext = createContext(null);
const NotificationsContext = createContext([]);

function App() {
  return (
    <ThemeContext.Provider value={themeState}>
      <UserContext.Provider value={userState}>
        <NotificationsContext.Provider value={notifState}>
          <MainLayout />
        </NotificationsContext.Provider>
      </UserContext.Provider>
    </ThemeContext.Provider>
  );
}
```

## What Reconciliation Is NOT

Reconciliation is not "diffing the DOM." React never compares the real DOM with the virtual DOM. It compares the new virtual DOM tree (created during render) with the previous virtual DOM tree (created during the last render). The real DOM is only touched during the commit phase.

Reconciliation is not re-rendering. Re-rendering is running a component function to produce new virtual DOM. Reconciliation is comparing that new virtual DOM with the old one. A component can re-render without reconciliation (if the tree structure is identical and keys match) and reconciliation can happen without DOM mutations (if only text content changes).

Reconciliation is not just for lists. Every prop change, every state update, every context change triggers reconciliation on the affected subtree. The algorithm handles everything from a single text node update to a complete tree replacement.

## Conclusion

Reconciliation isn't magic—it's an O(n) tree-walk with well-understood performance characteristics. Code that respects React's heuristics (stable keys, same element types, narrow state updates) reconciles fast. Code that fights the heuristics (index keys, type-switching components, humongous context values) causes unnecessary DOM work.

Understanding the difference between the render phase (building virtual DOM) and the commit phase (applying DOM mutations) gives you a mental model for debugging performance issues. When your app feels slow, ask: "Is the render phase slow (too many components executing) or the commit phase slow (too many DOM mutations)?" Each has a different fix.

The beauty of reconciliation is that most of the time, you don't need to think about it. React's heuristics handle the common cases well. But when you do encounter a performance issue, knowing how reconciliation works turns a mysterious "app feels sluggish" into a concrete "list without keys is re-rendering 1000 DOM nodes."
