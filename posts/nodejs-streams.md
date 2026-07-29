# Node.js Streams and Backpressure: Mastering Data Flow

Node.js streams are the most misunderstood power tool in the runtime. They're not just about reading files line-by-line—they're about transforming data with bounded memory, handling backpressure to prevent resource exhaustion, and building pipelines that compose like Unix pipes.

At their core, streams are **EventEmitter** instances with four fundamental types: `Readable`, `Writable`, `Transform`, and `Duplex`. The magic is in the **flow control**. When a `Readable` pushes data faster than a `Writable` can consume, backpressure kicks in: `write()` returns `false`, and the `drain` event fires when it's safe to write again.

```js
const { Transform, pipeline } = require('stream');

// A transform stream that upper-cases with backpressure awareness
const upperCase = new Transform({
  transform(chunk, encoding, callback) {
    // chunk is a Buffer; process and push result
    this.push(chunk.toString().toUpperCase());
    callback();
  },
  highWaterMark: 16 * 1024  // 16KB internal buffer
});

// Pipeline handles backpressure, errors, and cleanup
pipeline(
  process.stdin,
  upperCase,
  process.stdout,
  (err) => { if (err) console.error('Pipeline failed:', err); }
);
```

The `highWaterMark` controls the internal buffer size. When the buffer exceeds this, backpressure propagates upstream. In `objectMode`, it's a count (default 16 objects). In buffer mode, it's bytes (default 16KB). Tuning this value for your data shape prevents memory blow-up on large datasets.

**Flowing vs paused modes** trip everyone up. In flowing mode (pipe, 'data' event listener), data flows automatically. In paused mode (no listener), you must call `read()` explicitly. Adding a 'data' listener switches to flowing mode automatically; removing it does NOT pause—you must call `stream.pause()` explicitly.

For production use, prefer `pipeline()` over manual `pipe()` calls because pipeline properly destroys the stream chain on error. Before Node 10, stream errors could silently leak file handles; pipeline closes that gap.

Streams shine for: large CSV/JSON parsing, log processing, HTTP response streaming, and any transformation where the data set exceeds available memory. If you're loading a 2GB file into a string, you're doing it wrong.
