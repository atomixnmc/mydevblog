# Node.js Event Loop and libuv: A Deep Dive

Every Node.js developer knows the event loop is what makes async I/O work, but the moment you ask "what order do these `setTimeout` and `Promise` callbacks actually run in?" the room goes quiet. Understanding the six phases of libuv's event loop is the difference between guessing and knowing — and in production debugging, guessing is expensive. I once spent three days tracking down a production bug where `process.nextTick` was deferring a critical database write long enough that a subsequent request read stale data. The fix was a single line change once I understood the microtask timing, but finding that root cause required tracing through libuv's source code.

## The Six Phases of the Event Loop

The loop runs in phases, each with its own queue of callbacks to drain. Understanding this ordering is the foundation of everything else:

```
   ┌───────────────────────────┐
┌─>│           timers          │
│  └─────────────┬─────────────┘
│  ┌─────────────┴─────────────┐
│  │     pending callbacks     │
│  └─────────────┬─────────────┘
│  ┌─────────────┴─────────────┐
│  │       idle, prepare       │
│  └─────────────┬─────────────┘
│  ┌─────────────┴─────────────┐
│  │           poll            │
│  └─────────────┬─────────────┘
│  ┌─────────────┴─────────────┐
│  │           check           │
│  └─────────────┬─────────────┘
│  ┌─────────────┴─────────────┐
│  │      close callbacks      │
│  └─────────────┬─────────────┘
└──────────────────────────────┘
```

**Timers** phase: `setTimeout` and `setInterval` callbacks whose threshold has expired execute here. Importantly, the timer threshold is a *minimum* delay — if the event loop is busy with other phases when a timer expires, the callback waits until the next timer phase iteration.

**Pending callbacks** phase: I/O callbacks deferred to the next loop iteration. This includes error callbacks from some system operations (like `UV_EAGAIN` on TCP writes).

**Idle/Prepare** phase: Internal libuv housekeeping. `setImmediate` callbacks are *not* here — they're in the check phase.

**Poll** phase: The most important phase. This is where I/O callbacks are executed (your `fs.readFile` completion, incoming TCP data). If no callbacks are pending, the poll phase calculates the timeout to wait for new I/O events — bounded by the nearest timer expiration.

**Check** phase: `setImmediate` callbacks fire here, immediately after poll completes. This is why `setImmediate` is named what it is — it runs "immediately" after I/O processing.

**Close callbacks** phase: Cleanup for closed handles (e.g., `socket.on('close')`).

```javascript
const fs = require('fs');

fs.readFile(__filename, () => {
  setTimeout(() => console.log('timeout'), 0);
  setImmediate(() => console.log('immediate'));
});
// Output: immediate, then timeout
//
// In the poll phase, the fs callback runs.
//   - setTimeout schedules for the timer phase (next iteration)
//   - setImmediate schedules for the check phase (same iteration, right after poll)
// The check phase runs before the next timer phase.
```

The "immediate before timeout" behavior inside I/O callbacks is deterministic. Outside I/O (in the main module or a top-level timer), the order is unpredictable because the event loop's initial entry may run timers before check, or vice versa.

## Microtasks: The Phase Interrupters

The twist that catches most developers is **microtasks**. `process.nextTick` and Promise `.then` callbacks run between every phase, not inside them. They don't belong to any single phase — they're queues that are drained after each phase completes, before moving to the next:

```javascript
setTimeout(() => {
  console.log('timer 1');
  Promise.resolve().then(() => console.log('promise inside timer'));
  process.nextTick(() => console.log('nextTick inside timer'));
}, 0);

setTimeout(() => console.log('timer 2'), 0);

// Output:
// timer 1
// nextTick inside timer
// promise inside timer
// timer 2
```

`process.nextTick` has its own queue (the `nextTickQueue`) that's drained *after* each phase completes. Promise microtasks (the `microTaskQueue`) also run between phases. The order is: nextTick queue first, then microtask queue. This is why `process.nextTick` is called a "microtask with priority" — it runs before Promise callbacks.

```javascript
process.nextTick(() => console.log('nextTick 1'));
Promise.resolve().then(() => console.log('promise 1'));
process.nextTick(() => console.log('nextTick 2'));

// Output:
// nextTick 1
// nextTick 2
// promise 1
```

## The Starvation Problem

`process.nextTick` can starve I/O if you call it recursively — it prevents the loop from ever reaching the poll phase:

```javascript
let count = 0;
const starve = () => {
  if (++count > 10000) return;
  process.nextTick(starve); // Re-queues before poll phase ever runs
};
starve();
setTimeout(() => console.log('This runs after 10,000 nextTick calls'), 1);
```

The 10,000 `process.nextTick` calls all execute before the event loop can check timers or process I/O. Node.js enforces a hard limit of 1e6 for `process.nextTick` depth (`process.maxTickDepth`), after which it emits a warning. This is why Node.js documentation recommends `setImmediate` for "next iteration" scheduling that shouldn't block I/O — `setImmediate` sits in the check phase, which only runs after poll gives the event loop a chance to handle I/O.

## Libuv's Thread Pool

Libuv's thread pool (default 4 threads) handles operations the OS can't do asynchronously — `fs` operations, `dns.lookup`, some `crypto` operations. These run on worker threads, and their callbacks enter the poll phase when complete:

```
Main Thread                  Thread Pool
   │                            │
   │── fs.readFile ────────────►│
   │                            │── read from disk
   │                            │◄── complete
   │◄── callback to poll phase  │
```

You can increase the thread pool size with `UV_THREADPOOL_SIZE=8`. This helps when you have many concurrent file operations or CPU-bound crypto tasks. But it's not free — more threads mean more context switching. The default of 4 is tuned for typical web server workloads.

```javascript
const crypto = require('crypto');
const start = Date.now();

// Default thread pool: 4 threads → first 4 callbacks arrive together
for (let i = 0; i < 8; i++) {
  crypto.pbkdf2('password', 'salt', 100000, 64, 'sha512', () => {
    console.log(`Done in ${Date.now() - start}ms`);
  });
}
// With 4 threads: batch 1 (4 callbacks at ~150ms), batch 2 (4 callbacks at ~300ms)
// With UV_THREADPOOL_SIZE=8: all 8 callbacks at ~150ms
```

## Async/Await Under the Hood

`async/await` is syntactic sugar over Promises, but the way it interacts with the event loop matters for performance. Each `await` creates a microtask continuation:

```javascript
async function process() {
  console.log('1');  // Synchronous

  await delay(100); // Creates a microtask continuation

  console.log('2');  // Microtask, after the promise resolves
}

// Equivalent to:
function process() {
  console.log('1');
  return delay(100).then(() => console.log('2'));
}
```

In a hot path with many await calls, each one creates a microtask that must resolve before nextTick callbacks in the same phase — but before the next phase. This is usually fine, but in a tight loop with thousands of sequential awaits, you're paying for promise allocation and microtask scheduling each time.

```javascript
// This creates and resolves N promises synchronously
async function slowLoop(items) {
  const results = [];
  for (const item of items) {
    // Each await creates a microtask continuation
    results.push(await processItem(item));
  }
  return results;
}

// Better: let all operations run concurrently
async function fastLoop(items) {
  return Promise.all(items.map(item => processItem(item)));
}
```

## Real-World Debugging Story

I had a production Node.js service that processed webhook events. Under load, the service would periodically pause for 200-500ms. The logs showed that `setTimeout(fn, 100)` callbacks would fire at 300-600ms. The root cause: a legacy middleware used `process.nextTick` in a loop over an array that sometimes had 50,000+ items. Each iteration called `process.nextTick` to "yield control," but it actually queued 50,000 callbacks that had to drain before any timer could fire. The fix was replacing `process.nextTick` with `setImmediate` — the timers then fired within expected bounds because `setImmediate` callbacks run in the check phase, allowing timer phase execution between iterations.

## The uv_run Function

If you look at libuv's source code (`src/unix/core.c`), the `uv_run` function implements this phase logic:

```c
int uv_run(uv_loop_t* loop, uv_run_mode mode) {
  int r = 0;
  while (r != -1 && loop->stop_flag == 0) {
    uv__update_time(loop);           // Cache current time
    uv__run_timers(loop);            // Timer phase
    uv__run_pending(loop);           // Pending callbacks
    uv__run_idle(loop);              // Idle/prepare
    uv__run_prepare(loop);

    timeout = uv__next_timeout(loop);
    uv__io_poll(loop, timeout);      // Poll phase — waits for I/O
    uv__run_check(loop);             // Check phase (setImmediate)
    uv__run_closing_handles(loop);   // Close callbacks

    if (mode == UV_RUN_ONCE) {
      uv__update_time(loop);
      uv__run_timers(loop);
    }

    r = uv__loop_alive(loop);
  }
  return r;
}
```

The `uv__next_timeout` function calculates how long to wait in the poll phase by looking at the nearest timer. If no timers or I/O are pending, the loop exits. This is the code that determines whether your Node.js process stays alive or exits.

## Practical Implications

Knowing the event loop phase order changes how you debug and design Node.js applications. Use `setImmediate` when you want to defer work to the next event loop iteration without blocking I/O. Avoid `process.nextTick` for anything beyond a single deferral — it blocks other phases. Keep promise chains shallow in hot paths. And always remember: the event loop is your friend when you respect its phases, but it will expose every assumption you make about execution order. Understanding libuv isn't academic — it's the difference between wondering why your timer is 500ms late and knowing exactly where to look.
