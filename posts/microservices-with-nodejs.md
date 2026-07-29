# Microservices Patterns with Node.js

Building microservices in Node.js is popular because the runtime's async I/O matches the I/O-bound nature of service communication. But the real engineering challenge isn't the framework—it's the patterns for service discovery, resilience, and observability.

The typical stack starts with a lightweight HTTP framework like Fastify or a messaging layer built on AMQP (RabbitMQ) or NATS. The choice between HTTP and message queues shapes your reliability profile. HTTP is simpler for CRUD; message queues enable event-driven workflows with backpressure and delivery guarantees.

Here's a minimal service using Fastify with health checks and graceful shutdown:

```js
const fastify = require('fastify')({ logger: true });

fastify.get('/users/:id', async (request, reply) => {
  const { id } = request.params;
  // Query service database
  return { id, name: 'Alice', email: 'alice@example.com' };
});

fastify.get('/health', async () => ({ status: 'ok', timestamp: Date.now() }));

const start = async () => {
  await fastify.listen({ port: 3001 });
  process.on('SIGTERM', async () => {
    await fastify.close();
    process.exit(0);
  });
};
start();
```

Key patterns I've learned the hard way:

- **Circuit breakers** with `opossum` prevent cascading failures when a downstream service is slow or down. Set failure thresholds and recovery timeouts.
- **Correlation IDs** passed via HTTP headers or message properties let you trace a request across 10+ services. Without them, debugging is hopeless.
- **Idempotency keys** on mutation endpoints prevent duplicate processing when clients retry. Store the key + response in Redis with a TTL.
- **Health check endpoints** (`/health`, `/ready`) let orchestrators (Kubernetes, Nomad) distinguish between "alive" and "ready to serve traffic."

Containers and orchestration solve deployment, but they don't solve data consistency. For transactions spanning services, consider the Saga pattern (choreographed or orchestrated) rather than distributed transactions. Each service publishes events; compensating actions roll back partial failures.

Node.js scales well horizontally for I/O-bound work, but if your service is CPU-heavy (image processing, encryption), offload that to worker threads or a dedicated service. Don't block the event loop on data transformation.
