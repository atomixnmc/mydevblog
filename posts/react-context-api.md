# React Context API: From Experiment to Essential

The React Context API has a fascinating evolution. What started as an undocumented experiment in v0.11 became the foundation of state management in modern React. Understanding its journey explains why we have the API we do today—and why some older patterns deserved to die.

**Phase 1: The Secret Context (v0.11–v15)**. Context was hidden behind `contextTypes` and `childContextTypes`. It was technically unstable—the React team warned against using it directly. But libraries like Redux and MobX relied on it to pass the store down the tree. The problem? If any component in the tree implemented `shouldComponentUpdate` without passing context, updates would silently break. This was the "context bailout" bug that drove developers crazy.

```js
// v15 style - fragile and undocumented
class ThemeProvider extends React.Component {
  getChildContext() { return { color: 'blue' }; }
  render() { return this.props.children; }
}
ThemeProvider.childContextTypes = { color: PropTypes.string };
```

**Phase 2: The Stable API (v16.3)**. React finally shipped a stable Context API with `React.createContext`. The provider/consumer pattern eliminated the bailout bug because consumers subscribed directly to context changes via a subscription model, not a tree traversal. This was a breaking change from the experimental API, but it was worth it.

```js
const ThemeContext = React.createContext('light');
<ThemeContext.Provider value="dark">
  <ThemeContext.Consumer>
    {theme => <div className={theme}>Content</div>}
  </ThemeContext.Consumer>
</ThemeContext.Provider>
```

**Phase 3: useContext Hook (v16.8)**. The `useContext` hook made consuming context trivial, removing the render-prop boilerplate:

```js
const theme = useContext(ThemeContext);
```

Today's Context API is simple, but the trade-off remains: context updates cause every consumer to re-render, not just selective subtrees. For rapidly-changing state (animations, real-time data), it's still better to reach for Zustand or Jotai. Context shines for themes, auth state, locale, and other slow-changing global data.
