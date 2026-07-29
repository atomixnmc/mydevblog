# React 19 Compiler (React Forget)

React 19 ships a compiler that eliminates the need for `useMemo`, `useCallback`, and `React.memo`. The compiler, codenamed "React Forget", automatically memoizes values and components by analyzing the JavaScript AST and inserting memoization calls where it can prove they're safe.

## How It Works

The compiler runs as a Babel plugin (or Vite/Rspack plugin) during the build step. It analyzes each function component and hook and determines which values are "memoization-safe" — that is, their identity won't change unless their inputs change:

```javascript
// BEFORE — manual memoization
function Profile({ user, posts }) {
  const displayName = useMemo(
    () => `${user.firstName} ${user.lastName}`,
    [user.firstName, user.lastName]
  );
  const sortedPosts = useMemo(
    () => [...posts].sort((a, b) => b.date - a.date),
    [posts]
  );
  return <ProfileCard name={displayName} posts={sortedPosts} />;
}
```

```javascript
// AFTER — no useMemo needed
function Profile({ user, posts }) {
  const displayName = `${user.firstName} ${user.lastName}`;
  const sortedPosts = [...posts].sort((a, b) => b.date - a.date);
  return <ProfileCard name={displayName} posts={sortedPosts} />;
}
```

The compiler infers that `displayName` depends only on props, and `sortedPosts` depends only on `posts`. It inserts `Object.is` checks for these dependencies and skips re-rendering child components when their props haven't changed.

## Compiler Rules

The compiler uses a "rules of memoization" analysis that guarantees correctness:

1. **Pure computation only**: Expressions with side effects (mutations, I/O) are never auto-memoized
2. **Read-only props**: Props flowing into a component are always safe dependencies
3. **No hidden dependencies**: The compiler tracks closure captures and marks them as dependencies too

The compiler also handles hooks. `useState`'s setter is always stable (no deps needed), `useRef`'s `.current` is treated as mutable (never a dependency), and custom hooks are analyzed transitively.

## Migration

Existing codebases work fine with the compiler — you don't need to remove your `useMemo` calls. The compiler defers to explicit memoization where it's present and fills in the gaps where it's missing. In practice, turning on the compiler typically removes 30-50% of memoization boilerplate in a real app. The compiler is enabled per-file in the Babel config — we turned it on incrementally across our components to catch edge cases.

One gotcha: the compiler fails on intentionally unstable values. If you're using `useCallback(() => {}, [])` to create a stable callback identity unrelated to inputs, the compiler can't reason about that. You'll need to suppress the compiler with a comment directive in those cases. We hit this pattern in animation callbacks where the identity itself was the important thing, not the computation.