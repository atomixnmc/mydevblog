# React Native Hermes: The JavaScript Engine

Hermes is an open-source JavaScript engine optimized for React Native, developed by Meta. Unlike V8 or JavaScriptCore—general-purpose engines designed for browsers—Hermes is purpose-built for mobile apps: fast startup, small binary size, and low memory usage.

**Precompilation** is Hermes's defining feature. Traditional JS engines parse and compile JavaScript at runtime, which delays app startup. Hermes compiles JavaScript to bytecode ahead of time (AOT) during the build step. The bytecode is smaller than raw JS source and skips the parsing/compilation phases entirely at app launch. For a medium-sized React Native app, this shaves 30-50% off cold start time.

**Garbage collection** is designed for mobile constraints. Hermes uses a generational GC with a small young generation for short-lived objects (the vast majority in React apps) and a mark-compact old generation. The GC is non-moving for the old generation, meaning references don't change after objects are promoted. This avoids the pause time spikes caused by compacting GCs moving large object graphs. GC pauses are typically under 10ms on modern devices.

**Memory efficiency**: Hermes's bytecode format uses smaller instruction encodings than V8's bytecode. The engine itself compiles to a ~5MB binary (vs V8's ~20MB+ on mobile). For low-end Android devices with 1-2GB RAM, this memory difference directly affects app stability—fewer out-of-memory kills from the OS. Hermes also supports snapshotting the heap at build time, pre-seeding the engine with initialized module state.

**Debugging and dev experience**: Hermes supports the Chrome DevTools Protocol for debugging via the Hermes proxy. Source maps map bytecode execution back to original JS source. The `console.log` output streams through React Native's native logging bridge. React DevTools works with Hermes through the same React Native debugger infrastructure, though custom engine features like `atob` or `TextEncoder` may need polyfills.

**The tradeoff**: Hermes doesn't support JIT compilation (to keep binary size small and startup fast). This means pure computation benchmarks (like crypto hashing or heavy data processing) are slower than V8. For typical React Native apps where the bottleneck is native bridge communication, not JS execution speed, this rarely matters. Apple's JavaScriptCore remains the iOS default, but Hermes can be enabled on iOS too for consistency.

Hermes was enabled by default in React Native 0.70+, ending the era of V8 dominance on Android React Native.
