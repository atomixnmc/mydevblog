# LongIR Design

LongIR is Long's Intermediate Representation — a typed SSA (Static Single Assignment) form that sits between the polyglot frontends (JS, Python, Rust) and the backend code generators. Every language compiles to LongIR before being lowered to machine code or WASM.

## Why a Custom IR

Existing IRs (LLVM IR, Cranelift IR, WASM) make assumptions about their source language. LLVM IR assumes C-like memory models with explicit allocas. WASM assumes structured control flow (blocks, if-else, loops). LongIR is designed for dynamic languages — it supports untyped variables, polymorphic dispatch, and garbage collection intrinsics as first-class operations.

## IR Structure

LongIR is a graph of basic blocks with phi nodes:

```lir
function @fib(n: i64) -> i64 {
entry:
    %cond = icmp_ule %n, 1
    br %cond, @base, @recurse

base:
    ret %n

recurse:
    %n1 = sub %n, 1
    %a = call @fib(%n1)
    %n2 = sub %n, 2
    %b = call @fib(%n2)
    %result = add %a, %b
    ret %result
}
```

The IR supports all standard operations (arithmetic, memory, control flow) plus polyglot-specific ops:

```lir
// Cross-language call
%py_result = polycall "python", @process_data(%input)

// Dynamic dispatch (JS-style method call)
%method = load_property %obj, "run"
%out = dynamic_call %method, %obj, %arg

// GC barrier
gc_store %obj, %field, %value  // with write barrier

// Type guard
%is_string = type_check %val, "string"
br %is_string, @string_path, @fallback
```

## Type Inference

LongIR has a gradual type system — types are optional but enable optimizations:

```lir
function @add(a: i64, b: i64) -> i64 {
    %sum = add %a, %b   // Type known — no boxing needed
    ret %sum
}

function @add_dynamic(%a, %b) {
    // No type info — must handle dynamically
    %a_checked = type_guard %a, "number"
    %b_checked = type_guard %b, "number"
    %sum = add %a_checked, %b_checked
    ret %sum
}
```

The type inference pass runs after IR construction. It propagates types from function signatures, constant values, and type guard results. In practice, this means hot functions in JavaScript (which is dynamically typed) get 60% of variables typed after inference. The remaining 40% need runtime type checks, which are compiled to fast-path/slow-path branches.

## Optimization Passes

LongIR runs standard SSA optimizations plus polyglot-specific passes:

- **Dead code elimination**: Standard. Handles polyglot call results — if a cross-language call result is unused, the call is elided only if it has no side effects.
- **Constant folding**: Standard.
- **Specialization**: Creates monomorphized versions of generic functions. A `sort(list)` call over i64 arrays gets compiled to a specialized sort without dispatch overhead.
- **Inline caching**: For dynamic dispatch sites, the IR emits inline cache stubs that monomorphize on observed types. After 4 misses (4 different receiver types), the cache degrades to a megamorphic dispatch table.

## Code Generation

From LongIR, the backend generates either native code (x86-64, aarch64 via Cranelift) or WASM. The difference is about 15% performance — WASM adds bounds checking and structured control flow constraints. For native targets, the gap between LongIR-generated code and hand-optimized Rust is about 20% for numeric code and 5% for control-flow-heavy code. The type specialization pass accounts for most of this — without it, the gap widens to 40% for dynamic dispatch heavy code.