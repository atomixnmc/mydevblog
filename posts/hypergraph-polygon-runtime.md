# HyperGraph Polygon Runtime

The Polygon Runtime is HyperGraph's VM for executing user-defined graph traversal logic. Instead of sending query strings to HyperGraph, you compile custom traversal algorithms into bytecode and run them close to the data — inside the storage engine process.

## Why a Runtime

Graph traversals involve branching and recursion. Fixed query languages (Cypher, SPARQL) can express most traversals but are awkward for custom algorithms (community detection, path-dependent aggregations, early-terminating searches). The Polygon Runtime lets you write traversal logic in a subset of Rust or a custom DSL, compile it to bytecode, and execute it inside HyperGraph's storage process — no data serialization between the query engine and storage.

## Bytecode Format

Polygon bytecode is a stack-based VM with graph-specific opcodes:

```rust
enum Opcode {
    // Standard
    Push(i64),        // Push immediate integer
    Add, Sub, Mul,    // Arithmetic
    Jump(usize),      // Unconditional branch
    JumpIf(usize),    // Conditional branch
    Call(String),     // Call named function

    // Graph-specific
    TraverseForward,  // Walk to neighbors via outgoing edges
    TraverseReverse,  // Walk to neighbors via incoming edges
    FilterType(Tag),  // Keep edges matching a type
    ReadProp(String), // Read a node/edge property
    AggSum, AggCount, // Aggregation operations
    EarlyExit,        // Stop traversal (short-circuit)
}
```

## Compiling Traversals

A traversal algorithm is compiled to Polygon bytecode:

```rust
// Source: count friends of friends
fn count_foaf(start: NodeId, max_depth: u32) -> u32 {
    let mut count = 0;
    let mut visited = Set::new();
    let mut queue = VecDeque::new();
    queue.push_back((start, 0u32));

    while let Some((node, depth)) = queue.pop_front() {
        if depth >= max_depth { continue; }
        for neighbor in node.traverse_forward() {
            if !visited.contains(&neighbor) {
                visited.insert(neighbor);
                count += 1;
                queue.push_back((neighbor, depth + 1));
            }
        }
    }
    count
}
```

Compiled bytecode (simplified):

```text
; R0 = start, R1 = max_depth
00: PUSH 0           ; count = 0
01: STORE_LOCAL 0     ; count in local[0]
02: NEW_SET           ; visited = Set::new()
03: STORE_LOCAL 1
04: NEW_DEQUE
05: PUSH 0           ; (start, 0)
06: DEQUE_PUSH
07: STORE_LOCAL 2     ; queue
; Loop header
08: DEQUE_POP         ; pop (node, depth)
09: DUP_PAIR
10: LOAD_LOCAL 1      ; max_depth
11: CMP_GE
12: JUMP_IF 19        ; if depth >= max_depth, skip
; ... traversal code ...
```

The runtime executes this bytecode directly on HyperGraph's storage. The `TraverseForward` opcode reads the edge column for the current node directly from the SST (or MemTable for hot data). The visited set is a Bloom filter for small traversals (depth < 5) and a hash set for larger ones (auto-selected by the compiler).

## Security

Polygon bytecode runs in a sandboxed VM — no access to system calls, filesystem, or network. Memory is bounded (max 64MB for stack + heap). Execution time is bounded (max 5 seconds per traversal). The runtime validates bytecode before execution: checks for valid opcodes, bounds on stack operations, and ensures all jumps target valid addresses.

```rust
struct PolygonConfig {
    max_memory: usize,        // Default: 64MB
    max_instructions: usize,  // Default: 10M
    max_depth: u32,           // Default: 10
    max_branching: u32,       // Default: 1000 neighbors per node
}
```

## Performance

| Operation | SQL query | Polygon bytecode |
|---|---|---|
| 2-hop neighborhood | 500μs (SQL+parse+plan) | 120μs (bypasses parser) |
| BFS (depth 5) | 3.5ms (joined queries) | 800μs (single traversal) |
| Custom aggregation | 5ms (SQL + UDF) | 400μs (native execution) |
| Early-exit search | N/A (SQL runs full scan) | 50μs (stops at first match) |

Polygon bypasses the SQL parser, query optimizer, and result serialization. The bytecode runs directly against the storage engine's internal iterators. For complex traversals (custom algorithms, early-exit searches, path-dependent computations), Polygon is 5-10x faster than equivalent SQL. For simple lookups (single node by ID), the overhead of launching the Polygon VM makes SQL faster (12μs vs 50μs).

Polygon is experimental — the bytecode format may change, and the compiler only supports a subset of Rust. Write traversal algorithms in Rust, compile to Polygon bytecode, and trust that the bytecode runs efficiently inside HyperGraph. If your graph needs custom traversal logic that can't be expressed in SQL, Polygon is the bridge between the storage engine and your application.