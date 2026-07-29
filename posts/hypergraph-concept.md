# HyperGraph: Data + Index + Program


![](images/2020/hypergraph-concept_img-001.png)

![](images/2020/hypergraph-concept_img-002.png)

![](images/2020/hypergraph-concept_img-003.png)

HyperGraph is a conceptual architecture that unifies data storage, indexing, and computation into a single graph structure. Unlike traditional systems that separate databases, search indexes, and application logic, HyperGraph represents all three as graph operations.

I've been building the HyperGraph ecosystem for the better part of a decade. It started as a thought experiment during my game development days: why does every game engine need to wire together a database, a spatial search tree, a scripting runtime, and a networking layer separately when they're all operating on the same entities and relationships? The entities are nodes, the relationships are edges, the state is properties on both. That's a graph. Everything else is optimization.

This idea grew into something much larger than game engines, and I want to walk through the full concept, the implementation decisions, the tradeoffs, and what I've learned from building it.

## The Fundamental Observation

Databases, indexes, and programs all solve the same problem: they answer questions about data. A database stores rows and answers SQL queries. An index stores keys and answers lookup queries. A program stores state in variables and answers computation queries through evaluation. These are different optimization strategies for the same fundamental operation: given a query, return a result based on stored or derived data.

Traditional systems separate these concerns because of historical hardware constraints. Disk was slow, memory was expensive, and CPU was scarce. If you wanted acceptable performance, you specialized. A B-tree was optimized for disk seeks. A hash table was optimized for memory access. An AST interpreter was optimized for CPU-bound evaluation. The specialization worked, but it created artificial boundaries. Every system integration point—between database and application, between index and query planner, between cache and persistence—is a source of complexity, latency, and bugs.

HyperGraph rejects this specialization. It treats data, indexes, and programs as different views of the same underlying structure: a directed graph with labeled edges and typed properties on every node and edge. A query is a traversal of this graph with filters and aggregations. A computation is a traversal with side effects. An index is a traversal optimized for a specific access pattern.

## The Core Architecture

The HyperGraph architecture has three layers. The storage layer is a persistent directed multigraph where each node has a unique ID, a type label, a set of property key-value pairs, and a set of outgoing edges (each with a label, target node ID, and property set). The indexing layer is a set of data structures built on top of the storage graph that accelerate specific traversal patterns: property indexes for exact match and range queries, structural indexes for subgraph isomorphism, and embedding indexes for similarity search.

The program layer is where HyperGraph differs most from traditional systems. A HyperGraph program is itself a graph: a directed acyclic graph of computation nodes where each node is an operation (filter, map, reduce, aggregate, traverse, external API call) and each edge is a data dependency. The program graph is stored in the same HyperGraph instance as the data it operates on. This means you can query the program, index the program, and compose programs programmatically.

The implications are subtle but profound. If your query logic is stored as a graph alongside your data, you can treat query composition as a graph operation. You can merge two query graphs to produce a combined query. You can cache intermediate results at program graph nodes. You can even write a HyperGraph program that generates and executes HyperGraph programs, creating a self-modifying query system.

## The Game Engine Origins

The first HyperGraph prototype was a game engine component I called the "Entity-Relationship Graph" (ERG). Instead of Unity's Entity-Component pattern—where entities are integer IDs and components are flat data blobs—I built a graph where every entity was a node, every relationship (parent-child, spatial containment, ownership, friendship) was an edge, and every component was a property set on the node.

The performance characteristics were surprising. Spatial queries (find all entities within a radius of this position) were slower than a dedicated spatial hash by about 2x—that was expected. But relationship queries (find all entities owned by this player that are within a radius of this position) were faster than any relational composition because the traversal happened in one pass rather than two. The graph naturally handled the join without a join operation.

The game engine prototype had 30,000 entities with an average of 8 relationships each. Memory overhead was roughly 2KB per node (including edges and properties), which is large for a game engine but workable for the simulation layer. The real bottleneck was not memory or query speed but garbage collection in the traversal engine. The implementation was in C# (via JMonkeyEngine interop), and the GC pauses during complex graph traversals were noticeable at 60 FPS.

## Building the Index Layer

The index layer took three iterations to get right. The first attempt used a single global adjacency list with per-label edge indices. This worked for small graphs (under 10,000 nodes) but collapsed for larger graphs because neighborhood queries required scanning all edges with a matching label.

The second attempt added per-node inverted indexes for property queries. This helped property lookups but didn't address structural queries (finding subgraph isomorphisms, which is NP-complete in general and requires serious optimization for practical use).

The third and current iteration uses a combination of strategies. Property indexes use learned index structures (RMI-based) that outperform B-trees for high-cardinality properties by roughly 30%. Structural indexes use a pattern-mining approach: frequently accessed subgraph patterns are detected during query execution and materialized as composite nodes. The system learns which queries are common and optimizes for them automatically.

The embedding index is the most recent addition. Node embeddings are stored as fixed-size float vectors (256 dimensions by default) on a dedicated node property. The index builds a HNSW (Hierarchical Navigable Small World) graph over these embeddings, enabling approximate nearest-neighbor search in O(log n) time. This allows semantic queries ("find graphs similar to this one") that were impossible in the earlier iterations.

## The Program Layer

The program layer is the most ambitious part of HyperGraph and the least mature. The current implementation is a graph-based interpreter: you construct a program graph, feed it input data, and the interpreter traverses the graph, executing each computation node and passing results along edges.

The execution model is asynchronous and dataflow-driven. Each computation node fires when all its input edges have values. Nodes can be pure functions, database queries, external API calls, or subgraph invocations (a program node that executes another program graph). The scheduler detects parallelism automatically: nodes with independent inputs execute concurrently.

I've benchmarked the interpreter against equivalent Python scripts and found that HyperGraph program execution is 2-5x slower for simple linear pipelines (the interpreter overhead dominates) but 3-10x faster for complex pipelines with branching, merging, and conditional execution (the automatic parallelism beats hand-optimized threading). The tradeoff favors HyperGraph for the kind of complex, branching query workloads that are common in AI and data analysis.

## The Self-Referential Trick

The most mind-bending feature of HyperGraph is that the HyperGraph system itself is a HyperGraph. The storage layer nodes describe the storage layer. The index definitions are nodes with edges to the indexed property definitions. The program graphs are stored as program graph nodes with edges to operation nodes.

This self-referential structure enables metaprogramming that's difficult in traditional systems. You can write a HyperGraph query that finds all indexing strategies that have been used for a particular property type. You can create a program that analyzes other programs and suggests optimizations. You can build a dashboard that visualizes the system architecture by querying the system metadata with the same API you use for application data.

Is this practical? Sometimes. The metaprogramming capabilities are genuinely useful for system administration and debugging. Being able to query "which indexes are stale based on update frequency" with a simple graph traversal has saved me hours of manual investigation. But the self-referential structure adds complexity to the implementation, and new contributors to the project consistently struggle with the bootstrap problem: understanding the system requires understanding the system.

## The Real Tradeoffs

HyperGraph makes three explicit tradeoffs against traditional architectures. First, it trades storage efficiency for query expressivity. Storing everything as a graph with labeled edges and property sets uses more space than normalized relational tables. The overhead is roughly 2-4x for storage, which is significant but manageable for the target scale (hundreds of millions of nodes, not billions).

Second, it trades raw query performance for query composability. A specialized system (like a dedicated key-value store or vector database) will always outperform HyperGraph on its specific workload. HyperGraph wins when you need to combine multiple query types in a single operation. For my visualization workloads, where I'm simultaneously filtering by property, searching by embedding similarity, and traversing structural relationships, HyperGraph outperforms composed specialized systems by 5-15x because there's no serialization or network overhead between query stages.

Third, it trades developer familiarity for conceptual coherence. Every developer knows SQL and REST APIs. Very few know graph traversal languages (even with Gremlin or Cypher as reference points). The onboarding cost for HyperGraph is real, and I've lost contributors who couldn't get comfortable with the graph-native thinking.

## Current Status and Future Direction

HyperGraph is powering the visualization backend for my entire AI ecosystem. It stores metadata about generated models, indexes them for search and similarity, and executes the generation pipeline graphs. The total dataset is roughly 2 million nodes with 15 million edges, stored in about 12GB of compressed data. Query latency averages 15ms for simple traversals and 200ms for complex subgraph searches.

The next major milestone is a distributed version that can span multiple machines. The current implementation is single-node with in-process replication to a secondary instance. Distributed graph traversals are well-studied in academic literature but have few production-ready implementations that match HyperGraph's architectural choices. I'm experimenting with a partitioning strategy based on graph community detection: densely connected subgraphs are colocated on the same node, minimizing cross-machine traversals.

HyperGraph is not a replacement for PostgreSQL or Redis or any other mature data system. It's a complementary architecture for workloads that need unified data-index-compute semantics. If your problem fits neatly into SQL tables or key-value stores, use those tools. If you find yourself wiring together three different data systems and still struggling with the integration complexity, HyperGraph's unified graph model might solve problems you didn't even know you had. It solved mine.
