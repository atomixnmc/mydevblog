# HyperGraph Storage Engine: Architecture and Design

HyperGraph is a graph database designed to store and query complex, multi-relational data structures where edges can connect more than two nodes. Unlike property graphs (Neo4j) or RDF stores, HyperGraph's core abstraction is the hyperedge: a relationship that connects an arbitrary number of vertices. When I first started modeling a supply chain system with standard property graphs, the intermediate node pattern for n-ary relationships became a nightmare — every purchase order with 47 line items required 47 binary edges plus a wrapping node. The hypergraph model eliminated all that indirection. A single hyperedge connects the purchase order to all its items, suppliers, and shipping details. The storage engine design decisions that make this possible are where the real engineering challenge lives.

## Physical Storage Layout

The storage engine uses a hybrid approach combining columnar storage for attributes with adjacency lists for graph structure. Vertices are stored in sorted, compressed row-oriented blocks. Each block holds a set of vertices, sorted by their 64-bit ID. The blocks are compressed using delta encoding for sequential IDs and dictionary compression for string properties. Hyperedge adjacency lists maintain pointers to all incident vertices, with both forward (edge→vertex) and reverse (vertex→edge) indices. This bidirectional indexing enables efficient traversal in both directions without full scans:

```java
// Simplified representation of the adjacency index structure
public class AdjacencyIndex {
    // Forward: hyperedge ID → array of incident vertex IDs
    private final Long2ObjectOpenHashMap<long[]> forwardIndex;

    // Reverse: vertex ID → array of incident hyperedge IDs
    private final Long2ObjectOpenHashMap<long[]> reverseIndex;

    // Bulk insert with sorted arrays for merge efficiency
    public void addHyperedges(List<Hyperedge> edges) {
        for (Hyperedge edge : edges) {
            long edgeId = edge.getId();
            long[] vertices = edge.getVertexIds();

            // Forward index: sort once, use everywhere
            Arrays.sort(vertices);
            forwardIndex.put(edgeId, vertices);

            // Reverse index: each vertex gets a back-pointer
            for (long vid : vertices) {
                reverseIndex.addToValue(vid, edgeId);
            }
        }
    }
}
```

The reverse index is crucial for "neighborhood" queries: "find all hyperedges this vertex participates in." Without it, every such query would require a full scan of the forward index — unacceptable at scale.

## Write-Ahead Log and MVCC

The write-ahead log (WAL) ensures durability while supporting high-throughput ingestion. HyperGraph implements a multi-version concurrency control (MVCC) system where each transaction sees a consistent snapshot of the graph at its start time. Write operations create new versions of affected hyperedges and vertices rather than modifying in place:

```
Transaction T1: Start at version 15
  - Read hyperedge H42 → sees version 14
  - Write hyperedge H42 → creates version 16
  - Commit → version 16 becomes visible at version 17
```

Each version stores only the difference from the previous version (delta encoding), minimizing storage overhead for small edits. The garbage collector asynchronously reclaims versions older than the oldest active transaction, using a watermark tracked by the transaction manager. This is the same approach used by PostgreSQL and FoundationDB — battle-tested and well-understood.

The WAL itself is written as sequential blocks of 64KB, each containing a checksum and a batch of serialized operations. On recovery, the engine replays from the last checkpoint, re-applying committed transactions and discarding uncommitted ones. Recovery is O(operations since last checkpoint), not O(total operations), thanks to periodic fuzzy checkpoints that capture a consistent state without blocking writes.

## LSM-Tree Adaptation for Graph Workloads

The storage engine internals use a log-structured merge-tree (LSM-tree) architecture adapted for graph workloads. New writes go to an in-memory memtable (a concurrent skip list sorted by (vertex_id, property_key)), then flush to sorted immutable SSTables on disk. Compaction merges overlapping SSTables while resolving tombstones:

```
Memtable (sorted, in-memory) → flush → Level 0 SSTables (may overlap)
Level 0 → compaction → Level 1 SSTables (sorted, non-overlapping)
Level 1 → compaction → Level 2 SSTables
```

This design favors write throughput over read-optimized B-trees. For graph ingestion patterns where batch inserts of thousands of hyperedges are common, the LSM approach converts random writes (each hyperedge insertion touches multiple indices) into sequential I/O — the memtable absorbs the random writes and flushes them as sorted blocks. The tradeoff: point lookups by ID are slower than B-trees (need to check multiple levels), but range scans benefit from the sorted layout. For graph workloads, traversal patterns tend to be "find all neighbors" (range scan on adjacency) rather than "find this exact edge" (point lookup), making the LSM tradeoff favorable.

```java
public class GraphLSMTree {
    private final MemTable memtable;
    private final List<SSTable> levels;  // Immutable SSTables
    private final CompactionScheduler scheduler;

    public LookupResult getVertex(long id) {
        // Check memtable first (most recent writes)
        LookupResult result = memtable.get(id);
        if (result != null) return result;

        // Check SSTable levels from newest to oldest
        for (SSTable level : levels) {
            result = level.get(id);
            if (result != null) return result;
        }
        return null;  // Not found
    }

    public void flush() {
        SSTable newSSTable = SSTable.createFrom(memtable);
        levels.add(0, newSSTable);
        memtable.clear();
        scheduler.scheduleCompaction();
    }
}
```

## Attribute Indexing

Secondary indexes on vertex and hyperedge properties are stored as separate LSM-trees keyed by (property_name, property_value, vertex_id). Composite indexes concatenate multiple property keys. For graph-specific queries like "find all purchase orders where status = 'shipped' AND amount > 1000", the engine can either intersect two single-property index scans or use a composite index on (status, amount):

```sql
-- Conceptual query plan using secondary indexes
-- 1. Scan index: status='shipped' → 50K vertex IDs
-- 2. Scan index: amount > 1000 → 200K vertex IDs
-- 3. Intersect → 12K vertex IDs
-- 4. Fetch vertices and traverse hyperedges
```

Full-text search indexes tokenized text properties using inverted lists. The engine uses a custom tokenizer with support for stop-word removal, stemming (via Snowball), and n-gram matching for fuzzy queries. Text indexes are stored as LSM-trees where the key is (token, vertex_id) and the value is the position list for ranking.

## Partitioning and Distribution

Partitioning distributes data across nodes by vertex ID hash (consistent hashing with 4096 virtual slots). Hyperedge adjacency information spans partitions: edges whose vertices fall on different nodes store remote pointers with partition-level routing information. Cross-partition traversals use scatter-gather queries:

```
Query: "Find all transactions involving customer C42"
1. Partition P0: C42 is local → find hyperedges H15, H23
2. H23 spans P0, P1, P2 → scatter query to P1, P2
3. P1 returns vertex V99 (local), P2 returns vertex V200 (local)
4. Gather results at coordinator → assemble response
```

The scatter-gather overhead is mitigated by locality-aware vertex ID assignment. Related vertices (frequent co-participants in hyperedges) are assigned IDs that hash to the same partition. This is done through a graph partitioning pre-pass during data import — the METIS algorithm partitions the graph into k balanced parts with minimum edge cut, then assigns partition-based ID ranges. For workloads with stable relationship patterns, this reduces cross-partition queries by 2-5x.

## Query Execution and Optimization

HyperGraph's query planner uses a cost model that accounts for adjacency lookups, index scans, and cross-partition communication costs. The optimizer rewrites queries to push filters as close to the data as possible — "filter on vertex property before traversing hyperedge" rather than the reverse. Join orders are chosen based on selectivity estimates maintained through hyperloglog sketches (not exact counts, for memory efficiency). The planner supports both left-deep and bushy join trees, preferring left-deep for its lower memory footprint during execution.

## Performance Characteristics

On the LDBC Social Network Benchmark (SF-300), HyperGraph's storage engine achieves 85K operations/second on a 3-node cluster for interactive queries. Point lookups by ID take ~500 microseconds at p50 (below 2ms at p99) on NVMe storage. Range scans over hyperedge adjacency lists achieve 500 MB/s sequential read bandwidth. The write path sustains 40K hyperedge inserts/second (each with average 5 incident vertices) due to the LSM's batch-friendly design. These numbers are competitive with property graph databases for graph workloads while supporting richer data modeling through hyperedges.

## Future Directions

The storage engine is evolving toward tiered storage (hot NVMe, warm SSD, cold HDD/object storage) with automated data movement based on access frequency. The MVCC system is being extended for distributed transactions using timestamp-based ordering. And the LSM compaction strategy is being adapted to graph-specific patterns — for example, adjacency-aware compaction that co-locates frequently accessed vertex pairs within the same SSTable, reducing read amplification for common traversal patterns. The core lesson from building this engine is that graph workloads have different access patterns than either OLTP or OLAP, and a storage engine designed for graphs from scratch (rather than adapting a relational or key-value engine) can exploit those patterns for significant performance gains.
