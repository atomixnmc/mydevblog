# Fluidy Compiler Runtime

Fluidy is a dynamic language runtime with a JIT compiler. It compiles Python-like source code to native machine code via Cranelift, with type specialization and inline caching.

## Compilation Pipeline

```
Source ──► Parser ──► AST ──► Type Infer ──► IR ──► Cranelift ──► Machine Code
                              │                           │
                         TypeFeedback                  IR Lowering
                         (runtime types)               (register alloc)
```

Fluidy compiles functions lazily. A function starts as bytecode (interpreted). After the first call, it collects type feedback. After the 10th call (or the first call in a loop), it triggers compilation.

## Type Specialization

```rust
// Source
def add(a, b):
    return a + b

// After type feedback: a=int, b=int
// Compiled to x86-64: add rdi, rsi

// After type feedback: a=float, b=float
// Compiled to x86-64: addsd xmm0, xmm1

// Different types detected: compiled polymorphic
// Compiled to x86-64:
//   check types → jump to specialized path or generic fallback
```

The compiler emits multiple compiled versions of the same function — one per observed type combination. The function entry point is a type check dispatcher:

```asm
; Polymorphic add(a, b) entry
_check_types:
    test rdi, TYPE_TAG  ; Check a's type
    jnz .check_b
    cmp type_b, INT_TAG
    je .int_path
.check_b:
    cmp type_b, FLOAT_TAG
    je .float_path
    jmp .generic   ; Fallback to bytecode interpreter

.int_path:
    add rsi, rdx   ; rdi=a, rsi=b
    ret

.float_path:
    addsd xmm0, xmm1
    ret
```

## Inline Caches

Property access is the bottleneck in dynamic languages. Fluidy uses inline caches:

```rust
struct InlineCache {
    expected_type: TypeId,
    property_offset: u32,  // Known field offset for this type
    fallback: fn(Obj, &str) -> Value,  // Slow path
}

fn get_property(obj: Obj, name: &str, cache: &mut InlineCache) -> Value {
    let actual_type = obj.type_id();
    if actual_type == cache.expected_type {
        // Fast path — known offset
        return obj.read_field(cache.property_offset);
    }
    // Slow path — update cache
    let offset = lookup_property_offset(actual_type, name);
    cache.expected_type = actual_type;
    cache.property_offset = offset;
    obj.read_field(offset)
}
```

The cache is monomorphic (expects one type). If a property access sees more than one type, it degrades to a megamorphic dispatch table (up to 4 cached types) before falling back to the full hash lookup. In benchmarks, the monomorphic cache hits 90% of the time, the megamorphic cache hits 98% of the time. The full hash lookup runs at 2x the cost of the cached path.

## GC Integration

Fluidy uses a generational GC (from the immix family) integrated with the JIT:

```rust
fn gc_alloc(size: usize) -> *mut u8 {
    // Try bump allocation in Eden
    if let Some(ptr) = eden_bump(size) {
        return ptr;
    }
    // Eden full — trigger minor GC
    minor_gc();
    if let Some(ptr) = eden_bump(size) {
        return ptr;
    }
    // Still full — trigger full GC or tenuring
    major_gc();
    eden_bump(size).unwrap()
}
```

The JIT emits GC safepoints at loop back-edges and function calls. At a safepoint, the runtime can stop-the-world and collect. The safepoints are polled — a thread-local flag is checked at each safepoint instruction. The GC sets this flag and waits for threads to reach a safepoint. The pause time for minor GCs is under 1ms for typical workloads (1-10MB Eden). Major GCs can pause for 10-50ms depending on heap size.

## Performance

Fluidy's JIT produces code that runs at roughly 60-70% of CPython's speed for numeric heavy code and 80-90% for control-flow heavy code. The gap is because Fluidy's type specialization is speculative and must fall back to generic paths when types change. The CPython subset in Fluidy (no `__slots__`, limited metaclass support) also limits optimization opportunities.

Fluidy does not aim to replace CPython for performance. It targets embedding in Long (the polyglot runtime) where Python code is glue between faster components. The JIT makes Python glue faster than CPython's interpreter (2-3x for tight loops) while keeping the cross-language memory sharing benefits.