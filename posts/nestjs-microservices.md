# NestJS Microservices: Transport Strategies Compared

NestJS provides a first-class microservice abstraction that decouples your application logic from the transport layer. The same handler can serve HTTP, TCP, Redis, RabbitMQ, Kafka, or gRPC clients with minimal code changes. The choice of transport shapes your deployment topology, reliability guarantees, and operational complexity.

The architecture is consistent: a `@Controller` or `@Injectable` service defines message patterns with `@MessagePattern()`. A client proxy sends messages to these patterns. The transport layer handles serialisation, delivery, and response routing.

```ts
// Service - listens for incoming messages
@Controller()
export class OrderService {
  @MessagePattern({ cmd: 'create_order' })
  async createOrder(@Payload() dto: CreateOrderDto): Promise<Order> {
    const order = await this.ordersRepo.create(dto);
    // Could also publish event for other services
    this.client.emit('order_created', { orderId: order.id });
    return order;
  }
}

// Client - sends message to the service
@Injectable()
export class OrderClient {
  constructor(
    @Inject('ORDER_SERVICE') private client: ClientProxy,
  ) {}

  async placeOrder(dto: CreateOrderDto): Promise<Order> {
    return this.client.send({ cmd: 'create_order' }, dto).toPromise();
  }
}
```

**Transport comparison**:

| Transport | Best For | Reliability | Setup Overhead |
|---|---|---|---|
| TCP | Internal service clusters | In-memory, no persistence | Minimal |
| Redis pub/sub | Lightweight event streaming | No persistence, at-most-once | Low |
| RabbitMQ | Durable message queues | Persistent, at-least-once | Medium |
| Kafka | Event sourcing, log processing | Persistent, ordered partitions | High |
| gRPC | Type-safe, low-latency RPC | Connection-based | Medium |

**Hybrid apps** combine transports: HTTP for external REST APIs, RabbitMQ for internal command/event flows, and Redis for real-time pub/sub. NestJS supports this through `@nestjs/microservices` with `ClientProxyFactory`:

```ts
// Main app listens on HTTP + subscribes to RabbitMQ
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.connectMicroservice({
    transport: Transport.RMQ,
    options: {
      urls: ['amqp://localhost:5672'],
      queue: 'orders_queue',
    },
  });
  await app.startAllMicroservices();
  await app.listen(3000);
}
```

**Distributed tracing** becomes essential with microservices. NestJS supports `@nestjs/microservices` with correlation IDs via the `Context` object. Custom interceptors propagate trace IDs across transport boundaries. Without this, debugging an order failure across 4 services takes hours instead of minutes.

The biggest operational lesson I've learned: start with a single transport (RabbitMQ for production, TCP for local dev) and only add others when a specific use case demands it. Every additional transport adds deployment complexity, monitoring surface, and failure modes.
