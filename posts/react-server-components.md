# React Server Components in Practice

React Server Components (RSC), shipping in Next.js App Router and gradually in other frameworks, fundamentally change the mental model of React rendering. Components run on the server, stream their rendered output to the client, and never ship their JavaScript bundle.

**The server/client boundary** is marked by `"use client"` directives. Components without this directive are server components: they run once on the server, can use `async/await` directly, access databases, read files, and call internal APIs. Their rendered output—a serializable tree of client component placeholders and HTML—streams to the browser. Client components (marked with `"use client"`) hydrate on the client and have access to hooks, browser APIs, and interactivity.

**Data fetching transforms** with RSC. Instead of `useEffect` + loading states or React Query's client-side caching, server components `await` data directly: `const posts = await db.query('SELECT * FROM posts');`. The database call happens during server rendering, never exposes credentials to the client, and eliminates client-server waterfalls. The result is static HTML by default—interactivity only where explicitly needed.

**The composition model** is strict: server components can import and render client components, but client components cannot import server components. Server components passed as children or props to client components become opaque React nodes—the client component receives the rendered output but cannot re-render it. This shapes application architecture around a server-first philosophy.

**Streaming and Suspense** make RSC practical. A page can stream in as server components complete: the navbar renders immediately (it only needs headers/auth), while a data-heavy dashboard section suspends with a loading fallback. The `<Suspense>` boundary controls what the user sees before each server component completes. This eliminates the all-or-nothing loading problem of traditional SSR.

**Bundle size** drops dramatically. A markdown-rendering component that imports `marked`, `highlight.js`, and `gray-matter` runs entirely on the server. The client never downloads those libraries. For an app with heavy data transformation, this can reduce client JS by 50-80%.

**Tradeoffs**: RSC requires a server runtime (Node.js, Edge, or equivalent). Static export sites can't use RSC's server-side rendering. The mental model shift from "everything is client-side" to "server-first, client-when-needed" takes adjustment, but the performance and security benefits are substantial for data-intensive applications.
