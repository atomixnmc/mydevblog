# Fluidy Current State

Fluidy is a dynamic language runtime with a JIT compiler. It's about 60% of the way to being a viable Python alternative for embedded use. Here's the current state.

## What Works

**Parser and bytecode VM**: Full Python 3.11 grammar support. The bytecode VM runs all Python control flow, function calls, closures, generators, and decorators. Performance is about 2x slower than CPython's interpreter (single-threaded, no JIT yet). The gap is because Fluidy's hash map implementation uses the Rust standard library's `HashMap` which is faster than CPython's dict (`PyDict` is notoriously slow for small dictionaries). For numeric operations (float arithmetic), Fluidy is about on par with CPython because both go through native function calls.

**Type feedback**: The VM collects type information at runtime — what types flow into each function parameter, what types are stored in each variable. This feedback is used by the JIT compiler in the compilation pipeline. The feedback collection overhead is about 3% of execution time (one extra pointer store per assignment). The feedback is discarded when code is compiled to avoid retaining type information that's no longer relevant.

**Inline caches**: Property access is cached — 90% monomorphic hit rate (one type seen), 98% megamorphic hit rate (up to 4 types cached). The cache entries are invalidated when the property layout of the observed type changes (rare — typically only during class definition, not during execution).

## What's In Progress

**Cranelift JIT**: The JIT backend compiles Fluidy IR to native code via Cranelift. Currently works for numeric functions only. Loops and function calls work. The JIT produces code that's about 60% of GCC -O0 speed. Missing: exit stubs (deoptimization when a type assumption fails), GC safepoints in compiled code, and stack frame layout compatible with the bytecode interpreter for seamless on-stack replacement.

**GC**: Fluidy uses a semi-space generational collector (from the immix family). Minor GC pauses are under 1ms for typical workloads. Major GC pauses are 10-50ms. The GC integration with the JIT requires emitting safepoints — the JIT currently doesn't emit them, so compiled code can't be interrupted for GC. We're working on this.

## Performance Compared to CPython

| Benchmark | CPython 3.11 | Fluidy (bytecode) | Fluidy (JIT, wip) |
|---|---|---|---|
| n-body (float math) | 0.45s | 0.42s | 0.18s |
| spectral-norm (matrix) | 1.2s | 1.5s | 0.5s |
| fannkuch-redux (loop) | 3.5s | 4.1s | 1.2s |
| JSON parsing | 0.8s | 1.8s | N/A |
| Startup time | 30ms | 12ms | 12ms |

The bytecode VM is faster than CPython on some numeric benchmarks (thanks to Rust's HashMap and more efficient bytecode dispatch). The JIT is 2-3x faster than CPython for compute-heavy code. JSON parsing is slower because Fluidy doesn't have a native JSON parser — it uses a Python-level library. We plan to implement JSON parsing as a native module.

## Limitations

- **No C extensions**: Fluidy's CPython subset doesn't support the C extension API. Packages like numpy, pandas, and scipy won't work. We support pure Python packages only.
- **No metaclasses**: The metaclass protocol is complex and rarely used. Fluidy doesn't support `__init_subclass__`, `__set_name__`, or custom metaclasses. Affects some ORMs and serialization libraries.
- **No `sys._getframe`**: Frame introspection doesn't work. Affects debuggers, tracebacks, and some metaprogramming patterns.
- **Limited `ctypes`**: Only basic FFI (C int, pointer types). Full `ctypes` support requires a C library loader, which is platform-specific.

Fluidy is usable for self-contained Python code that doesn't depend on C extensions or advanced metaprogramming. We use it in Long for data processing pipelines that need Python's syntax but not its ecosystem. If Fluidy gains `numpy` support via a native module that implements the numpy API in Rust, it becomes significantly more useful — this is on the roadmap for v0.5.