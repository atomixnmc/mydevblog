# React 19 use() Hook: Async Resources in Render

React 19 introduces the `use()` hook—a new primitive that breaks the rules of hooks as we knew them. Unlike all previous hooks, `use()` can be called conditionally, inside loops, and even outside component render functions. Its purpose: read asynchronous resources (promises, context) directly during render.

**The API**: `const value = use(resource)`. When `resource` is a Promise, `use` suspends the component until the promise resolves, exactly like `throw promise` in Suspense-based data fetching. When `resource` is a Context object, `use` returns the current context value, similar to `useContext` but callable anywhere in the component tree.

**Breaking the rules of hooks**: Previous hooks (`useState`, `useEffect`, `useMemo`) must be called unconditionally at the top level of a component. This "rules of hooks" constraint enabled React to track hook identity by call order. `use()` bypasses this: `if (condition) { const data = use(promise) }` is valid. React tracks `use` calls by their position in the fiber tree and the resource reference, not by call order. This makes `use()` more flexible but also means React must handle resources being added or removed between renders.

**Context with use()**: `const theme = use(ThemeContext)` replaces `useContext(ThemeContext)` with the same behavior but without the hook ordering constraint. The practical benefit: read context inside conditional blocks, memoized callbacks, or after early returns without restructuring code.

**Promise with use()**: Pass a promise to `use()` and the component suspends. This is designed for Next.js server components (where `use` can await data directly) and client components using Suspense. `use()` works with any thenable, including React's built-in `cache()` function for deduplicating requests: `const data = use(cache(fetchData)(id))`.

**Integration with Suspense**: `use(promise)` triggers the nearest `<Suspense>` boundary. The promised value is cached by React's internal suspense cache, so multiple components reading the same promise resolve from cache. On error, the nearest Error Boundary catches the rejection.

**Server Components**: In RSC, `use()` works with async context—a concept unique to server components where context values can be promises. A server context `ThemeContext` created with `createServerContext` can be read with `use(ThemeContext)` and the value resolves from the server-side data source.

`use()` represents a fundamental simplification: resource consumption (promises and context) becomes a primitive on par with state and effects, accessible without boilerplate or constraint violations.
