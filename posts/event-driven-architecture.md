# Event-Driven Architecture: Patterns for Decoupled Systems

Event-driven architecture (EDA) replaces direct service-to-service calls with event production and consumption. Instead of "Service A calls Service B's API", the pattern is "Service A publishes an event; whoever cares about it subscribes and reacts." This decoupling is the foundation of scalable, resilient systems.

The core components are: **event producers**, **event channels** (message brokers), and **event consumers**. Events are facts—something happened (past tense). They're immutable, ordered (within a partition), and self-describing. A broker like Kafka, RabbitMQ, or NATS stores events durably and delivers them to consumers.

```js
// Producer: an event is a fact that happened
const event = {
  type: 'order.placed',
  version: 1,
  id: uuid(),
  timestamp: new Date().toISOString(),
  data: {
    orderId: 'ord_1234',
    userId: 'usr_5678',
    items: [{ sku: 'ABC', qty: 2, price: 1499 }],
    total: 2998,
  },
  metadata: {
    traceId: 'trace_xyz',
    producer: 'order-service',
  },
};

await broker.publish('orders', event);
```

**Event sourcing** takes this further: instead of storing the current state, store the sequence of events and derive state by replaying them. This gives you an audit log, temporal queries ("what did the system look like on Tuesday?"), and the ability to reconstruct state after bugs.

```js
// Derive current order state from events
function applyEvents(events) {
  return events.reduce((state, event) => {
    switch (event.type) {
      case 'order.placed':   return { ...state, status: 'placed', items: event.data.items };
      case 'payment.received': return { ...state, status: 'paid' };
      case 'order.shipped':  return { ...state, status: 'shipped', tracking: event.data.tracking };
      case 'order.cancelled': return { ...state, status: 'cancelled' };
      default: return state;
    }
  }, { status: 'pending' });
}
```

**Common pitfalls** I've encountered:

- **Event schema evolution**. Events live forever. Add fields with defaults, use schema registries (Avro, Protobuf), and never remove fields.
- **Exactly-once semantics**. It's nearly impossible in distributed systems. Design for idempotent consumers that tolerate duplicates.
- **Orphaned events**. A service publishes an event, then crashes before updating its database. Use the Outbox pattern: write events to the same database transaction as your domain data.
- **Debugging**. Event flows are harder to trace than request/response. Invest in event-logging infrastructure early—event-type dashboards, replay tools, and correlation IDs.

EDA shines for cross-cutting concerns (auditing, analytics, notifications) where you'd otherwise add coupling. For simple CRUD, direct HTTP calls are simpler and fine. Don't introduce events until you have more than one consumer per event type.
