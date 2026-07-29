# React setState Batching: Patterns and Pitfalls

React's `setState` batching is one of those features that works beautifully until it doesn't. Understanding when React batches state updates—and when it doesn't—saves you from the stale-closure bugs that plague intermediate React developers. After years of debugging production issues caused by batching misunderstandings, I can tell you this: the rules changed with React 18, and many blog posts haven't caught up.

## Batching in React ≤ 17: Synthetic Events vs. Everything Else

In React <= 17, `setState` calls inside React event handlers are batched automatically. React wraps your handler in a synthetic event transaction, collects all `setState` calls, and performs a single re-render. But **outside** event handlers—in `setTimeout`, `fetch` callbacks, or native DOM listeners—each `setState` triggers a separate render:

```js
// Batched (React event handler)
handleClick = () => {
  this.setState({ a: 1 });  // enqueued
  this.setState({ b: 2 });  // enqueued
  // Single render with { a: 1, b: 2 }
};

// NOT batched (setTimeout)
handleLater = () => {
  setTimeout(() => {
    this.setState({ a: 1 });  // render 1
    this.setState({ b: 2 });  // render 2
  }, 100);
};
```

This inconsistency was a major footgun. In React 16, I worked on a chat application where we fetched new messages and updated unread counts in a `setTimeout`-based polling loop. Each poll triggered two separate re-renders—one for the messages array and one for the unread count. On slower devices, the double render was visible as a flicker where unread counts updated a frame after the message list.

The reason is internal to React's architecture. In ≤17, React used a `batchedUpdates` function that was only called inside the synthetic event system. Async callbacks and native events didn't go through `batchedUpdates`. The React team acknowledged this as a design limitation but couldn't fix it without a major refactor of the reconciliation internals.

## Object vs. Functional Updater: The Race Condition

The functional updater pattern—passing a function instead of an object—solves the stale-state problem when updates depend on previous state:

```js
// Wrong: race condition if batched differently
this.setState({ count: this.state.count + 1 });
this.setState({ count: this.state.count + 1 });
// Result: count + 1, not +2

// Correct: functional updater
this.setState(prev => ({ count: prev.count + 1 }));
this.setState(prev => ({ count: prev.count + 1 }));
// Result: count + 2
```

Let's trace through why the object form fails. When React batches `setState` calls, it merges the objects:

```js
// React's internal merge
Object.assign({}, { count: this.state.count + 1 }, { count: this.state.count + 1 });
// Result: { count: this.state.count + 1 } — the second overwrites the first
```

Both objects read `this.state.count` at the same moment (during the current render), so both produce the same value. The merge just overwrites the first with the second, identical, value.

The functional form chains the updates:

```js
// React's internal chain
prev => ({ count: prev.count + 1 })  // takes 0, returns 1
prev => ({ count: prev.count + 1 })  // takes 1, returns 2
```

Each function receives the result of the previous function. The merge is a pipeline, not a shallow merge. This is identical to how `Array.reduce` works—each step feeds into the next.

I've seen this bug in production code more times than I can count. It happens in forms where multiple inputs update the same counter, in e-commerce carts where quantity increments race against stock updates, and in real-time dashboards where multiple websocket messages arrive in the same microtask.

```js
// Real-world example: cart quantity update
function CartItem({ item, updateQuantity }) {
  return (
    <div>
      <button onClick={() => updateQuantity(item.id, -1)}>-</button>
      <span>{item.quantity}</span>
      <button onClick={() => updateQuantity(item.id, 1)}>+</button>
    </div>
  );
}
```

If the user clicks "+" three times in rapid succession, without the functional updater, the quantity would only increase by 1, not 3. The functional updater ensures each click's effect is cumulative.

## React 18: Automatic Batching

React 18 introduced **automatic batching** via `createRoot`. Now all `setState` calls—even in `setTimeout` and promises—are batched. The `flushSync` API provides an escape hatch when you need synchronous DOM reads between updates.

```js
// React 18 - everything is batched
setTimeout(() => {
  setCount(c => c + 1);
  setFlag(f => !f);
  // Single re-render with both updates applied
}, 100);

fetch('/api/data').then(() => {
  setLoading(false);
  setData(result);
  // Single re-render
});

Promise.resolve().then(() => {
  setState1('a');
  setState2('b');
  // Single re-render
});
```

This was the single most requested feature in React's issue tracker for years. The implementation required changes to React's internal scheduling: every state update now goes through the same batching mechanism, regardless of its origin. The `scheduleUpdateOnFiber` function (introduced in the Fiber rewrite) became the unified entry point for all state updates, enabling consistent batching behavior.

The migration is trivial—replace `ReactDOM.render` with `createRoot`:

```js
// Before (React 17)
ReactDOM.render(<App />, document.getElementById('root'));

// After (React 18)
const root = createRoot(document.getElementById('root'));
root.render(<App />);
```

If you're still using `ReactDOM.render` in React 18, you get a deprecation warning and you don't get automatic batching in async contexts. I've audited several codebases where developers migrated to React 18 but missed the `createRoot` change, losing the main benefit of the upgrade.

## The flushSync Escape Hatch

Sometimes you need synchronous state updates. The most common case is reading a DOM measurement after a state change:

```js
function ScrollList() {
  const [items, setItems] = useState([]);
  const listRef = useRef(null);

  const addItem = () => {
    // Need the DOM to update before reading scrollHeight
    flushSync(() => {
      setItems(prev => [...prev, { id: Date.now() }]);
    });

    // Now we can read the updated DOM
    const { scrollHeight, clientHeight } = listRef.current;
    if (scrollHeight > clientHeight) {
      listRef.current.scrollTop = scrollHeight - clientHeight;
    }
  };

  return <div ref={listRef}>{/* items */}</div>;
}
```

Without `flushSync`, the `scrollHeight` read would happen before the DOM update, returning the old value. With `flushSync`, React synchronously commits the state update, then control returns to your code.

But `flushSync` should be a last resort. It forces React to do synchronous work, potentially blocking animations and input handling. I use it only when I need to read a DOM measurement immediately after a state change, and I always comment it with the reasoning so future maintainers don't remove it thinking it's unnecessary.

## Hooks: useState vs. useReducer for Complex State

With hooks, `useState` is the simplest state primitive. But when you have interdependent state updates that need batching, `useReducer` often produces cleaner code:

```js
// Multiple useState calls that change together
const [firstName, setFirstName] = useState('');
const [lastName, setLastName] = useState('');
const [email, setEmail] = useState('');

const loadUser = (user) => {
  // Three separate setState calls (now batched in React 18)
  setFirstName(user.firstName);
  setLastName(user.lastName);
  setEmail(user.email);
};

// useReducer consolidates into a single dispatch
const initialState = { firstName: '', lastName: '', email: '' };
function userReducer(state, action) {
  switch (action.type) {
    case 'LOAD_USER':
      return { ...state, ...action.payload };
    case 'UPDATE_FIELD':
      return { ...state, [action.field]: action.value };
    default:
      return state;
  }
}

const [user, dispatch] = useReducer(userReducer, initialState);

const loadUser = (user) => {
  dispatch({ type: 'LOAD_USER', payload: user });
};
```

The `useReducer` version makes the state transition explicit and reduces the number of state calls from 3 to 1. In React 17, this would have meant 1 render vs. 3 renders. In React 18 with automatic batching, all 3 `useState` calls are batched anyway, but `useReducer` still wins for readability and testability.

## The Mental Model That Works

Here's the mental model I teach junior developers about `setState`:

1. **setState is always asynchronous.** You cannot read the updated state immediately after calling `setState`. If you need the updated value, use the functional updater or `useEffect`.

2. **Use the functional updater when computing from previous state.** `setState(prev => prev + 1)` is the safe form. `setState(this.state.count + 1)` is the buggy form.

3. **In React 18 with createRoot, batching is universal.** You don't need to worry about `setTimeout` or promise boundaries anymore. But if you're stuck on React 17, wrap async updates in `unstable_batchedUpdates` from `react-dom`:

```js
import { unstable_batchedUpdates } from 'react-dom';

// React 17 workaround
fetch('/api/data').then((data) => {
  unstable_batchedUpdates(() => {
    setState1(data.a);
    setState2(data.b);
  });
});
```

4. **The batch is per-microtask.** Synchronous event handlers naturally batch multiple `setState` calls. But if you `await` inside an event handler, state updates after the `await` may or may not batch depending on the React version:

```js
// React 17: updates after await are NOT batched
async function handleClick() {
  setState1('a'); // part of batch
  await fetchData();
  setState2('b'); // NOT batched with setState1
}

// React 18: everything is batched automatically
```

5. **flushSync is an escape hatch, not a regular tool.** If you find yourself reaching for `flushSync`, consider whether you can restructure the code to use `useEffect` or refs instead.

## Conclusion

`setState` batching evolved from an undocumented implementation detail to a first-class feature with automatic batching in React 18. The patterns that worked in 2016 (object merges, manual `batchedUpdates`) are now legacy. The mental model I use: treat `setState` as asynchronous, always use the functional form when computing from previous state, and stop worrying about batching once you're on React 18 with `createRoot`. The patterns are simple, but the edge cases used to bite us constantly—and understanding them is the difference between "it works" and "it works correctly under all conditions."
