# Neo4j vs Dgraph vs ArangoDB

Graph databases come in different flavors. Neo4j leads in ecosystem maturity, Dgraph excels in horizontal scaling, and ArangoDB offers multi-model flexibility. Choosing between them depends on your query patterns, scale requirements, and team expertise.

Neo4j uses a property graph model with labeled nodes and relationships. Its query language, Cypher, is pattern-matching SQL-like syntax that's intuitive for connected data. Neo4j is ACID-compliant and supports full-text search, spatial queries, and graph algorithms. The trade-off: scale-out requires Neo4j AuraDB or Fabric, which is expensive. Single-instance performance degrades when the graph exceeds available memory.

Dgraph uses a directed graph model with a triple-store architecture. It's designed for horizontal scaling from day one — data is sharded across machines by predicate. Dgraph's query language is GraphQL± (GraphQL with Dgraph extensions). It handles billion-edge graphs across commodity hardware. The trade-off: Dgraph's ACID guarantees are weaker (snapshot isolation), and the ecosystem is smaller than Neo4j's.

ArangoDB is a multi-model database supporting graph, document, and key-value access patterns. Its query language, AQL, works across models. You can join documents as graph traversals. ArangoDB's SmartGraphs feature optimizes distributed graph traversals by co-locating connected vertices. The trade-off: graph-specific features are less refined than Neo4j, and traversal performance on deep paths may lag.

For small to medium graphs (<10M nodes), Neo4j offers the best developer experience. For graphs that must scale across multiple machines, Dgraph is purpose-built. For teams that need graph queries alongside document storage, ArangoDB reduces architectural complexity. All three support WebSocket subscriptions, but only Neo4j has mature change data capture (CDC) streaming.
