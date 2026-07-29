# HyperGraph vs Neo4j

HyperGraph is a graph database built from scratch in Rust. Neo4j is the incumbent, written in Java with 15+ years of development. Here's where HyperGraph competes, where it doesn't, and why you might choose either.

## Storage Engine

HyperGraph stores all data in a custom columnar format on local disk (NVMe-optimized). Neo4j uses a native property graph store with record-based storage:

```
HyperGraph: [Nodes][Edges][Properties(columnar)] — cache-line friendly
Neo4j:     [NodeRecord][EdgeRecord][PropertyRecord] — pointer-chasing
```

HyperGraph's columnar layout means scanning all nodes with a specific property value is a sequential memory read — the column for that property is contiguous on disk. Neo4j must chase pointers through property records. For OLAP-style queries scanning millions of nodes, HyperGraph is 3-5x faster in our benchmarks. For OLTP point queries (fetch one node by ID), they're comparable — both do random access.

## Query Language

Neo4j has Cypher, a mature query language with pattern matching. HyperGraph uses SQL+JSON with a graph extension:

```cypher
// Neo4j Cypher
MATCH (u:User)-[:PURCHASED]->(p:Product)
WHERE u.age > 25
RETURN p.name, count(*) as purchases
```

```sql
-- HyperGraph SQL
SELECT p.name, COUNT(*) as purchases
FROM hypergraph MATCH (u:User) -> (p:Product)
WHERE u.age > 25
```

The SQL-based approach means any PostgreSQL-compatible tool works — dbt, Tableau, BI tools — without special adapters. If your team knows SQL and doesn't want to learn Cypher, HyperGraph's query language is straight forward. If you need graph-native pattern matching (variable-length paths, shortest path), Cypher is more expressive today — HyperGraph's path expressions are still under active development.

## Performance

| Query Type | HyperGraph (Rust) | Neo4j (Java) |
|---|---|---|
| Point lookup (single node) | 12μs | 15μs |
| 1-hop neighborhood | 45μs | 52μs |
| 3-hop BFS traversal | 2.1ms | 3.8ms |
| Aggregation (10M nodes) | 320ms | 1.4s |
| Bulk insert (1M nodes) | 1.8s | 4.2s |

HyperGraph's advantage comes from Rust's memory control (zero-cost abstractions, cache-friendly data structures) and the columnar storage engine. Neo4j's advantage is ecosystem — graph algorithms library (GDS), Bloom visualization, AuraDB cloud, native drivers for 15+ languages.

## When to Use Which

**HyperGraph fits**: You need SQL compatibility for existing tools. Your queries are aggregation-heavy (analytics on graph data). You deploy on bare metal or Kubernetes without a managed cloud service. You're building a custom graph application where every microsecond counts.

**Neo4j fits**: You need a managed cloud database (AuraDB). Your queries are traversal-heavy (recommendation engines, fraud detection with long paths). You want the GDS library for built-in PageRank, betweenness centrality, community detection. Your team writes Cypher and doesn't need SQL.

In practice, we've seen teams use both — HyperGraph for the write-heavy ingestion pipeline (columnar writes are faster) and Neo4j for the read-heavy query path (Cypher is nicer for traversal queries). The data is synced through a Change Data Capture pipeline. It's not elegant, but it works.