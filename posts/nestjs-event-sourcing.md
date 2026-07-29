# Event Sourcing with NestJS

Event sourcing records state changes as an append-only log of events rather than storing current state directly. NestJS's modular architecture and CQRS package provide an excellent foundation for building event-sourced systems in TypeScript.

**The CQRS module** (`@nestjs/cqrs`) provides the building blocks: Commands, Events, Queries, and their corresponding handlers. A command represents an intent (CreateOrder), an event records what happened (OrderCreated), and a query retrieves data without side effects. NestJS's dependency injection wires handlers to their respective commands and events automatically, with the command/event bus acting as the message dispatcher.

**Event store integration**: While NestJS doesn't bundle an event store, it integrates naturally with PostgreSQL (using eventstore tables), MongoDB (document-per-event), or specialized stores like EventStoreDB. The pattern: implement a custom `EventStore` provider that appends events to the store and loads event streams by aggregate ID. Serialization uses class-transformer decorators to map between TypeScript classes and the wire format. A snapshot repository periodically captures aggregate state at specific event versions to avoid replaying the entire stream on every load.

**Aggregate design** follows Domain-Driven Design principles. An aggregate is a class that maintains its state by applying events in sequence. Each command method validates business rules, then pushes new events. The `apply` method adds the event to the pending list, and the `on` method mutates state for each event type: `on(OrderCreated event) { this.status = event.status }`. This ensures state reconstruction exactly matches the event log.

**Projections** (read models) subscribe to events and update denormalized views. NestJS's event handlers decorated with `@EventHandler(OrderCreated)` receive the event from the bus and update the projection database (typically a relational or document store optimized for query efficiency). Multiple projections can consume the same events for different use cases—search indexing, analytics, notification dispatch.

**Sagas** orchestrate long-running processes across aggregates. A saga listens for events and emits commands in response. An order saga: listen for `OrderPlaced`, emit `ReserveInventory`, listen for `InventoryReserved`, emit `ProcessPayment`, listen for `PaymentProcessed`, emit `ConfirmOrder`. Sagas can handle compensation: if payment fails, emit `CancelOrder`. NestJS's saga implementation uses RxJS observables for event stream processing.

Event sourcing with NestJS provides auditability (every state change is recorded), temporal queries (reconstruct state at any point in time), and natural integration with CQRS patterns. The tradeoffs are event store management, schema evolution complexity, and the learning curve of event-driven thinking.
