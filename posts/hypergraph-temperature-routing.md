# HyperGraph Temperature Routing

Temperature routing in HyperGraph optimizes query execution paths based on "temperature" — a measure of data access frequency and freshness. Hot data (frequently accessed, recently written) gets different execution paths than cold data (rarely accessed, archival).

## Data Temperature

HyperGraph classifies data into temperature tiers:

```rust
enum Temperature {
    Hot,       // Accessed multiple times per second
    Warm,      // Accessed multiple times per minute
    Cold,      // Accessed multiple times per hour
    Frozen,    // Rarely accessed, compressed
    Archived,  // Offloaded to object storage
}
```

Each node in the graph has a temperature based on its access pattern:

```rust
fn classify_temperature(node: &Node) -> Temperature {
    let reads_per_second = node.access_stats() / node.age_in_seconds();
    match reads_per_second {
        r if r > 5.0  => Temperature::Hot,
        r if r > 0.1  => Temperature::Warm,
        r if r > 0.01 => Temperature::Cold,
        _ => Temperature::Frozen,
    }
}
```

## Routing Strategy

Queries are routed to storage layers based on temperature:

```rust
fn route_query(query: &Query, graph: &HyperGraph) -> QueryPlan {
    let temperature = graph.estimate_temperature(&query);

    let storage = match temperature {
        Temperature::Hot => "memtable",        // In-memory
        Temperature::Warm => "l0_sst",         // Level 0 SSTs
        Temperature::Cold => "compacted_sst",  // Deep compaction
        Temperature::Frozen => "columnar_archive", // Compressed
        Temperature::Archived => "s3_fetch",   // Object store
    };

    QueryPlan::new(storage, query)
}
```

Hot data is served from the MemTable (in-memory sorted buffer) — queries are served in under 1μs. Warm data from L0 SSTs on NVMe — 10-50μs. Cold data from deeply compacted SSTs — 100-500μs. Frozen data from compressed columnar archives — 1-5ms (decompression overhead). Archived data must be fetched from S3 — 50-200ms (network fetch + decompression).

## Temperature Transitions

Data moves between temperature tiers automatically:

```rust
fn temperature_transition(node: &Node, stats: &AccessStats) -> Option<Temperature> {
    let current = node.temperature();
    let target = classify_temperature(node);

    if current == target {
        return None; // No transition needed
    }

    match (current, target) {
        (Hot, Warm) => {
            // Flush from MemTable to L0 SST
            Some(Temperature::Warm)
        }
        (Warm, Cold) => {
            // Compact L0→L1, rewrite for slower access
            Some(Temperature::Cold)
        }
        (Cold, Frozen) => {
            // Deep compaction with columnar encoding
            Some(Temperature::Frozen)
        }
        // Reverse transitions (data becomes hotter again)
        (Frozen, Cold) => {
            // Load into SST cache, decompress
            Some(Temperature::Cold)
        }
        // ...
    }
}
```

Reverse transitions happen when cold data is accessed again — it's promoted to warmer tiers. The promotion is gradual: a single read of Frozen data promotes it to Cold (loaded into the SST cache). Frequent reads promote to Warm (L0 SSTs on NVMe). Very frequent reads promote to Hot (MemTable in RAM).

## Performance Impact

Temperature routing reduces query latency by 3-10x on average:

| Workload | Without temp routing | With temp routing |
|---|---|---|
| Hot data queries (frequent) | 150μs (SST lookup) | 0.5μs (MemTable) |
| Cold data queries (rare) | 150μs | 2ms (decompression) |
| Mixed (80/20 hot/cold) | 150μs avg | 400μs avg |

The worst case for temperature routing is "sudden cold access" — a query that hasn't been seen in months suddenly arrives. The data must be fetched from the archive (50-200ms). For these cases, we use a predictive pre-warming system that anticipates queries based on the day of week, time of day, and recent access patterns: if last year's Black Friday data was accessed on the second Tuesday of November, we pre-warm it on the first Tuesday of November. This pattern detection is handled by a small ML model (gradient-boosted decision tree) that runs as a background scheduler.