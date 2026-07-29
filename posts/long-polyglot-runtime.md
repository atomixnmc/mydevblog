# Long Polyglot Runtime

Long is a polyglot runtime that runs JavaScript, Python, Rust, and WebAssembly in the same process. It embeds multiple language engines — Boa (JS), a subset of CPython, and Wasmtime (WASM) — and lets them share memory, call each other's functions, and coordinate on the same event loop.

## Architecture

```
┌─────────────────────────────────────┐
│           Long Runtime              │
│ ┌─────────┐ ┌─────────┐ ┌────────┐ │
│ │ Boa JS  │ │ CPython │ │Wasmtime│ │
│ │  Engine  │ │  Subset  │ │ (Rust) │ │
│ └────┬────┘ └────┬────┘ └────┬───┘ │
│      └──────┬────┘           │      │
│             ▼                │      │
│      Shared Memory (linear)  │      │
└──────────────────────────────┴──────┘
```

![](images/2023/long-polyglot-runtime_img-001.png)

All engines share a contiguous block of linear memory. Boa allocates JS objects here, CPython allocates PyObjects here, and Wasmtime maps WASM linear memory into the same region. Pointers across languages are actual memory addresses — no serialization, no marshaling.

## Cross-Language Calls

```javascript
// JavaScript calls Python
import { python } from 'long:python';
const result = python.run(`
def analyze(data):
    return {"mean": sum(data)/len(data), "count": len(data)}
`);
const stats = result([1, 2, 3, 4, 5]);
```

```python
# Python calls Rust
import long.rust as rust
from long import js

image = js.document.getElementById("canvas")
pixels = rust.process_image(image.data)
```

![](images/2023/long-polyglot-runtime_img-002.png)

The call overhead is about 100ns between any two languages — cheaper than a WASM call boundary in most runtimes. This is because the memory is already shared; cross-language calls just validate the function pointer and jump.

## The Event Loop

Long uses a unified event loop (powered by tokio) that all languages hook into:

```rust
// Rust code using Long's event loop
use long::runtime::spawn;

spawn(async {
    let data = fetch_http("/api/data").await;
    let processed = python::call("process", data).await;
    js::call("render", processed).await;
});
```

![](images/2023/long-polyglot-runtime_img-003.png)

A single `async fn` can span JavaScript, Python, and Rust — each `.await` crossing language boundaries transparently. The event loop schedules all async tasks from all languages on the same thread pool. I/O operations from any language go through tokio's reactor, so you get epoll/kqueue/IOCP regardless of the calling language.

## Memory Safety

Sharing memory across language engines is dangerous — Python's GC could move objects while JS holds a pointer. Long uses pinned GC objects: Boa and CPython agree not to relocate objects that have cross-language references. A reference counting mechanism tracks these pins and unpins them when the cross-language reference is dropped. We've had two segfaults from pinned-object violations in six months — both were our bugs, not architecture flaws. Each was fixed by adding a missing pin decrement path.

## Use Cases

Long targets applications that need mixed-language performance: data pipelines where Python glues Rust kernels together, web services where JavaScript handles the request layer and Rust handles compute, and game servers where Lua (via WASM) scripts call Python AI systems. It's not a replacement for polyglot microservices — it's for cases where the latency of separate processes is unacceptable and a single-process polyglot runtime is the right trade-off.
