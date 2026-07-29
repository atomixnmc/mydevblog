# Node.js Clustering: Scaling Across Cores

Node.js runs on a single thread by default. Your powerful 16-core server idles 15 cores while one core handles all requests. The `cluster` module fixes this by forking worker processes that share the same server port. Understanding how cluster works—and its pitfalls—is essential for any production Node.js deployment.

The master process listens on a port and distributes incoming connections to workers using a round-robin algorithm (on Linux/macOS) or the OS's accept-delegate (on Windows). Each worker is a full Node.js process with its own event loop, memory space, and module cache.

```js
const cluster = require('cluster');
const http = require('http');
const numCPUs = require('os').cpus().length;

if (cluster.isMaster) {
  console.log(`Master ${process.pid} is running`);

  // Fork workers
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  // Restart dead workers
  cluster.on('exit', (worker, code, signal) => {
    console.log(`Worker ${worker.process.pid} died. Restarting...`);
    cluster.fork();
  });
} else {
  // Worker process - handles HTTP requests
  http.createServer((req, res) => {
    res.writeHead(200);
    res.end('Hello from worker ' + process.pid);
  }).listen(8000);

  console.log(`Worker ${process.pid} started`);
}
```

**Key considerations:**

- **Stateless design is mandatory**. Shared state (in-memory caches, session data) won't work across workers. Use Redis or Memcached for shared state.
- **Graceful shutdown**. On `SIGTERM`, the master should stop accepting new connections from workers and let them drain existing requests before killing them. Use `worker.disconnect()` and a timeout.
- **Zero-downtime restart**. The master can fork new workers before killing old ones, rolling restarts without dropping requests. `pm2` handles this with `pm2 reload app.js`.
- **`maxMemoryRestart`**. Workers accumulate memory over time due to module caches and unreclaimed references. Restart workers when memory exceeds a threshold.

```js
// Worker health monitoring
const used = process.memoryUsage().heapUsed / 1024 / 1024;
if (used > 500) process.exit(0); // Master will fork a replacement
```

Cluster is not a silver bullet. CPU-bound work blocks the worker's event loop, so offload that to worker threads (`worker_threads` module) within each cluster worker, or to a separate service entirely. For I/O-bound workloads (typical web apps), cluster scales near-linearly with core count.

PM2, the Node.js process manager, wraps cluster with zero-downtime reloads, log management, and monitoring. It's worth using in production over raw `cluster` for the operational features alone.
