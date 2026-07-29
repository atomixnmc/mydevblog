# RabbitMQ in NestJS

NestJS integrates with RabbitMQ through the `@nestjs/microservices` package, enabling message-driven microservice architectures with minimal boilerplate. The framework supports both RPC-style request-response and event-based pub-sub patterns.

Configuration uses the `ClientsModule` for producers and `@MessagePattern()` decorators for consumers:

```typescript
// Producer
@Client({
  transport: Transport.RMQ,
  options: {
    urls: ['amqp://localhost:5672'],
    queue: 'tasks_queue',
  },
})
private client: ClientProxy;

// Consumer
@MessagePattern({ cmd: 'process_task' })
async handleTask(data: TaskDto): Promise<Result> {
  return this.taskService.process(data);
}
```

NestJS handles connection management, reconnection, and channel multiplexing automatically. The client proxy returns Observables, so you can compose message responses with RxJS operators. Timeouts and retries are configurable through RabbitMQ options or decorators.

The RabbitMQ transport supports multiple exchange types. Direct exchanges route messages to queues bound with matching routing keys. Topic exchanges pattern-match routing keys with wildcards. Fanout exchanges broadcast to all bound queues. NestJS's microservice module configures these through the transport options:

```typescript
options: {
  exchange: 'task_exchange',
  exchangeType: 'topic',
  routingKey: 'task.*',
}
```

Dead letter queues handle message failures. When a consumer rejects a message or throws an error, NestJS publishes the message to a configured dead letter exchange. This prevents message loss while allowing separate monitoring and reprocessing pipelines.

Scaling NestJS RabbitMQ consumers uses competing consumers pattern. Multiple instances listen on the same queue — RabbitMQ balances message delivery across instances. NestJS's microservice module supports this natively through prefetch count configuration.

For complex workflows, NestJS integrates RabbitMQ with its CQRS module. Commands map to RPC messages, events map to pub-sub messages. This creates a clean architecture where services communicate through well-defined message contracts without direct HTTP coupling.
