# React Hooks: The Paradigm Shift

React Hooks, released in React 16.8, was the most significant change to React's mental model since the virtual DOM. It replaced lifecycle methods with functional composition, eliminated the `this` binding confusion of class components, and made stateful logic truly reusable. The shift wasn't just syntax—it was a different way of thinking about time and state in UI.

Before hooks, stateful logic reuse meant either mixins (deprecated in v15) or higher-order components and render props. Both patterns added wrapping components to the tree, making debugging harder. Hooks inverted the composability: state flows through function calls, not component nesting.

```js
// Before: HOC pattern for window resize
const withWindowSize = (Component) => {
  return class extends React.Component {
    state = { width: window.innerWidth };
    componentDidMount() {
      window.addEventListener('resize', this.handleResize);
    }
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

The **rules of hooks** (`use` at top level only, never inside conditions or loops) exist because React relies on the **order of hook calls** between renders to maintain state. Each render, hooks are called in sequence; React stores state per hook by its position in that sequence. Breaking the order breaks state persistence—and that's why ESLint's `react-hooks/rules-of-hooks` rule is mandatory, not optional.

`useEffect` replaced `componentDidMount`, `componentDidUpdate`, and `componentWillUnmount` with a single API. The dependency array tells React when to re-run the effect. Empty deps = mount/unmount only. Missing deps = stale closures. Including everything = infinite loops. Getting the dependency array right is the hardest part of migrating to hooks.

The result: components became simpler, stateful logic became packageable (`useAuth`, `useWebSocket`), and class components went from the standard to the legacy path. New projects today start with hooks, and the ecosystem has fully embraced them.
