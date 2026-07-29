# HyperGraph 2026 State

HyperGraph in 2026 is a graph database running in production at a handful of companies. It's not Neo4j-scale yet, but it's past the "Rust toy" phase. Here's the state of the project.

## Storage Engine

The Fluid Substrate storage engine (LSM-based, columnar) shipped in v0.8. It replaced the initial B-tree implementation. Key improvements:

- Columnar SSTs reduced storage size by 40% vs row-based storage (fewer index bytes per value)
- Compaction throughput: 200MB/s on NVMe (single-threaded) — compaction runs in a background thread with tunable I/O limits
- Write throughput: 100K ops/s (single node, NVMe) — tested with a social graph workload (insert edges + read back)
- Point read latency: 50μs p50, 200μs p99 (in-memory cache hit), 500μs p99 (disk read)

## Query Engine

The query engine supports a SQL+JSON dialect with graph extensions. The parser is generated from a PEG grammar. The optimizer does:

- Predicate pushdown (WHERE clause filters applied before graph traversal)
- Join reordering (pick optimal traversal order for multi-hop queries)
- Index selection (pick between primary key, property index, and adjacency index)
- Result cardinality estimation (using histogram statistics)

```sql
-- This query uses the optimizer to pick between forward/reverse edge index
SELECT p.name, COUNT(*) as purchases
FROM hypergraph MATCH (u:User) -[:PURCHASED]-> (p:Product)
WHERE u.age > 25 AND p.category = 'electronics'
GROUP BY p.name
ORDER BY purchases DESC
LIMIT 10;
```

The optimizer reduces query time by 2-5x compared to naive traversal order. For the purchase analytics query above, the optimizer picks: filter users by age → traverse PURCHASED edges → filter products by category → aggregate. This avoids scanning all PURCHASED edges for products that would be filtered out anyway.

## Cluster Mode

HyperGraph runs in a leaderless cluster with:

- Consistent hashing for data distribution (Ring DHT)
- Raft consensus for metadata (schema, cluster membership)
- Quorum reads/writes: R=2, W=2 for RF=3
- Re-replication on node failure (target: <30s)

A 3-node cluster handles 200K writes/second and 500K reads/second (NVMe SSDs, 10GbE). Latency increases by about 100μs for cluster operations vs single-node (network round-trip + consensus). Split-brain is prevented by Raft — if a node can't reach the leader, it refuses writes until it reconnects or a new leader is elected.

## Ecosystem

HyperGraph has experimental integrations with:

- **Apache Arrow**: Zero-copy query results. A query returns an Arrow IPC stream — the client receives typed columnar data without serialization. Integration with DuckDB (Polars reads the Arrow stream directly).
- **LangChain**: Graph-based RAG pipeline. LangChain's GraphVectorStore maps to HyperGraph nodes with embedding properties. Traversals enrich RAG context with graph neighborhood. Early results show 15% improvement in QA accuracy on knowledge graph tasks.
- **Grafana**: Grafana datasource plugin for visualizing graph metrics as time series. Track node count, edge count, query latency, and compaction status over time.
- **Protobuf**: Wire protocol is Protobuf-based (gRPC). The schema is service definition for query, insert, update, delete operations. Custom filters and aggregations are expressed as Protobuf messages rather than SQL strings, enabling typed gRPC streaming for bulk operations.

## Limitations

HyperGraph still has rough edges:

- No full-text search — we use Tantivy as a separate index and join at query time
- No built-in graph algorithms (PageRank, betweenness centrality) — users call external libraries via the compute framework
- No managed cloud — every deployment is self-hosted on bare metal or Kubernetes
- Documentation is sparse — the Rustdoc is comprehensive but the user guide is incomplete. We're working on it.

## Next Steps

v0.9 targets: full-text search integration (embedded Tantivy index), built-in graph algorithms (PageRank via the compute framework), and ARM64 support (currently x86-64 only due to some SIMD code paths). v1.0 is Q4 2026 at the current pace.