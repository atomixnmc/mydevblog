# Backpressure in Node.js

Backpressure is the mechanism by which a data consumer signals to a producer that it cannot keep up, preventing buffer overflow and memory exhaustion. In Node.js, backpressure is built into streams but often handled implicitly, leading to memory issues in high-throughput applications.

Node.js streams implement backpressure through the `highWaterMark` and `drain` events. When a `Writable` stream's internal buffer exceeds `highWaterMark` (default 16KB), `write()` returns `false`. The producer must stop writing until the `drain` event fires:

```javascript
function writeData(writer, data) {
  if (!writer.write(data)) {
    writer.once('drain', () => writeData(writer, data));
  }
}
```

The `pipe()` method manages this automatically — it handles `drain` events and pauses/resumes readable streams. But when you bypass `pipe()` for custom processing, backpressure becomes your responsibility.

Common backpressure failures include: reading an entire file into memory before processing, collecting all database query results before emitting, and accumulating WebSocket messages in memory faster than the client can consume them. Each case eventually causes an `ERR_OUT_OF_MEMORY` crash.

The `Readable` stream API supports backpressure through `push()` and `read()`. A readable stream's `_read()` method is only called when the buffer is below `highWaterMark`. This creates backpressure from the readable side too — if a transform stream doesn't consume fast enough, the readable pauses.

HTTP request/response bodies are streams. When a client sends data faster than you process it, `req` (Readable) applies backpressure to the socket. When you send a response slower than the client reads, `res` (Writable) applies backpressure to your writing code.

For high-throughput systems, monitor `writableLength` and use `cork()`/`uncork()` for batch writes. The `stream/promises` API (Node 15+) provides `finished()` and `pipeline()` as promise-based backpressure-aware utilities. Proper backpressure handling is the difference between a server that degrades gracefully and one that crashes under load.
