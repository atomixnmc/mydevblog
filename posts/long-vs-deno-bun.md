# Long vs Deno vs Bun

Long is a polyglot runtime. Deno and Bun are JavaScript/TypeScript runtimes. Comparing them is comparing apples to slightly different apples — they all run JavaScript on the server, but their goals diverge after that.

## JavaScript Engine

| Engine | Long | Deno | Bun |
|---|---|---|---|
| JS Engine | Boa (Rust) | V8 (C++) | JavaScriptCore (C++) |
| Test262 | 98.7% | 99.9%+ | 99.9%+ |
| Speed (Octane) | 8,400 | 38,000 | 35,000 |
| Startup (hello world) | 45ms | 25ms | 8ms |

Deno and Bun both use mature C++ engines with decades of optimization. Long uses Boa, a Rust-native engine that's 100% match for ES2023 but 4x slower. The startup difference (45ms vs 8ms) is from Boa's bytecode compilation — Bun uses JSC which is already optimized for quick startup.

## What Each Excels At

**Deno**: Secure-by-default runtime with web-standard APIs. Best TypeScript support (native compilation without tsconfig). Built-in formatter, linter, test runner. Good for server-side JavaScript with web API compatibility. If you write `fetch()` in the browser and want it to work identically on the server, Deno is the choice.

**Bun**: Fast runtime with Node.js compatibility. Built-in package manager (`bun install` is 10x faster than `npm install`). Native bundler and transpiler. Bun is the Node.js replacement — it runs existing Node.js projects with minimal changes and makes them faster. If you have an Express app and want it to start 5x faster, Bun is the choice.

**Long**: Polyglot runtime — runs JS, Python, Rust, WASM in the same process. If you need Python's data science libraries alongside a Node.js-like HTTP server, or if you have Rust compute kernels called from JavaScript, Long is the choice. Long is not a Node.js replacement — it's a "need multiple languages in one process" runtime.

## Node.js Compatibility

```javascript
// Deno: import from URL or npm: specifier
import { serve } from "https://deno.land/std/http/server.ts";
import express from "npm:express";

// Bun: import normally — npm compat built-in
import express from "express";

// Long: npm resolver + long modules
import express from "express";  // npm packages work
import { http } from "long:std"; // Long's built-in
```

Deno uses URL imports (with npm: prefix for npm compatibility). Bun uses standard npm resolution. Long uses standard npm resolution plus `long:` prefixed modules. Long's npm support covers Express, Lodash, Zod, and most pure-JS packages. Packages that use native Node.js APIs (fs, crypto) map through Long's std modules.

## Polyglot Comparison

Deno and Bun don't support polyglot out of the box. You can spawn Python subprocesses:

```javascript
// Deno/Bun — spawn Python
const process = Deno.run({ cmd: ["python3", "-c", "print('hello')"] });
// or Bun.spawn(["python3", "-c", ...])
```

This works but adds 50-100ms per spawn (process creation + Python startup) and data must be serialized/deserialized. Long runs Python in-process — zero startup cost, zero-copy data sharing. For a single Python call, the subprocess approach takes 80-100ms vs Long's 0.1ms. For 10,000 calls in a loop, Long is 3 orders of magnitude faster.

## When to Pick Each

**Pick Deno**: You're building a TypeScript-first server, care about security (deny-by-default permissions), and want web-standard APIs. Your data pipeline is pure JavaScript.

**Pick Bun**: You're migrating an existing Node.js project, want faster package management, and need the fastest JavaScript runtime. Your team is JS-only.

**Pick Long**: You need Python libraries (pandas, scikit-learn, networkx) alongside JavaScript. Or you have Rust compute kernels called from JavaScript. Or you're building a system where data moves between languages and the serialization overhead of separate processes is unacceptable.

Long is the right choice for a smaller set of use cases than Deno or Bun. When it's the right choice, it enables architectures that are impractical with separate processes — mixed-language code in a single process with zero-copy data sharing. For most web applications, Deno or Bun are simpler and faster.