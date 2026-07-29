# React Query vs SWR: Data Fetching in React

Server state management in React has evolved from manual `useEffect` + `useState` boilerplate to dedicated libraries. React Query (TanStack Query) and SWR are the two dominant players. Both solve the same core problems: caching, deduplication, background refetching, and optimistic updates. The differences lie in philosophy and API design.

**React Query** positions itself as a complete server state management solution. It provides a powerful query key system where keys can be arrays with dependencies, enabling granular cache invalidation. Mutations are first-class citizens with lifecycle hooks (`onMutate`, `onSuccess`, `onError`, `onSettled`) and automatic cache updates. The devtools are excellent—developers can inspect, filter, and manually manipulate the entire cache during development.

**SWR** (stale-while-revalidate) by Vercel takes a simpler, lighter approach. The name describes its strategy: return cached data immediately (stale), then revalidate in the background. SWR is opinionated toward the Vercel ecosystem—it supports Next.js's server-side rendering and static generation patterns natively. The learning curve is gentler, but the tradeoff is less control over caching and fewer mutation features.

**Key differences in API**: React Query's `useQuery` takes a key and a fetcher function, returning `{ data, isLoading, error, isFetching }`. SWR's `useSWR` takes a key (which doubles as the fetcher endpoint by default) and returns `{ data, error, isLoading, isValidating }`. SWR folds the loading and fetching distinction—a subtle difference that matters for background refetch UX.

**Cache management** is where React Query pulls ahead for complex apps. It supports infinite queries, parallel queries, dependent queries, and pagination out of the box. The garbage collection system evicts unused queries after a configurable timeout. SWR's cache is simpler but less configurable—its `mutate` function globally invalidates by key pattern.

**Which to choose?** SWR wins for smaller projects, Next.js apps, and teams who want minimal API surface. React Query wins for data-heavy applications with complex mutation workflows, especially admin dashboards and real-time collaborative tools. Both are excellent—the choice is about complexity tolerance and feature requirements.
