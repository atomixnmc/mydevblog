# Apache Kafka with NestJS: Building Event-Driven Microservices

Apache Kafka is the de facto standard for event streaming, and NestJS provides first-class integration through its `@nestjs/microservices` package. Combining them yields a powerful architecture for building event-driven systems with TypeScript. I've built production event pipelines processing millions of events per day with this stack — order events streaming through fulfillment, inventory, and shipping services, all orchestrated through Kafka topics. The combination of NestJS's dependency injection, decorator-based routing, and Kafka's durability gives you a foundation that scales from a single service to dozens of microservices.

## Setting Up the Consumer

Registering Kafka as a microservice in NestJS is straightforward but has important configuration choices:

```typescript
// main.ts
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(AppModule, {
    transport: Transport.KAFKA,
    options: {
      client: {
        brokers: ['localhost:9092'],
        clientId: 'order-service',
        retry: { retries: 10, initialRetryTime: 300 },
      },
      consumer: {
        groupId: 'order-consumer-group',
        allowAutoTopicCreation: false,
        maxBytesPerPartition: 1048576,  // 1MB per partition
      },
      run: {
        autoCommit: false,  // Manual commit for better error handling
        eachBatchAutoResolve: false,
      },
    },
  });
  await app.listen();
}
bootstrap();
```

The `client` configuration exposes all underlying KafkaJS options. The `consumer` group ID is critical — it determines offset management and partition assignment. The `run` configuration affects reliability: `autoCommit: false` means you control when offsets are committed, preventing data loss on crashes.

## Message Handlers with @MessagePattern

NestJS wraps the `kafkajs` library internally, handling connection management, consumer group coordination, and error recovery. The `@MessagePattern` decorator routes incoming Kafka messages to handler methods, with automatic payload deserialization:

```typescript
// order.controller.ts
import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';

@Controller()
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @MessagePattern('order.created')
  async handleOrderCreated(@Payload() message: any) {
    // message.value contains the deserialized payload
    // message.key, message.partition, message.offset also available
    const order = message.value;

    await this.orderService.validateOrder(order);
    await this.orderService.updateInventory(order.items);
    await this.orderService.notifyShipping(order);

    return { status: 'processed', orderId: order.id };
  }

  @MessagePattern('order.*')  // Wildcard pattern matching
  async handleAnyOrderEvent(@Payload() message: any) {
    // Matches order.created, order.updated, order.cancelled, etc.
    this.logger.log(`Received order event: ${message.topic}`);
  }
}
```

The wildcard pattern matching (`order.*`, `payment.>`) uses Kafka's built-in topic pattern subscription under the hood. This enables a single handler to process related events — useful for logging, metrics, or cross-cutting concerns.

## Producer Patterns

Producers in NestJS follow the `ClientProxy` abstraction. Inject `ClientProxyFactory` configured for Kafka transport, then use fire-and-forget or request-reply patterns:

```typescript
// order-producer.service.ts
import { Injectable, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';

@Injectable()
export class OrderProducer {
  constructor(
    @Inject('KAFKA_CLIENT') private readonly kafkaClient: ClientProxy,
  ) {}

  async emitOrderCreated(order: OrderDto): Promise<void> {
    // Fire-and-forget: emit event, don't wait for response
    await this.kafkaClient.emit('order.created', {
      key: order.id,  // Partition key for ordering guarantees
      value: order,
      headers: { version: '2.0', source: 'web-api' },
    }).toPromise();
  }

  async requestInventoryCheck(items: LineItem[]): Promise<InventoryResult> {
    // Request-reply: sends a message and waits for a response
    return this.kafkaClient
      .send('inventory.check', { items })
      .toPromise();
  }
}
```

The `client.emit(topic, message)` call is fire-and-forget for events where you don't need acknowledgment. The `client.send(topic, message)` maps onto Kafka's request-reply pattern using a reply topic. NestJS manages the correlation ID transparently — each request gets a unique correlation ID, and the response is matched back using headers on the reply topic.

## Batch Processing

Batch processing is a first-class concern in high-throughput systems. NestJS's Kafka microservice supports `@EventPattern` handlers with batch mode, receiving arrays of messages in a single call:

```typescript
@EventPattern('analytics.pageview', { transport: Transport.KAFKA })
async handlePageViewBatch(@Payload() messages: any[]) {
  // Process hundreds of pageview events in a single transaction
  const events = messages.map(msg => ({
    userId: msg.value.userId,
    url: msg.value.url,
    timestamp: msg.value.timestamp,
  }));

  await this.analyticsService.bulkInsert(events);
  // Commit offsets after successful batch processing
}
```

Batching reduces consumer group rebalancing frequency and improves throughput significantly. In production, I've seen batch processing achieve 10-50x higher throughput than per-message processing, especially for lightweight events like page views, clickstream data, or status updates.

## Error Handling and Dead-Letter Topics

Error handling leverages Kafka's consumer offset management. NestJS's default behavior commits offsets after successful handler execution. For failed messages, dead-letter topics (DLT) are the standard pattern:

```typescript
// Custom error handling with dead-letter topic
@MessagePattern('order.created')
async handleOrderCreated(@Payload() message: any, @Ctx() context: KafkaContext) {
  const consumer = context.getConsumer();
  const { topic, partition, offset } = context.getPartition();

  try {
    await this.processOrder(message.value);
    // Success: commit offset
    await consumer.commitOffsets([{ topic, partition, offset: (parseInt(offset) + 1).toString() }]);
  } catch (error) {
    // Failed: publish to dead-letter topic and commit (skip bad message)
    await this.kafkaClient.emit('order.created.dlq', {
      originalMessage: message.value,
      error: error.message,
      failedAt: new Date().toISOString(),
    }).toPromise();

    // Commit offset to move past the failing message
    await consumer.commitOffsets([{ topic, partition, offset: (parseInt(offset) + 1).toString() }]);
    this.logger.error(`Sent order ${message.value.id} to DLQ: ${error.message}`);
  }
}
```

The dead-letter topic serves as both a quarantine and a diagnostic tool. A separate re-processor service reads from the DLQ and retries with exponential backoff, escalating to manual intervention after 3 failures.

## Schema Registry Integration

Schema Registry integration requires manual setup since NestJS doesn't bundle Avro or Protobuf support by default:

```typescript
import { SchemaRegistry } from '@kafkajs/confluent-schema-registry';

@Injectable()
export class SchemaRegistrySerializer implements Serializer {
  private registry = new SchemaRegistry({
    host: 'http://schema-registry:8081',
    auth: { username: 'key', password: 'secret' },
  });

  async serialize(value: any, options?: Record<string, any>) {
    const schemaId = options?.schemaId;
    if (!schemaId) return value;

    // Encode with schema ID for Avro/Protobuf serialization
    return await this.registry.encode(schemaId, value);
  }
}
```

This ensures schema evolution compatibility across services. When the Order schema adds a field, the Schema Registry tracks the version — consumers can read messages written with older schema versions, and producers can write messages with newer schema versions as long as they maintain backward compatibility.

## Monitoring and Observability

Production Kafka systems need solid observability. Instrument your consumers and producers with consumer lag monitoring (how far behind the producer the consumer is), throughput metrics (messages/second), and error rates per topic-partition. NestJS's interceptors make this straightforward:

```typescript
@Injectable()
export class KafkaMetricsInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const start = Date.now();
    const topic = context.switchToRpc().getContext().getTopic();

    return next.handle().pipe(
      tap({
        next: () => this.metrics.recordSuccess(topic, Date.now() - start),
        error: (err) => this.metrics.recordError(topic, err),
      }),
    );
  }
}
```

Consumer lag is the most important metric — it tells you when your consumers are falling behind and need scaling. I've found that monitoring lag per partition (not just total) is critical, because unbalanced partition assignment can leave one consumer saturated while others are idle.

## Testing Strategies

Testing Kafka-based NestJS applications requires careful mocking. Use Testcontainers embedded Kafka for integration tests that run alongside service tests. For unit tests, mock the `ClientProxy` with a simple in-memory event bus:

```typescript
describe('OrderController', () => {
  let controller: OrderController;
  let service: OrderService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [OrderController],
      providers: [
        OrderService,
        { provide: 'KAFKA_CLIENT', useValue: { emit: jest.fn(), send: jest.fn() } },
      ],
    }).compile();

    controller = module.get(OrderController);
    service = module.get(OrderService);
  });

  it('should process order.created event', async () => {
    const message = { value: { id: '123', items: [...] } };
    await controller.handleOrderCreated(message);
    expect(service.validateOrder).toHaveBeenCalled();
  });
});
```

The combination of NestJS's modular architecture and Kafka's streaming capabilities gives you the foundation for event-driven microservices that are testable, observable, and production-ready. The key is understanding both tools deeply — NestJS's dependency injection and decorator system for clean service boundaries, and Kafka's partitioning, offset management, and retention policies for reliable event streaming.
