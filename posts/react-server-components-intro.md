# React Server Components Vision

React Server Components (RSC) represent a paradigm shift in how we think about React applications. Instead of shipping all component logic to the client, RSC lets components render on the server, sending only the resulting UI payload to the browser. The vision: zero-bundle-size components that can access databases, file systems, and backend APIs directly.

The key insight is that many components don't need client-side interactivity. A product list page, a blog post, or a dashboard view reads data and renders HTML. In the traditional client-side React model, you ship the component code, the data-fetching logic, and the rendering runtime to the browser. With RSC, you move that work to the server and send static HTML with optional interactive islands.

Server Components can `await` database queries directly in the render function. They can import database drivers, read from the filesystem, and call internal APIs — all without exposing credentials to the client. The data fetching happens during server rendering, eliminating waterfalls caused by `useEffect` chains.

Client Components remain for interactivity. The boundary between server and client is explicit: you mark a file with a `"use client"` directive, and everything else defaults to server. This lets you pay the JavaScript tax only for components that truly need it.

The vision extends to streaming. React can stream server-rendered HTML as it completes, so the browser starts painting content before all data loads. Combined with Suspense, this enables instant navigation with progressively filling content.

RSC isn't just a performance optimization — it's a new mental model that treats server and client as a continuum rather than separate worlds.
