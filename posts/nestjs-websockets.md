# NestJS WebSocket Gateways

NestJS abstracts WebSocket handling through gateways — decorator-based classes that handle connection lifecycle, events, and message passing. The framework supports multiple transports including Socket.IO, WebSockets (native `ws`), and WS (via `@nestjs/websockets`).

A basic gateway is simple:

```typescript
@WebSocketGateway()
export class ChatGateway {
  @SubscribeMessage('message')
  handleMessage(client: Socket, payload: string): string {
    return `Echo: ${payload}`;
  }
}
```

The `@WebSocketGateway()` decorator registers the gateway. You can configure port, namespace, CORS, and transport options through the decorator or an options object. Namespaces provide logical separation — `/chat` and `/notifications` are independent namespaces on the same server.

Gateways integrate with NestJS dependency injection. You inject services into gateways just like controllers. This means business logic lives in services, not socket handlers. Authentication is handled through guards — `@UseGuards(AuthGuard())` works on gateway methods. Pipes handle validation, and interceptors handle logging or transformation.

The server emits events using the injected `@WebSocketServer()` decorator. For broadcasting to rooms, use `server.to(room).emit()`. The room concept maps directly to Socket.IO rooms for the Socket.IO adapter.

Scaling WebSocket servers requires a shared pub/sub adapter. NestJS provides Redis adapters that synchronize events across multiple server instances. When one server emits to a room, the Redis adapter broadcasts to all servers that have clients in that room.

Error handling follows NestJS conventions. Exception filters catch WebSocket-specific errors. The `WsException` class routes errors back to the client through the error event. Timeouts and heartbeat checks are configurable through the gateway options.
