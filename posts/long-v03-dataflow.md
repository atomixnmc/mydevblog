# Long v0.3 Dataflow

Long v0.3 introduces a dataflow system that replaces the traditional async/await call chain with a declarative dataflow graph. Instead of `let a = await f(x); let b = await g(a)`, you define a graph where nodes are computations and edges are data dependencies. The runtime schedules nodes automatically.

## The Dataflow Model

Each node in the dataflow graph is a typed, polymorphic computation:

```rust
use long::dataflow::{Graph, Node, Port, Stream};

let mut graph = Graph::new();

// Define nodes
let source = graph.source("sensor_data", Stream::new::<f32>(100));
let filter = graph.map("lowpass", |x: f32| x * 0.3 + prev * 0.7);
let analyze = graph.fold("moving_average", |acc, x: f32| acc + x / 100.0);
let output = graph.sink("display", |data| render(data));

// Connect edges
source.connect(&filter);
filter.connect(&analyze);
analyze.connect(&output);

// Run
graph.run().await?;
```

## Cross-Language Nodes

Dataflow nodes can be implemented in different languages:

```javascript
// JavaScript — node definition
long.dataflow.node("sentiment", {
    inputs: ["text"],
    outputs: ["sentiment_score", "confidence"],
    process(inputs) {
        const score = analyzeSentiment(inputs.text);
        return {
            sentiment_score: score.value,
            confidence: score.confidence,
        };
    }
});
```

```python
# Python — different node in the same graph
@long.dataflow.node
def aggregate(scores: list, threshold: float) -> dict:
    positives = [s for s in scores if s > threshold]
    return {
        "count": len(positives),
        "ratio": len(positives) / len(scores)
    }
```

```javascript
// Orchestration — JS wiring the graph
const sentimentNode = long.dataflow.get("sentiment");
const aggregateNode = long.dataflow.get("aggregate");
sentimentNode.connect(aggregateNode, "sentiment_score", "scores");
```

## Backpressure

Dataflow nodes communicate through bounded channels with backpressure:

```rust
struct DataflowChannel<T> {
    buffer: VecDeque<T>,
    capacity: usize,
    pushed: usize,   // Total items pushed
    drained: usize,  // Total items consumed
}

impl<T> Stream for DataflowChannel<T> {
    fn push(&mut self, item: T) -> Result<(), Backpressure> {
        if self.buffer.len() >= self.capacity {
            return Err(Backpressure::Full);
        }
        self.buffer.push_back(item);
        self.pushed += 1;
        Ok(())
    }
}
```

When a downstream node is slow, backpressure propagates upstream. The `capacity` parameter controls how many items can be buffered between nodes. For real-time pipelines (audio, sensor data), capacity is small (8-16 items) to keep latency low. For batch pipelines (ETL, analytics), capacity is large (10K+ items) to maximize throughput.

## Scheduling

The scheduler uses a variant of work-stealing adapted for dataflow:

```rust
fn schedule(graph: &mut DataflowGraph) {
    loop {
        let ready: Vec<_> = graph.nodes()
            .filter(|n| n.is_ready() && !n.is_running())
            .collect();

        if ready.is_empty() && graph.active_streams() == 0 {
            break; // All done
        }

        for node in ready {
            graph.workers.spawn(move || node.execute());
        }

        graph.workers.wait_for_completion();
    }
}
```

A node is "ready" when all its input ports have data available. The scheduler assigns ready nodes to worker threads. Cross-language nodes (JS→Python→Rust) add ~5μs of scheduling overhead per edge crossing — the scheduler needs to serialize the work item and route it to the right engine's work queue. In practice, the dataflow graph runs at 95%+ efficiency for pipelines with 10-100 nodes.

## Use Case: Real-Time Sensor Processing

Our demo runs a sensor fusion pipeline: raw samples (Rust) → lowpass filter (Rust) → ML inference (Python) → anomaly detection (Python) → logging (Rust) → dashboard (JS). With the dataflow system, this is 6 connected nodes. The scheduler parallelizes the filter and inference stages when there's backpressure. The dashboard updates at 30 FPS regardless of the sensor sampling rate (which runs at 1 KHz but is downsampled at the filter node).

The dataflow system replaces manual channel wiring and backpressure handling. Before v0.3, we had tokio channels between each stage with explicit buffer management. Now the graph declaratively expresses the pipeline, and Long handles scheduling, backpressure, and cross-language data transfer.