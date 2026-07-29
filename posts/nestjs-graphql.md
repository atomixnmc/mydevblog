# GraphQL in NestJS

NestJS provides first-class GraphQL integration through the `@nestjs/graphql` package, supporting both code-first and schema-first approaches. The code-first approach uses TypeScript decorators to generate the GraphQL schema automatically, making it the preferred choice for teams that want to keep schema and implementation in sync.

Setting up GraphQL in NestJS starts with importing `GraphQLModule`:

```typescript
GraphQLModule.forRoot({
  autoSchemaFile: 'schema.gql',
  playground: true,
})
```

This scans your resolvers and generates the schema file. Resolvers are provider classes decorated with `@Resolver()`. For queries, you decorate methods with `@Query()`. Mutations use `@Mutation()`, and subscriptions use `@Subscription()`.

Object types are defined with `@ObjectType()` and properties decorated with `@Field()`. Input types use `@InputType()`. This decorator-driven approach means your TypeScript types and GraphQL types stay consistent through the codebase. NestJS also handles Dataloader integration for batching and caching database queries, preventing N+1 problems without manual effort.

The `@ResolveField()` decorator lets you implement field-level resolvers, enabling lazy loading of related entities. Combined with Dataloader, this gives you fine-grained control over query performance.

Guard, interceptor, and pipe support works transparently with GraphQL resolvers, so you reuse your authentication and validation logic. The subscription layer uses WebSockets with built-in pub/sub implementations.

NestJS's GraphQL integration shines for complex APIs with nested entities. The decorators reduce boilerplate, and the module system keeps your schema organized across feature boundaries.
