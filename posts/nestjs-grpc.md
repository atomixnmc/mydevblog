# gRPC with NestJS: Microservices Communication

gRPC provides high-performance, strongly-typed inter-service communication using Protocol Buffers and HTTP/2. NestJS offers first-class gRPC support through its `@nestjs/microservices` transport layer, making it straightforward to build polyglot microservice architectures.

**Setup begins with Protobuf definitions**. NestJS generates TypeScript interfaces from `.proto` files using `ts-proto` or `protoc-gen-ts`. A gRPC service definition like `rpc FindUser (UserById) returns (User)` automatically produces TypeScript types for request and response messages. The `@nestjs/microservices` package handles the server implementation: `@GrpcMethod('UserService', 'FindUser')` decorates a method that NestJS registers as the gRPC handler.

**Dual client/server roles** are natural in NestJS gRPC. A service can expose gRPC endpoints (server) while gRPC-calling other services (client). The `@Client()` decorator or `ClientProxyFactory` creates a gRPC client proxy that marshals TypeScript objects to protobuf messages transparently. NestJS manages connection lifecycle, including reconnection on transport failure.

**Streaming patterns** are where gRPC shines over REST. NestJS supports all four gRPC streaming types: unary (single request, single response), server streaming (single request, response stream), client streaming (request stream, single response), and bidirectional streaming (both streams). A server streaming response is implemented as an RxJS Observable—NestJS subscribes and pushes each emission over the gRPC stream. Bidirectional streaming uses `@GrpcStreamMethod` with RxJS Subject for both directions.

**Interceptors and guards** work transparently across gRPC. The same `@UseGuards(AuthGuard)` and `@UseInterceptors(LoggingInterceptor)` that protect HTTP endpoints also work for gRPC handlers. NestJS normalizes gRPC metadata (headers) into its execution context, so authentication tokens, correlation IDs, and tracing headers flow through the same pipeline regardless of transport.

**Load balancing and discovery**: gRPC's client-side load balancing works with service discovery (Consul, etcd, Kubernetes DNS). NestJS clients can be configured with `loadBalancingConfig: { policy: 'round_robin' }`. For Kubernetes, headless services with DNS-based discovery pair well with gRPC's resolver infrastructure.

The combination of Protocol Buffers' strict typing, HTTP/2's multiplexing, and NestJS's modular architecture creates microservices that are efficient, testable, and maintainable across team boundaries.
