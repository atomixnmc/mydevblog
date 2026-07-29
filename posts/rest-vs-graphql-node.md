# REST vs GraphQL in Node.js: Choosing Your API Layer

Every Node.js backend team eventually faces the REST vs GraphQL decision. Both are valid. Both have passionate advocates. The real question isn't which is "better"—it's which trade-offs match your product's data access patterns.

**REST** works well when your API maps cleanly to resources. `GET /users/:id`, `POST /orders`, `PUT /profiles`. REST is simple to cache (HTTP caching, CDNs), simple to understand, and simple to debug with `curl`. The pain point: over-fetching and under-fetching. A mobile app and a web dashboard using the same API either get too much data (wasted bandwidth) or need N+1 round trips.

```js
// REST route - returns full user object whether you want it or not
app.get('/api/users/:id', async (req, res) => {
  const user = await db.findUser(req.params.id);
  res.json(user); // Always returns all fields
});
```

**GraphQL** solves over-fetching by letting clients specify exact fields. A single endpoint handles all queries. The cost: server complexity, query cost analysis, and cache invalidation headaches. Without protection, clients can write deeply nested queries that DoS your database.

```js
// GraphQL resolver - client asks for only what it needs
const resolvers = {
  Query: {
    user: async (_, { id }) => db.findUser(id),
  },
  User: {
    orders: async (user) => db.findOrdersByUser(user.id),
  },
};
```

My rule of thumb after building both:

| Consideration | REST | GraphQL |
|---|---|---|
| Public API for third parties | ✅ Better | ❌ Complex |
| Mobile apps with limited bandwidth | ❌ Over-fetch | ✅ Precise queries |
| Simple CRUD | ✅ Simple | ❌ Boilerplate |
| Real-time subscriptions | ❌ WebSocket extras | ✅ Built-in |
| Caching infrastructure | ✅ HTTP cache | ❌ Client-side only |

Node.js frameworks make both viable. Express/Koa for REST; Apollo Server or Yoga for GraphQL. If you're undecided, start with REST and a thin GraphQL gateway that proxies to REST endpoints—you get the client experience of GraphQL without committing to a full schema-first architecture before you understand your data shape.

The worst approach is neither. It's building a "REST-ish" API with inconsistent conventions or a "GraphQL-like" layer without a schema. Pick one, commit, and document your conventions.
