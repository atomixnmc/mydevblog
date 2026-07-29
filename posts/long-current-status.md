# Long Current Progress

Long in 2026 is pre-alpha — functional, used internally, but not ready for general release. Here's the state of things.

## What Works

**Polyglot execution**: JavaScript (Boa), Python (CPython subset), and Rust (native modules) run in the same process with shared memory. Cross-language calls work with 100ns overhead. The polyglot design is validated — it's usable and stable for moderate-sized applications.

**Standard modules**: HTTP client (reqwest), JSON (simd-json), crypto (ring), filesystem (tokio::fs), time, UUID, compression, and SQL (sqlx with Postgres/MySQL/SQLite). All modules are callable from all three languages with consistent APIs.

**Dataflow system**: The v0.3 dataflow system (declarative DAGs with backpressure) is working. We use it internally for sensor processing pipelines. Throughput is 10M events/second for a 5-node pipeline (processing pipeline, not storage) on a single machine (16 cores, 32GB RAM). The dataflow system processes events faster than our Kafka-based predecessor — the bottleneck moved from the processing nodes to the input source.

**Module resolution**: npm packages (pure JS) and PyPI packages (pure Python) resolve correctly. The npm resolver follows Node.js module resolution semantics. The PyPI resolver handles wheel packages that don't require C compilation.

## What's In Progress

**JIT compiler for Boa**: Long's JavaScript is 4x slower than V8 because Boa is a bytecode VM. We're adding a JIT via Cranelift that targets the most common execution paths — loops, hot functions, property access on monomorphic objects. Early benchmarks show 2x improvement on Octane. The JIT should be ready by v0.4.

**LongIR optimizer**: The intermediate representation optimizer is half-done. Basic passes (dead code elimination, constant folding, type specialization) work. Advanced passes (inlining, loop unrolling, vectorization) are in development. The type specialization pass currently covers 60% of variables in typical JS code — we'd like it to reach 80% before release.

**Python web framework compat**: FastAPI and Flask don't work yet — they need thread-per-request semantics that conflict with Long's async runtime. We're implementing an adapter layer that spawns virtual threads (tokio tasks) for each request, making the async→sync bridge transparent. The adapter is functional for basic endpoints but fails on advanced FastAPI features (dependency injection with sub-dependencies, background tasks). We expect this to be resolved by v0.5.

## What's Not Started

**Windows support**: Long runs on Linux and macOS. Windows support is planned but not started — the Boa engine and Wasmtime compile on Windows, but the shared memory mmap layer needs porting. We're not targeting Windows until v0.6.

**WASM build**: A version of Long that runs in the browser (via WASM). This would enable polyglot frontend code. The technical challenges: running Boa inside WASM (works), running the CPython subset inside WASM (works but slow), and making all standard modules available (requires conditional compilation for WASM-incompatible APIs like filesystem and networking).

**Production hardening**: Memory safety edge cases. We've had two segfaults from pinned GC object violations. These are fixed but indicate that the cross-language GC integration needs more testing. We run a fuzz testing campaign with 100 million random cross-language call sequences — the current pass rate is 99.997%. The remaining 0.003% are assertion failures, not crashes.

## Timeline

Long v0.4 (JIT + optimizer improvements) is expected Q3 2026. V1.0 (stable API, production-ready) is targeted for Q1 2027 if funding allows. The project is currently self-funded — we use Long internally for our own infrastructure and release updates as time permits. External contributions are welcome, particularly for the JIT compiler and Windows port. If you're interested in polyglot runtimes or want to use Long in your project, reach out — we'd love to hear about your use case.