# HyperGraph vs Property Graph

Graph data models come in two main flavors: property graphs and hypergraphs. Property graphs (used by Neo4j, JanusGraph) connect pairs of nodes with labeled, directed edges. Hypergraphs connect any number of nodes with a single hyperedge. The choice affects query expressiveness and model complexity.

In a property graph, edges are binary — they connect exactly two nodes. Representing an n-ary relationship (a transaction involving three accounts, a meeting with five attendees) requires reification: creating an intermediate node that represents the relationship and connecting each participant to it. This works but adds indirection.

In a hypergraph, a hyperedge can connect any number of nodes directly. The three-account transaction is a single hyperedge connecting all three accounts. The meeting is a hyperedge connecting all five attendees. This is more natural for n-ary relationships and eliminates the intermediate node pattern.

Hypergraphs introduce modeling power at the cost of implementation complexity. Hypergraph databases (HyperGraphDB, Amadeus) must handle variable-arity edges, which complicates storage layout, indexing, and query optimization. Property graphs benefit from simpler B-tree or adjacency-list storage.

Query languages reflect the difference. Cypher (property graph) uses pattern matching with fixed-size patterns: `(a)-[r]->(b)`. A hypergraph query language must match patterns with variable binding to multiple endpoints: `(a, b, c) IN hyperedge`. SPARQL-like semantics with blank nodes and reification can express hypergraph patterns in property graphs but with cumbersome syntax.

Most real-world applications work well with property graphs. Hypergraphs are genuinely useful for biochemical pathways (multi-molecule reactions), social network group dynamics (multi-person interactions), and hierarchical data provenance. For e-commerce, IoT, and most enterprise use cases, property graphs provide the right level of expressiveness with simpler tooling.
