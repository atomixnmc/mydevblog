# React 19 Actions: State Management for Mutations

React 19 introduces Actions—a first-class primitive for handling mutations and form interactions. Actions unify the patterns that emerged from libraries like React Query and form libraries into the core framework, standardizing how React applications handle async state transitions.

**The useAction hook** is the centerpiece. `useAction` wraps an async function and returns `[action, pending, error]`. When the action is called, React automatically tracks its pending state and exposes any thrown errors. This replaces the manual `useState` + `useEffect` patterns for form submissions, API mutations, and any async workflow. `const [submit, pending, error] = useAction(async (data) => { await api.create(data) })`.

**Form Actions** integrate with HTML forms natively. The `<form action={actionFunction}>` attribute accepts an async function directly. On submission, React wraps the function in an action, handles `FormData` parsing, manages pending state, and prevents the default browser submit. Form validation errors map to actionable state without form library dependencies.

**Optimistic updates** are built in. `useOptimistic` accepts current state and an update function: `const [optimisticCount, addOptimistic] = useOptimistic(count, (state, increment) => state + increment)`. Calling `addOptimistic` updates the displayed value immediately while the action runs. If the action throws, React automatically reverts to the previous state. This eliminates the error-prone manual rollback logic that made optimistic updates fragile in React 18.

**The useTransition integration**: Actions integrate with the existing `useTransition` hook. A mutation wrapped in `startTransition` is treated as low priority. The `isPending` returned by `useTransition` reflects whether the action is executing, enabling the same pending UI patterns without separate state. This unifies navigation transitions (route changes) with data transitions (mutations) under the same concurrency primitive.

**FormStatus** provides per-field pending states. Complex forms with independent submit sections can track which section is currently submitting. `useFormStatus()` inside a form component returns `{ pending, data, method, action }`, enabling loading indicators on individual submit buttons rather than disabling the entire form.

**Server Actions** (Next.js) extend this to server-side mutations. An action function marked with `"use server"` runs on the server, directly modifying databases. The client receives a reference to the server action and calls it as if it were local. React streams back the mutation result and invalidates affected cache entries.

Actions represent React's maturation toward opinionated best practices for the most common application pattern: reading data, mutating data, and showing progress while mutations execute.
