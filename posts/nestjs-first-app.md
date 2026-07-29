# Your First NestJS Application

NestJS brings structural patterns from Angular—modules, decorators, dependency injection—to the Node.js ecosystem. After years of Express's "throw it in a folder" architecture, Nest's opinionated structure feels like overkill for small projects and essential for large ones. The onboarding curve is steeper, but the payoff is consistency across services.

A NestJS app starts with modules. Every module declares its controllers, services, and imports. The framework wires dependency injection at module load time, so your services receive their dependencies via constructor injection:

```ts
// user.module.ts
@Module({
  imports: [DatabaseModule],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}

// user.service.ts
@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly repo: Repository<User>,
  ) {}

  async findAll(): Promise<User[]> {
    return this.repo.find();
  }
}

// user.controller.ts
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  @UseGuards(AuthGuard)
  async getAll(): Promise<User[]> {
    return this.userService.findAll();
  }

  @Post()
  @HttpCode(201)
  async create(@Body() dto: CreateUserDto): Promise<User> {
    return this.userService.create(dto);
  }
}
```

Key features that make NestJS stand out:

- **Guards** implement authentication and authorisation logic as injectable classes. They run before route handlers and can return a boolean or throw an `UnauthorizedException`.
- **Pipes** transform and validate input payloads. `ValidationPipe` with `class-validator` decorators (`@IsEmail()`, `@MinLength(8)`) eliminates manual validation boilerplate.
- **Interceptors** wrap request handling to add cross-cutting concerns—logging, caching, response transformation. Think Express middleware with async awareness and RxJS observables.

NestJS supports multiple transports beyond HTTP: WebSocket gateways (`@WebSocketGateway`), microservice transports via TCP/RMQ/Kafka (`@MessagePattern`), and GraphQL via `@Resolver()` decorators. The programming model is consistent regardless of transport.

The CLI (`@nestjs/cli`) generates modules, controllers, and services with spec files. `nest new project-name` scaffolds a project with TypeScript, ESLint, and Jest. The testing setup is first-class—controllers and services are plain classes suitable for unit testing with mock providers.

The trade-off: NestJS's abstraction layer adds startup overhead and a steeper initial learning curve. For a 5-route Express app, it's too much. For a team of 10 building a B2B SaaS platform with 200+ endpoints, the module system prevents the spaghetti that monolithic Express apps inevitably become.
