# Long Polyglot Design

Long is a polyglot runtime that runs JavaScript, Python, Rust, and WebAssembly side-by-side. This post covers the design decisions that make Long different from other polyglot systems — why it exists, what it trades off, and how it reconciles languages with fundamentally different semantics.

## Design Principles

**Shared memory, not serialized messages.** Cross-language communication goes through linear memory that all engines map into their address space. No JSON serialization, no Protobuf marshaling, no shared-nothing message queues. Pointers are real addresses. This is the single most important design decision — it makes cross-language calls 100-1000x faster than IPC-based polyglot systems.

**One event loop.** All languages share a single async runtime (tokio). A single async function can span Rust, Python, and JavaScript — each `.await` crosses language boundaries transparently. This prevents the "callback hell of polyglot coordination" that plagues language-agnostic runtimes.

**Gradual typing.** LongIR (the intermediate representation) supports optional type annotations. JavaScript's dynamic types degrade to boxed values with runtime type checks. Python is dynamically typed but PyPy-style type hints are preserved where possible. Rust types are fully preserved.

## Language Integration Semantics

Each language pair has specific integration semantics:

**JS ↔ Rust**: JavaScript calls Rust functions through a V8-compatible API wrapper. Rust functions exposed as `#[long::export]` are callable from JavaScript with automatic type conversion (JS `number` ↔ Rust `f64`, JS `BigInt` ↔ Rust `i64`, JS `ArrayBuffer` ↔ Rust `&[u8]`).

**Python ↔ Rust**: Python calls Rust through a PyO3-compatible layer. The subset of CPython in Long exposes the same calling convention as PyO3. Rust functions receive Python objects and can return Python objects or native types.

**JS ↔ Python**: The most interesting bridge. JavaScript objects are proxied to Python as PyObject-like handles. Python objects are proxied to JavaScript as Proxy objects. Property access and method calls cross the bridge transparently:

```javascript
// JavaScript creates a Python dict
const dict = python.eval("{'key': 'value', 'nested': {'a': 1}}");
console.log(dict.key);   // "value"
dict.newAttr = 42;       // Set Python attribute from JS
```

The proxy overhead is about 100ns per property access. For hot paths (tight loops accessing Python objects from JS), we recommend extracting the values to native types first.

## Memory Management

Different languages have different GC models. Long reconciles them:

- **JavaScript (Boa)**: Mark-and-sweep GC. Boa handles its own objects.
- **Python (CPython subset)**: Reference counting with cycle detector. Long's Python shim preserves reference counting semantics.
- **Rust**: No GC. Rust objects are either stack-allocated or explicitly freed. Rust objects shared with JS/Python are RC-wrapped.
- **WASM (Wasmtime)**: Linear memory managed by the WASM module. WASM can share buffers with JS/Python through `Memory::as_slice()`.

Cross-language references track the GC state of both languages. A Python object held by JavaScript increments Python's reference count and prevents cycle collection. A JavaScript object held by Rust pins Boa's GC (preventing relocation).

## What Long Is Not

Long is not a browser runtime. It doesn't implement the DOM, Web APIs, or browser security models. JavaScript in Long runs in a headless environment — `document`, `window`, `fetch`, and `WebSocket` are implemented as optional modules, not built-ins.

Long is not a replacement for Node.js or Deno. It's slower for pure JavaScript workloads (Boa is 4x slower than V8). Long's value is polyglot integration, not peak JS performance.

Long is not a sandbox. All languages in Long share the same process and the same address space. A segfault in Rust can crash the entire runtime. Long assumes the code running in it is either trusted or sandboxed at the process level (via WASM with its own sandboxing, which Long does support).

## Who Should Use Long

Teams that need Python libraries, Rust performance, and JavaScript ergonomics in the same application. Data science pipelines where Python does preprocessing, Rust does heavy computation, and JavaScript serves the results. Game servers where Lua scripts call Python AI systems. Real-time systems where the latency of inter-process communication is unacceptable.

Long trades per-language peak performance for cross-language integration speed. If your bottleneck is pure computation in one language, use that language natively. If your bottleneck is moving data between languages, Long is purpose-built for you.