# HyperGraph Query Language: Patterns and Semantics

HyperGraph extends property graph concepts with hyperedges—relationships connecting an arbitrary number of vertices. Its query language reflects this richer structure while maintaining familiar graph query patterns from Cypher and SPARQL.

**Path expressions** in HyperGraph use a bracket syntax to match hyperedges. A simple traversal `Person -[:WORKS_AT]-> Company` in property graph becomes `Person -[:WORKS_ON_PROJECT]-> (Person, Person, Project)` in HyperGraph, where the hyperedge connects multiple participants. The query language treats hyperedges as first-class tuple-like entities: `MATCH (a:Person) -[e:TEAM_MEMBER]-> (b:Person, c:Person, p:Project)` binds all endpoints.

**Pattern matching semantics** differ from binary graphs. A hyperedge pattern matches only when all specified endpoint variables align with the actual hyperedge structure. Partial matching is supported through wildcards: `(a) -[TEAM_MEMBER]-> (_, _, ?)` matches any TEAM_MEMBER hyperedge involving `a` with at least three endpoints. Underscore ignores specific vertices, while `?` checks arity constraints.

**Aggregation over hyperedges** enables powerful queries impossible in binary graphs. `MATCH (p:Project) OPTIONAL MATCH (p) <-[CONTRIBUTES]- (devs) RETURN p.name, count(devs), avg(devs.skill_level)` works because CONTRIBUTES hyperedges naturally encode many-to-many-to-one relationships without intermediate join tables.

**Schema introspection** is built into the query language. `SHOW HYPEREDGES` returns all hyperedge types with their arity and endpoint constraints. `SHOW ATTRIBUTES ON HYPEREDGE e:TEAM_MEMBER` describes the property schema for that hyperedge type. This enables dynamic query construction and visualization tools without out-of-band schema metadata.

**Traversal performance** benefits from arity-aware query planning. The optimizer distinguishes traversals that walk hyperedges via indexed adjacency (fast, single lookup) from those that scan all hyperedges of a type (slower, but sometimes necessary for schema-flexible queries). Query plans can be inspected with `EXPLAIN` to identify scan-heavy operations.

The language bridges between the precision of SQL (hyperedges as typed tuples with cardinality constraints) and the flexibility of graph traversal (path-based navigation with variable-length patterns). For applications modeling complex group relationships—org charts, multi-party contracts, collaboration networks—HyperGraph queries express naturally what binary graphs require join tables and traversal workarounds to achieve.
