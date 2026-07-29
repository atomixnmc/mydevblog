# Apache Kafka with NestJS

Apache Kafka is the de facto standard for event streaming, and NestJS provides first-class integration through its `@nestjs/microservices` package. Combining them yields a powerful architecture for building event-driven systems with TypeScript.

**Setting up the consumer** starts with registering Kafka as a microservice in the main application. NestJS wraps the `kafkajs` library internally, handling connection management, consumer group coordination, and error recovery. The `@MessagePattern` decorator routes incoming Kafka messages to handler methods, with automatic payload deserialization from the wire format (JSON, Avro, or plain buffers).

**Producer patterns** in NestJS follow the `ClientProxy` abstraction. Inject `ClientProxyFactory` configured for Kafka transport, then call `client.emit(topic, message)` for fire-and-forget events or `client.send(topic, message)` when expecting a reply. The latter maps onto Kafka's request-reply pattern using a reply topic. NestJS manages the correlation ID for matching responses to requests transparently.

**Batch processing** is a first-class concern. NestJS's Kafka microservice supports `@EventPattern` handlers with batch mode, receiving arrays of messages in a single call. This enables efficient processing of high-throughput streams where per-message overhead would be prohibitive. Batching reduces consumer group rebalancing frequency and improves throughput.

**Error handling and retries** leverage Kafka's consumer offset management. NestJS's default behavior commits offsets after successful handler execution. For failed messages, applications can implement dead-letter topics (DLT) by catching exceptions and republishing to a `-dlq` suffixed topic. NestJS's `TransportKafka` options expose the full underlying consumer configuration: `maxRetries`, `retry.backoffMs`, and custom `eachBatchAutoResolve` logic.

**Schema Registry integration** requires manual setup since NestJS doesn't bundle Avro or Protobuf support by default. Plug in `@kafkajs/confluent-schema-registry` with a custom serializer/deserializer that wraps the NestJS transport layer. This ensures schema evolution compatibility across services.

The combination gives NestJS the event-driven backbone needed for microservices architectures, with TypeScript type safety extending from HTTP handlers all the way to the Kafka wire format.
