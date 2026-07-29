# NestJS DI Container

NestJS's dependency injection (DI) container is inspired by Angular's DI system. It's a hierarchical, decorator-driven container that manages object creation, lifecycle, and wiring throughout the application.

At the core is the `@Injectable()` decorator. Any class decorated with `@Injectable()` is registered in the DI container. The container can inject instances of that class wherever it's declared as a dependency. Classes are typically provided in `@Module()` decorators:

```typescript
@Module({
  providers: [UserService],
  controllers: [UserController],
})
export class UserModule {}
```

The controller declares `UserService` as a constructor parameter. NestJS resolves the dependency by looking up `UserService` in the container, instantiating it if needed, and injecting it.

Providers can be values, classes, or factories. The standard class provider creates a new instance. A factory provider lets you control instantiation — useful for conditional logic or external configuration:

```typescript
{
  provide: 'CONFIG',
  useFactory: () => loadConfig(),
}
```

The DI hierarchy mirrors the module graph. Each module has its own injector that can resolve providers from its own list and from imported modules. Modules that export providers make them available to importing modules. This scoping prevents unintended coupling — a service in the AuthModule doesn't accidentally leak into the UserModule unless explicitly exported.

NestJS supports three injection scopes. DEFAULT (singleton, shared across all consumers). REQUEST (new instance per incoming HTTP request). TRANSIENT (new instance per injection). Request-scoped providers are useful for tenant-aware services in multi-tenant applications.

The DI container handles circular dependencies through `forwardRef()`. When two classes depend on each other, both use `@Inject(forwardRef(() => OtherClass))` in their constructors. This breaks the circular resolution at compile time.

Understanding the DI container is essential for effective NestJS development. It powers everything from simple CRUD services to complex inter-module orchestration.
