# React Query vs SWR: Data Fetching in React, a Practical Guide

Server state management in React has evolved from manual `useEffect` + `useState` boilerplate to dedicated libraries. React Query (TanStack Query) and SWR are the two dominant players. Both solve the same core problems: caching, deduplication, background refetching, and optimistic updates. The differences lie in philosophy, API design, and the complexity they're willing to expose. I've used both extensively — React Query on three production apps and SWR on two — and I want to share the tradeoffs I've encountered, not just read about.

## Philosophy: Complete Solution vs. Lightweight Hook

React Query positions itself as a complete server state management solution. It provides a powerful query key system where keys can be arrays with dependencies, enabling granular cache invalidation. Mutations are first-class citizens with lifecycle hooks (`onMutate`, `onSuccess`, `onError`, `onSettled`) and automatic cache updates. The devtools are excellent — developers can inspect, filter, and manually manipulate the entire cache during development. React Query wants to replace your entire state management layer for server data.

SWR (stale-while-revalidate) by Vercel takes a simpler, lighter approach. The name describes its strategy: return cached data immediately (stale), then revalidate in the background. SWR is opinionated toward the Vercel ecosystem — it supports Next.js's server-side rendering and static generation patterns natively. The learning curve is gentler, but the tradeoff is less control over caching and fewer mutation features.

I've found the philosophical difference shows most clearly in error handling. React Query treats errors as first-class statuses alongside loading states — you get `isLoading`, `isError`, `error`, and `isSuccess` out of the box. SWR returns `error` alongside `data`, and you check for it manually. This sounds minor, but it shapes how teams structure their components. React Query teams tend to build robust error boundaries and retry UIs; SWR teams tend to handle errors ad-hoc where they arise.

```tsx
// React Query — explicit status-based rendering
function UserProfile({ userId }) {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['user', userId],
    queryFn: () => fetchUser(userId),
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
  });

  if (isLoading) return <Skeleton />;
  if (isError) return <ErrorBanner message={error.message} onRetry={refetch} />;
  return <Profile data={data} />;
}

// SWR — manual error handling
function UserProfile({ userId }) {
  const { data, error, isLoading } = useSWR(`/api/users/${userId}`, fetcher);

  if (isLoading) return <Skeleton />;
  if (error) return <ErrorBanner message={error.message} />;
  return <Profile data={data} />;
}
```

## API Design: The Ergonomics Difference

Key differences in API: React Query's `useQuery` takes a key and a fetcher function, returning `{ data, isLoading, error, isFetching }`. SWR's `useSWR` takes a key (which doubles as the fetcher endpoint by default) and returns `{ data, error, isLoading, isValidating }`. SWR folds the loading and fetching distinction — a subtle difference that matters for background refetch UX.

In React Query, `isLoading` is true only when there is no cached data and the query is fetching for the first time. `isFetching` is true whenever a fetch is in progress, including background refetches. This distinction lets you show a skeleton on initial load without disrupting the user during background updates. SWR merges these: `isLoading` is true on initial load (no cached data), but there's no direct way to distinguish "first load" from "background refresh" without checking `data` yourself.

```tsx
// React Query — separate isLoading vs isFetching for fine-grained UX
function Dashboard() {
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['dashboard'],
    queryFn: fetchDashboard,
    refetchInterval: 30000, // auto-refresh every 30s
  });

  if (isLoading) return <DashboardSkeleton />;
  return (
    <div>
      {isFetching && <RefreshIndicator />}
      <DashboardContent data={data} />
    </div>
  );
}

// SWR — you'd need to track this yourself
function Dashboard() {
  const { data, isValidating, isLoading } = useSWR('/api/dashboard', fetcher, {
    refreshInterval: 30000,
  });

  if (isLoading) return <DashboardSkeleton />;
  return (
    <div>
      {isValidating && <RefreshIndicator />}
      <DashboardContent data={data} />
    </div>
  );
}
```

## Cache Management: Where React Query Pulls Ahead

Cache management is where React Query pulls ahead for complex apps. It supports infinite queries, parallel queries, dependent queries, and pagination out of the box. The garbage collection system evicts unused queries after a configurable timeout. SWR's cache is simpler but less configurable — its `mutate` function globally invalidates by key pattern.

React Query's query key system is its superpower. Keys are arrays that can include any serializable value, enabling hierarchical cache invalidation. `queryKey: ['projects', projectId, 'tasks']` creates a cache entry that can be invalidated at any level. Invalidate `['projects']` and everything under it gets marked stale. This lets you build complex dependency graphs: when a user updates their profile, you can invalidate `['user']`, `['dashboard']`, and `['notifications']` in one `queryClient.invalidateQueries({ predicate: ... })` call.

SWR's `mutate` function is simpler — you call `mutate(key)` to revalidate a specific endpoint or `mutate(keyMatch)` with a regex to bulk-invalidate. It works well for small apps but becomes unwieldy when you have dozens of interdependent endpoints. I worked on a project where a single mutation (creating an order) required invalidating six different SWR keys, and we kept missing one in code reviews.

```tsx
// React Query — dependent invalidation via query key hierarchy
const queryClient = useQueryClient();

const mutation = useMutation({
  mutationFn: (newTask) => createTask(newTask),
  onSuccess: (data, variables) => {
    // Invalidate the project's task list
    queryClient.invalidateQueries({ queryKey: ['projects', variables.projectId, 'tasks'] });
    // Also invalidate the project overview (counts, status summary)
    queryClient.invalidateQueries({ queryKey: ['projects', variables.projectId] });
    // Update the task detail cache directly
    queryClient.setQueryData(['tasks', data.id], data);
  },
});

// SWR — manual key management
const { mutate } = useSWRConfig();

const handleCreateTask = async (newTask) => {
  await createTask(newTask);
  // Must remember to invalidate all related keys
  mutate(`/api/projects/${newTask.projectId}/tasks`);
  mutate(`/api/projects/${newTask.projectId}`);
  mutate('/api/projects'); // project list may have changed
};
```

## Mutation Workflows: The Real Decider

Mutations are where React Query's investment in developer experience shows most clearly. SWR's `mutate` is really a cache update mechanism with optional API calls. React Query's `useMutation` is a full mutation lifecycle management tool with optimistic updates, rollback on error, and cache synchronization.

Optimistic updates demonstrate the difference. React Query's `onMutate` fires before the mutation, letting you update the cache immediately for a snappy UX. If the server rejects the mutation, `onError` fires and you roll back to the previous cache state using a snapshot you saved in `onMutate`. SWR supports optimistic updates through its `mutate` function with `optimisticData`, but the rollback mechanism requires manual state management.

```tsx
// React Query — optimistic update with automatic rollback
const mutation = useMutation({
  mutationFn: updateTodo,
  onMutate: async (newTodo) => {
    await queryClient.cancelQueries({ queryKey: ['todos'] });
    const previousTodos = queryClient.getQueryData(['todos']);
    queryClient.setQueryData(['todos'], (old) =>
      old.map((todo) => (todo.id === newTodo.id ? { ...todo, ...newTodo } : todo))
    );
    return { previousTodos }; // passed to onError
  },
  onError: (err, newTodo, context) => {
    queryClient.setQueryData(['todos'], context.previousTodos); // rollback
  },
  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: ['todos'] });
  },
});

// SWR — optimistic update, manual rollback
const { mutate } = useSWRConfig();

const handleToggle = async (id, completed) => {
  const key = '/api/todos';
  const previous = cache.get(key);

  mutate(key, (todos) =>
    todos.map((t) => (t.id === id ? { ...t, completed } : t)),
    false // don't revalidate yet
  );

  try {
    await updateTodo(id, { completed });
    mutate(key); // revalidate on success
  } catch {
    mutate(key, previous, false); // manual rollback to cached data
  }
};
```

## Which One Should You Choose?

SWR wins for smaller projects, Next.js apps, and teams who want minimal API surface. If you're building a content site, a blog, or a simple dashboard with straightforward CRUD, SWR's simplicity will get you further faster. The integration with Next.js's SSR and ISR is seamless — `useSWR` in a page component just works.

React Query wins for data-heavy applications with complex mutation workflows, especially admin dashboards, real-time collaborative tools, and any app where cache invalidation is a full-time problem. If you find yourself writing middleware to manage cache state, or if your team spends more time on data fetching logic than on UI code, React Query's investment in cache management will pay off.

My personal rule of thumb: if the app has five or fewer server endpoints and no cross-cutting cache invalidation, use SWR. If the app has twenty-plus endpoints with shared data, optimistic updates, and complex mutation chains, use React Query. Both are excellent libraries maintained by great teams — you won't go wrong with either. The choice is about complexity tolerance and feature requirements, and it's genuinely refreshing to have two such well-designed options in the ecosystem.

## Migration Considerations: SWR to React Query

If you start with SWR and outgrow it, the migration to React Query is manageable. The conceptual models are similar enough that you can map one to the other without rewriting your data layer. The key steps: rename `useSWR` to `useQuery` and restructure keys from strings to arrays, replace `mutate(key)` with `queryClient.invalidateQueries({ queryKey: [...] })`, and wrap mutation logic in `useMutation` with lifecycle hooks.

The trickiest part is the cache format. SWR stores flat string-keyed entries. React Query stores hierarchical array-keyed entries with metadata — status, fetch count, garbage collection timers. You can't share a cache between the two. The migration requires a flag day where you switch all data fetching to React Query. I've done this twice, and both times the migration took about a week for a medium-complexity app (30+ endpoints). The team was happier on the other side, but there was a painful middle period where both libraries were in the bundle.

## TypeScript Integration

Both libraries have excellent TypeScript support, but they handle generics differently. React Query infers types from your query function's return type. If `fetchUser()` returns `Promise<User>`, then `useQuery({ queryKey: ['user'], queryFn: fetchUser })` gives you `data: User | undefined` automatically. SWR requires explicit type annotations on the fetcher or the hook call: `useSWR<User>('/api/user', fetcher)`. It's a minor difference, but teams that prioritize type safety tend to prefer React Query's inference approach — one less annotation to maintain per query.

## SSR and Server-Side Data Fetching

SWR's tight integration with Next.js gives it an edge in server-side rendering scenarios. `useSWR` can pre-fetch data during SSR and hydrate the cache on the client, so the first render has data without a client-side refetch. The `fallbackData` option lets you seed the cache with server-fetched data. React Query supports similar patterns through `initialData` and hydration, but the setup requires more boilerplate — you need to dehydrate the query cache on the server and rehydrate it on the client.

For Remix and other non-Next.js frameworks, the advantage flips. React Query's adapter pattern makes it framework-agnostic. SWR assumes a Vercel/Next.js runtime and takes more work to integrate with alternative SSR frameworks. If you're building with Remix or a custom Node.js server, React Query's infrastructure integration is smoother.

## Pagination and Infinite Loading

Both libraries handle pagination, but the APIs differ significantly. React Query's `useInfiniteQuery` returns grouped pages with built-in `fetchNextPage` and `hasNextPage` helpers. The data structure is `{ pages: [[...], [...], ...], pageParams: [...] }`, giving you full control over how pages are concatenated and displayed. SWR's `useSWRInfinite` works similarly but uses a different key structure — each page gets its own key derived from a `getKey` function that receives the previous page's data and index.

The practical difference shows in cursor-based pagination — infinite scroll in social feeds, message histories, or search results. React Query's `getNextPageParam` lets you extract the next cursor from the API response declaratively. SWR requires you to manage cursor state through the key function yourself, which is more flexible but requires more manual handling. If you're building complex pagination (nested comments, multi-dimensional feeds, real-time updates), React Query's abstraction saves significant boilerplate.

## SSR and Server-Side Data Fetching

SWR's tight integration with Next.js gives it an edge in server-side rendering scenarios. `useSWR` can pre-fetch data during SSR and hydrate the cache on the client, so the first render has data without a client-side refetch. The `fallbackData` option lets you seed the cache with server-fetched data. React Query supports similar patterns through `initialData` and hydration, but the setup requires more boilerplate — you need to dehydrate the query cache on the server and rehydrate it on the client.

For Remix and other non-Next.js frameworks, the advantage flips. React Query's adapter pattern makes it framework-agnostic. SWR assumes a Vercel/Next.js runtime and takes more work to integrate with alternative SSR frameworks. If you're building with Remix or a custom Node.js server, React Query's infrastructure integration is smoother.
