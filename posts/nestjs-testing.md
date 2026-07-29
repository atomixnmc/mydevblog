# NestJS Testing

NestJS provides a sophisticated testing infrastructure built on top of the Jest testing framework. The `@nestjs/testing` package includes `Test.createTestingModule()`, which creates an isolated NestJS module for unit and integration tests without starting the HTTP server.

Unit tests focus on individual classes. For controllers and services, you instantiate them directly with mocked dependencies:

```typescript
const service = new UserService(mockUserRepository);
expect(service.findAll()).toEqual(expectedUsers);
```

This is fast — no DI container overhead — and works for pure business logic. For more complex testing, the testing module provides dependency injection with overridden providers.

Integration tests use the full NestJS module. `createTestingModule` accepts the same metadata as `@Module()` — providers, controllers, imports, and exports. You override real providers with mocks using `.overrideProvider()`. The compiled testing module gives you access to any injectable via `module.get()`:

```typescript
const module = await Test.createTestingModule({
  imports: [UserModule],
}).overrideProvider(UserRepository)
  .useValue(mockRepo)
  .compile();
```

End-to-end tests go further by creating a full HTTP server with `createNestApplication()`. You can send real HTTP requests through `supertest` while still controlling provider implementations. This tests the full request pipeline — guards, interceptors, pipes, and exception filters.

Database testing uses test containers or in-memory SQLite. NestJS's `@nestjs/typeorm` or `@nestjs/mongoose` can be configured with test databases. The shutdown hooks ensure clean state between tests.

The testing module supports both JIT and AOT compilation. In development, JIT provides fast iteration. In CI, AOT catches compilation errors. Together, these testing levels give confidence without sacrificing developer velocity.
