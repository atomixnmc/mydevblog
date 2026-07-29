# Node.js Event Loop and libuv: A Deep Dive

Every Node.js developer knows the event loop is what makes async I/O work, but the moment you ask "what order do these `setTimeout` and `Promise` callbacks actually run in?" the room goes quiet. Understanding the six phases of libuv's event loop is the difference between guessing and knowing.

The loop runs in phases: **timers**, **pending callbacks**, **idle/prepare**, **poll**, **check**, and **close callbacks**. Each phase has a queue of callbacks to drain. `setTimeout` and `setInterval` fire in the timer phase (for timers whose threshold has expired). I/O callbacks—your `fs.readFile` completion—fire in the poll phase. `setImmediate` fires in the check phase, which runs immediately after poll.

```js
const fs = require('fs');

fs.readFile(__filename, () => {
  setTimeout(() => console.log('timeout'), 0);
  setImmediate(() => console.log('immediate'));
});
// Output: immediate, then timeout
// In the poll phase, the fs callback runs.
// setImmediate schedules for check (next).
// setTimeout schedules for timer (next iteration).
```

The twist is **microtasks**. `process.nextTick` and Promise `.then` callbacks run between every phase, not inside them. `process.nextTick` has its own queue that's drained *after* each phase completes, before moving to the next. This is why `process.nextTick` can starve I/O if you call it recursively—it prevents the loop from ever reaching the poll phase.

```js
let count = 0;
const starve = () => {
  if (++count > 10000) return;
  process.nextTick(starve); // Blocks I/O until count reaches limit
};
starve();
setTimeout(() => console.log('Never runs?'), 1);
```

Libuv's thread pool (default 4 threads) handles operations the OS can't do asynchronously—`fs`, `dns.lookup`, some `crypto` operations. These run on worker threads, and their callbacks enter the pending or poll phases when complete. That's why CPU-bound Node.js operations block the event loop: they're running synchronously in the main thread or saturating the thread pool.

Knowing the phase order explains the common `setImmediate` vs `setTimeout(fn, 0)` behaviour and why `process.nextTick` is called a "microtask with priority." It's not speculation—it's the libuv source code.
