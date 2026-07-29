# HyperGraph Storage Engine: Architecture and Design

HyperGraph is a graph database designed to store and query complex, multi-relational data structures where edges can connect more than two nodes. Unlike property graphs (Neo4j) or RDF stores, HyperGraph's core abstraction is the hyperedge: a relationship that connects an arbitrary number of vertices.

**Physical storage layout** uses a hybrid approach combining columnar storage for attributes with adjacency lists for graph structure. Vertices are stored in sorted, compressed row-oriented blocks. Hyperedge adjacency lists maintain pointers to all incident vertices, with both forward (edge→vertex) and reverse (vertex→edge) indices. This bidirectional indexing enables efficient traversal in both directions without full scans.

**The write-ahead log (WAL)** ensures durability while supporting high-throughput ingestion. HyperGraph implements a multi-version concurrency control (MVCC) system where each transaction sees a consistent snapshot of the graph at its start time. Write operations create new versions of affected hyperedges and vertices rather than modifying in place. The garbage collector asynchronously reclaims versions older than the oldest active transaction.

**Storage engine internals** use a log-structured merge-tree (LSM-tree) architecture adapted for graph workloads. New writes go to an in-memory memtable, then flush to sorted immutable SSTables. Compaction merges overlapping SSTables while resolving tombstones. This design favors write throughput over read-optimized B-trees, which is a deliberate choice for graph insertion patterns.

**Attribute indexing** supports both exact lookups and range scans. Secondary indexes on vertex and hyperedge properties are stored as separate LSM-trees keyed by (property_name, property_value, vertex_id). Composite indexes concatenate multiple property keys. Full-text search indexes tokenized text properties using inverted lists.

**Partitioning** distributes data across nodes by vertex ID hash. Hyperedge adjacency information spans partitions: edges whose vertices fall on different nodes store remote pointers with partition-level routing information. Cross-partition traversals use scatter-gather queries, optimized through locality-aware vertex ID assignment.
