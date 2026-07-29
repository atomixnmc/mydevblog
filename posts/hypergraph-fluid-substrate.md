# HyperGraph Fluid Substrate

Fluid Substrate is HyperGraph's storage layer — a log-structured merge-tree (LSM) designed for graph workloads. Unlike traditional LSM trees (RocksDB, LevelDB) that are optimized for key-value access, Fluid Substrate indexes graph edges and node properties in columnar format.

## Architecture

```
┌─────────────────────────────┐
│     Write-Ahead Log (WAL)    │
├─────────────────────────────┤
│     MemTable (sorted)        │
├──────────────┬──────────────┤
│  L0: Edge SST │ L0: Node SST│
│  L1: Edge SST │ L1: Node SST│
│  L2: Edge SST │ L2: Node SST│
│  ...           │ ...         │
└──────────────┴──────────────┘
```

Writes go to the WAL (for durability) and the MemTable (in-memory sorted buffer). When the MemTable reaches 64MB, it's flushed to L0 as a sorted string table (SST). Compaction merges SSTs across levels, pruning deleted entries and reorganizing data for query efficiency.

## Columnar SSTs

Each SST stores columns separately:

```
SST file:
├── Header (file metadata)
├── Column: "name" (Varint-length strings)
│   ├── Bloom filter
│   ├── Index (offset → key)
│   └── Data blocks
├── Column: "age" (fixed-width f64)
│   ├── Bloom filter
│   ├── Index
│   └── Data blocks
├── Column: "email" (Varint-length strings)
└── Footer (offsets to each column)
```

This layout means a query reading only `age` touches only the age column's blocks. A full-node read touches all columns but still benefits from per-column bloom filters — if the filter says "age=25 doesn't exist in this SST", the query skips it without I/O.

## Graph Edges

Edges are stored as adjacency lists, columnar:

```
Edge SST:
├── Column: "source_id" (u64 × N)
├── Column: "target_id" (u64 × N)
├── Column: "edge_type" (Varint-indexed)
└── Column: "properties" (columnar-encoded)
```

Forward traversals (`MATCH (a)→(b)`) read the `source_id` column. Reverse traversals read `target_id`. Bi-directional edges are stored as two adjacency list entries. Edge properties are columnar — a traversal that only checks edge type never reads the properties column.

## Node Properties as Columns

Each node property is a separate column. This is the key design difference from Neo4j (node properties stored as a map):

```sql
-- HyperGraph: columnar
SELECT name, age FROM hypergraph.nodes WHERE age > 25;
-- Reads "name" column + "age" column — fast, sequential I/O

-- Neo4j: property records
MATCH (n) WHERE n.age > 25 RETURN n.name;
-- Reads full NodeRecords + PropertyRecords — random-access I/O
```

For analytic queries scanning millions of nodes, columnar storage is 5-10x faster because each column read is a sequential scan of a contiguous byte range. For point queries (fetch one node by ID), columnar adds the overhead of assembling the row from multiple column reads — but we mitigate this with a "row cache" that stores recently accessed node records as contiguous memory.

## Compaction

Fluid Substrate compacts SSTs across levels, focusing on edge connectivity preservation:

```rust
fn compact(ssts: &[SST], output_path: &Path) -> SST {
    // Merge, deduplicate, and re-sort by (source_id, edge_type)
    let merged = merge_sort_edges(ssts);

    // During compaction, rebuild adjacency structure
    // to minimize random access during traversals
    let adjacency = build_adjacency_index(&merged);

    // Write new SST with adjacency index
    SST::write(adjacency, output_path)
}
```

The adjacency index is a skip-list of (source_id → [target_ids]) entries. This index makes 1-hop traversals read a single SST block instead of scanning the entire edge column. The skip-list format adds about 10% storage overhead but reduces traversal I/O by 60-80% for typical social graph queries (find friends of friends).

## Performance

Fluid Substrate handles 100K writes/second on a single NVMe SSD (WAL flush at 1ms latency). Reads are latency-bound by the number of SSTs touched — a point query with 4-level LSM (L0-L3) touches up to 4 SSTs, taking 50-200μs. Compaction runs in the background with tunable I/O limits to prevent read latency spikes. With I/O throttling at 200MB/s, compaction reduces read throughput by <5% during normal operation.