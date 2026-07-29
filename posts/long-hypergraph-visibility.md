# Long HyperGraph Visibility

HyperGraph stores graph data. Long runs polyglot code. Long HyperGraph Visibility is the integration layer that lets a JavaScript function query a graph, pass the results to a Python function for analysis, and send the output to a Rust function for rendering — all in the same runtime, with zero-copy data sharing.

## The Integration

HyperGraph is embedded in Long as a native module. Graph queries return zero-copy views into HyperGraph's columnar storage:

```javascript
import { hypergraph } from 'long:hypergraph';

// Query returns a GraphView — shared memory, not copied data
const view = hypergraph.query(`
    MATCH (u:User) WHERE u.age > 25
    RETURN u.name, u.email, u.signup_date
`);

// Pass directly to Python — no serialization
const result = python.run(`
def analyze(users):
    from datetime import datetime
    now = datetime.now()
    active = [u for u in users if (now - u.signup_date).days < 30]
    return {"active_count": len(active), "total": len(users)}
`, view);

console.log(result);
```

The `GraphView` object is a typed-array-backed row iterator. HyperGraph's columnar format is already memory-mapped — the view provides pointers into HyperGraph's mmap'd files. When Python iterates the view, it reads HyperGraph's data directly from the mmap, not from a copy. The data transfer cost is zero.

## Visibility Queries

"Visibility" in this context means: what data is visible to each language, and what operations can they perform on it?

```rust
// Rust — access the raw columnar buffers
#[long::module]
fn rust_analysis(view: &GraphView) -> AnalysisResult {
    // Access columns as slices
    let ages = view.column::<f64>("age");
    let names = view.column::<StringView>("name");

    // Compute statistics directly on HyperGraph's memory
    let mean_age = ages.iter().sum::<f64>() / ages.len() as f64;
    let oldest = names[ages.iter().enumerate()
        .max_by(|(_, a), (_, b)| a.partial_cmp(b).unwrap())
        .unwrap().0];

    AnalysisResult { mean_age, oldest_name: oldest.to_string() }
}
```

Data visibility rules: JavaScript sees all columns as typed arrays. Python sees all columns as array.array or list depending on type. Rust sees the raw memory slices. Mutations are restricted — Python and JavaScript get read-only views by default (to maintain HyperGraph's transaction isolation). Rust can get write access via an explicit `&mut GraphView` parameter, which acquires a write lock on HyperGraph's MVCC transaction log.

## Cross-Language Graph Traversal

A graph traversal can span languages:

```javascript
// JavaScript — start traversal
const path = hypergraph.traverse(
    hypergraph.node("alice"),
    "KNOWS",
    { max_depth: 3 }
);

// Python — filter traversed nodes
const filtered = python.run(`
def filter_nodes(path):
    return [
        n for n in path.nodes
        if n.properties.get("influence_score", 0) > 0.7
    ]
`, path);

// Rust — compute metric on filtered set
const result = rust.run(`
fn compute_centrality(nodes: &GraphView) -> f64 {
    let scores = nodes.column::<f64>("influence_score");
    scores.iter().sum::<f64>() / scores.len() as f64
}
`, filtered);
```

Each step passes a pointer to HyperGraph's columnar storage. The Python filter evaluates over the mmap'd columns with no allocation. The Rust centrality computation reads the `influence_score` column directly from storage. The entire pipeline touches HyperGraph's data once — during the initial traversal. Python and Rust read the same memory that the traversal wrote to.

## Performance

| Operation | Cost |
|---|---|
| Traversal (3-hop, 1000 nodes) | 2.1ms |
| JS → Python view handoff | 0ns (pointer) |
| Python filter (1000 rows) | 0.4ms |
| Rust computation (1000 rows) | 0.05ms |
| **Total pipeline** | **2.55ms** |

The handoff overhead between languages is zero — no serialization, no marshaling, no copy. The entire pipeline runs in the same process, reading the same mmap'd file. Compare this to a microservice architecture where each language service serializes to JSON/Protobuf, sends over HTTP/gRPC, and deserializes — adding 1-5ms per hop.

HyperGraph Visibility is Long's flagship integration feature. It solves the problem that motivated Long: "My graph is in Rust, my analytics is in Python, and my web layer is in JavaScript — how do I avoid copying data between them?" The answer: put all three in the same process, share HyperGraph's columnar memory, and let each language access the data with its native idioms.