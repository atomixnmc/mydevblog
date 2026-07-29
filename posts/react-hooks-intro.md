# React Hooks: The Paradigm Shift

React Hooks, released in React 16.8, was the most significant change to React's mental model since the virtual DOM. It replaced lifecycle methods with functional composition, eliminated the `this` binding confusion of class components, and made stateful logic truly reusable. The shift wasn't just syntax—it was a different way of thinking about time and state in UI.

## The Pre-Hooks World

Before hooks, stateful logic reuse meant either mixins (deprecated in v15) or higher-order components and render props. Both patterns added wrapping components to the tree, making debugging harder. Hooks inverted the composability: state flows through function calls, not component nesting.

```js
// Before: HOC pattern for window resize
const withWindowSize = (Component) => {
  return class extends React.Component {
    state = { width: window.innerWidth };
    componentDidMount() {
      window.addEventListener('resize', this.handleResize);
    }
    componentWillUnmount() {
      window.removeEventListener('resize', this.handleResize);
    }
    handleResize = () => {
      this.setState({ width: window.innerWidth });
    };
    render() {
      return <Component width={this.state.width} {...this.props} />;
    }
  };
};

// After: Custom hook, no wrapper components
function useWindowSize() {
  const [width, setWidth] = useState(window.innerWidth);
  useEffect(() => {
    const handler = () => setWidth(window.innerWidth);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return width;
}
```

I worked on a React app in 2017 that had seven layers of HOCs wrapping the root component. There was `withRouter`, `withStyles`, `withRedux`, `withAuth`, `withTheme`, `withWindowSize`, and `withErrorBoundary`. The devtools component tree was a nesting nightmare. Each HOC added an anonymous wrapper class to the tree, making stack traces nearly unreadable. `this` binding errors were a weekly occurrence. When hooks landed, our team migrated over a weekend, and the component tree flattened from 12 levels of nesting to 4.

## The Problem with Class Components

Class components had several pain points that hooks addressed:

**`this` binding confusion.** JavaScript's `this` binding was a constant source of bugs. Event handlers needed `.bind(this)` in the constructor. Arrow function class properties were a workaround, but they created a new function instance on every render, breaking `PureComponent` optimizations.

**Lifecycle method fragmentation.** Related logic was split across different lifecycle methods. A subscription would be set up in `componentDidMount`, updated in `componentDidUpdate`, and torn down in `componentWillUnmount`. This scattered logic made it hard to verify correctness.

```js
// Class component - scattered subscription logic
class ChatComponent extends React.Component {
  componentDidMount() {
    ChatAPI.subscribe(this.props.roomId, this.handleMessage);
  }
  componentDidUpdate(prevProps) {
    if (prevProps.roomId !== this.props.roomId) {
      ChatAPI.unsubscribe(prevProps.roomId, this.handleMessage);
      ChatAPI.subscribe(this.props.roomId, this.handleMessage);
    }
  }
  componentWillUnmount() {
    ChatAPI.unsubscribe(this.props.roomId, this.handleMessage);
  }
  handleMessage = (msg) => {
    this.setState({ messages: [...this.state.messages, msg] });
  };
}

// Hook equivalent - colocated subscription logic
function Chat({ roomId }) {
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    const handler = (msg) => setMessages(prev => [...prev, msg]);
    ChatAPI.subscribe(roomId, handler);
    return () => ChatAPI.unsubscribe(roomId, handler);
  }, [roomId]);

  return <MessageList messages={messages} />;
}
```

The hook version is objectively simpler. The subscription setup, teardown, and cleanup are in one place. The dependency array `[roomId]` tells React to re-run the effect when the room changes. If you forget to handle the cleanup, ESLint warns you. If you miss a dependency, the linter catches it.

## Rules of Hooks

The **rules of hooks** (`use` at top level only, never inside conditions or loops) exist because React relies on the **order of hook calls** between renders to maintain state. Each render, hooks are called in sequence; React stores state per hook by its position in that sequence. Breaking the order breaks state persistence—and that's why ESLint's `react-hooks/rules-of-hooks` rule is mandatory, not optional.

```js
// DON'T - breaks hook ordering
function BadComponent({ featureFlag }) {
  if (featureFlag) {
    useEffect(() => { /* ... */ }, []); // Conditional - BAD
  }

  // On first render: useEffect runs at position 0
  // On second render with featureFlag=false: useEffect is skipped
  // Hook positions shift, all subsequent hooks misalign
}

// DO - unconditional hook with conditional logic inside
function GoodComponent({ featureFlag }) {
  useEffect(() => {
    if (!featureFlag) return;
    // Feature-specific logic here
  }, [featureFlag]);
}
```

The `react-hooks/exhaustive-deps` rule is equally important. It ensures your dependency array includes everything the effect closure references. I can't count the number of times I've seen `useEffect(() => { fetchData(userId) }, [])`—the empty dependency array means the effect captures the initial `userId` and never updates when `userId` changes. The linter catches this immediately and suggests `[userId]`.

## useEffect in Practice

`useEffect` replaced `componentDidMount`, `componentDidUpdate`, and `componentWillUnmount` with a single API. The dependency array tells React when to re-run the effect. Empty deps = mount/unmount only. Missing deps = stale closures. Including everything = infinite loops. Getting the dependency array right is the hardest part of migrating to hooks.

Here are the four common `useEffect` patterns I use daily:

```js
// 1. Mount-only effect (componentDidMount)
useEffect(() => {
  trackPageView();
}, []); // Empty array = runs once

// 2. Effect with cleanup (componentWillUnmount)
useEffect(() => {
  const timer = setInterval(() => tick(), 1000);
  return () => clearInterval(timer);
}, []);

// 3. Effect that syncs with state changes
useEffect(() => {
  document.title = `${count} new messages`;
}, [count]); // Re-runs when count changes

// 4. Effect with previous value comparison
useEffect(() => {
  if (prevRoomId !== undefined && prevRoomId !== roomId) {
    analytics.track('room_changed', { from: prevRoomId, to: roomId });
  }
}, [roomId]); // Track the dependency, handle logic inside
```

Pattern 4 is worth elaborating on. If you need the previous value, store it in a ref:

```js
function usePrevious(value) {
  const ref = useRef();
  useEffect(() => { ref.current = value; });
  return ref.current;
}

function Room({ roomId }) {
  const prevRoomId = usePrevious(roomId);
  useEffect(() => {
    if (prevRoomId !== undefined && prevRoomId !== roomId) {
      // roomId just changed - do something
    }
  }, [roomId, prevRoomId]);
}
```

## Custom Hooks: The Real Superpower

The true power of hooks isn't `useState` or `useEffect`—it's the ability to compose them into custom hooks. Custom hooks are just functions that call other hooks, but they package stateful logic into reusable, testable units.

```js
function useLocalStorage(key, initialValue) {
  const [storedValue, setStoredValue] = useState(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(error);
      return initialValue;
    }
  });

  const setValue = useCallback((value) => {
    try {
      const valueToStore =
        value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.error(error);
    }
  }, [key, storedValue]);

  return [storedValue, setValue];
}

// Usage
function Settings() {
  const [theme, setTheme] = useLocalStorage('theme', 'light');
  const [fontSize, setFontSize] = useLocalStorage('fontSize', '16');

  return (
    <div className={theme}>
      <select value={theme} onChange={e => setTheme(e.target.value)}>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
    </div>
  );
}
```

The `useLocalStorage` hook encapsulates all the serialization, deserialization, and error handling. Any component can use it. The lazy initializer (`() => JSON.parse(...)`) ensures localStorage is only read once per mount.

## Common Pitfalls and How to Avoid Them

Even experienced developers hit hooks pitfalls. Here are the most common ones I've encountered:

**Stale closures in callbacks.** When you pass a callback to a child component that captures state, the callback may reference stale values:

```js
function Timer() {
  const [count, setCount] = useState(0);

  // BAD: count is captured once, never updates
  const handleClick = () => {
    setTimeout(() => alert(count), 3000);
  };

  // GOOD: count is read from ref
  const countRef = useRef(count);
  countRef.current = count;
  const handleClick = () => {
    setTimeout(() => alert(countRef.current), 3000);
  };
}
```

**Infinite loops from object dependencies.** Objects and arrays in dependency arrays cause re-runs on every render because `{} !== {}`:

```js
// BAD: new options object every render
useEffect(() => {
  fetchData(options);
}, [options]); // Infinite loop!

// GOOD: memoize the object
const options = useMemo(() => ({ id: userId, limit: 10 }), [userId]);

useEffect(() => {
  fetchData(options);
}, [options]);
```

**useEffect for derived state.** If you find yourself using `useEffect` to sync state, you're probably overcomplicating it:

```js
// BAD: derived state via useEffect
const [items, setItems] = useState([]);
const [filteredItems, setFilteredItems] = useState([]);

useEffect(() => {
  setFilteredItems(items.filter(item => item.active));
}, [items]);

// GOOD: computed value during render
const filteredItems = useMemo(
  () => items.filter(item => item.active),
  [items]
);
```

## The Impact on the Ecosystem

The hooks paradigm reshaped the entire React ecosystem. State management libraries like Redux adopted hooks (`useSelector`, `useDispatch`). Routing libraries followed (`useRouter`, `useParams`). Data fetching libraries built entirely around hooks (React Query's `useQuery`, SWR's `useSWR`).

Before hooks, integrating state management meant wrapping your app in provider components and connecting every component with HOCs. Redux's `connect()` was a factory function that returned an HOC. MobX's `observer()` was an HOC. Every piece of cross-cutting state added a wrapper to your tree.

After hooks, `useSelector` and `useDispatch` are plain function calls inside your component body. No wrapper components. No HOCs. The tree stays flat.

```js
// Before Redux + Hooks
export default connect(
  (state) => ({ todos: state.todos }),
  { addTodo, toggleTodo }
)(TodoList);

// After Redux + Hooks
function TodoList() {
  const dispatch = useDispatch();
  const todos = useSelector(state => state.todos);

  return (
    <>
      {todos.map(todo => <TodoItem key={todo.id} todo={todo} />)}
    </>
  );
}
```

The `useSelector` hook also introduces subscription isolation. Each component using `useSelector` subscribes only to the slice of state it reads. Redux internally uses `useSyncExternalStore` (a React 18 hook) to ensure consistent state reads even during concurrent rendering.

## The Future: Hooks Beyond React 18

React 18 introduced `useSyncExternalStore`, `useId`, `useTransition`, and `useDeferredValue`. These hooks extend the paradigm to cover concurrent rendering, consistent external store access, and progressive UI updates.

`useTransition` is particularly interesting. It lets you mark a state update as non-urgent, allowing React to interrupt it with more urgent updates:

```js
function SearchResults() {
  const [query, setQuery] = useState('');
  const [isPending, startTransition] = useTransition();

  const handleChange = (e) => {
    // Urgent: update the input value immediately
    setQuery(e.target.value);

    // Non-urgent: filter results can be deferred
    startTransition(() => {
      setFilteredResults(filterData(e.target.value));
    });
  };

  return (
    <div>
      <input value={query} onChange={handleChange} />
      {isPending ? <Spinner /> : <Results list={filteredResults} />}
    </div>
  );
}
```

The input stays responsive because the filtering work is deferred. React can interrupt the filtering to process the next keystroke. This was impossible with class components and `setState`—every update had equal priority.

## Conclusion

The hooks paradigm shift was one of the most successful API redesigns in frontend history. It eliminated classes, flattened component trees, made stateful logic reusable, and opened the door to concurrent rendering. The result: components became simpler, stateful logic became packageable (`useAuth`, `useWebSocket`, `useLocalStorage`), and class components went from the standard to the legacy path. New projects today start with hooks, and the ecosystem has fully embraced them. The shift wasn't just syntax—it was a fundamentally better way to compose UI logic.
