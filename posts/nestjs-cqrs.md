# CQRS with NestJS

Command Query Responsibility Segregation (CQRS) separates read and write operations into different models. NestJS provides a dedicated CQRS module (`@nestjs/cqrs`) that implements commands, queries, events, and sagas with decorator-based wiring.

In CQRS, commands mutate state. A command represents an intent to change the system: `CreateOrderCommand`, `UpdateInventoryCommand`. Commands are dispatched to command handlers. Each command handler processes one command type and returns nothing — or an event ID. Queries return data without side effects: `GetOrderQuery`, `FindProductsQuery`. Query handlers retrieve and transform data.

NestJS implements this through a command/query bus:

```typescript
@CommandHandler(CreateOrderCommand)
export class CreateOrderHandler implements ICommandHandler {
  async execute(command: CreateOrderCommand): Promise<void> {
    // validate, mutate, publish events
  }
}
```

Events represent things that happened. After a command handler succeeds, it publishes events: `OrderCreatedEvent`, `InventoryLowEvent`. Event handlers react asynchronously — they may send emails, update read models, or trigger sagas.

Sagas are long-running processes that coordinate multiple commands and events. They listen for events and dispatch new commands based on business rules. An order saga might listen for `OrderCreatedEvent`, wait for `PaymentProcessedEvent`, then dispatch `ShipOrderCommand`.

The read model is optimized for queries. Instead of querying the write database, CQRS maintains a separate read database with pre-joined, denormalized views. Event handlers update these read models. This means writes can be optimized for consistency and reads for speed.

NestJS CQRS integration supports RabbitMQ, Kafka, and other message brokers for distributing commands and events across microservices. The module pattern keeps commands and events organized by feature domain. For complex domains, CQRS brings clarity and scalability that a single-model CRUD approach cannot match.
