# HyperGraph vs Property Graph: Choosing the Right Graph Model

Graph data models come in two main flavors: property graphs and hypergraphs. Property graphs (used by Neo4j, JanusGraph, Amazon Neptune) connect pairs of nodes with labeled, directed edges. Hypergraphs connect any number of nodes with a single hyperedge. The choice affects query expressiveness, model complexity, and the kinds of problems you can represent naturally. I've spent years building applications on both models, and the decision isn't about which is "better" — it's about which set of tradeoffs matches your data and queries.

## The Property Graph Model

In a property graph, edges are binary — they connect exactly two nodes. Each edge has a label (type), direction, and properties (key-value pairs). Nodes also have labels and properties. This is the model behind Neo4j, the most widely deployed graph database:

```cypher
// Property graph model: each relationship is binary
CREATE (alice:Person {name: "Alice"})
CREATE (bob:Person {name: "Bob"})
CREATE (charlie:Person {name: "Charlie"})
CREATE (alice)-[:KNOWS {since: 2020}]->(bob)
CREATE (bob)-[:KNOWS]->(charlie)
```

Representing an n-ary relationship — a transaction involving three accounts, a meeting with five attendees — requires reification: creating an intermediate node that represents the relationship and connecting each participant to it:

```cypher
// Reification pattern for n-ary relationship
CREATE (meeting:Meeting {date: "2024-01-15", location: "Room 301"})
CREATE (alice)-[:ATTENDED]->(meeting)
CREATE (bob)-[:ATTENDED]->(meeting)
CREATE (charlie)-[:ATTENDED]->(meeting)
CREATE (meeting)-[:HAS_AGENDA]->(agenda:Document {title: "Q1 Planning"})
```

This works but adds indirection. Every query that needs the participants of a meeting must traverse through the Meeting node, adding a hop to each traversal. For queries that are predominately about n-ary relationships, this indirection adds significant cognitive and computational overhead.

## The Hypergraph Model

In a hypergraph, a hyperedge can connect any number of nodes directly. The three-account transaction is a single hyperedge connecting all three accounts. The meeting is a hyperedge connecting all five attendees:

```python
# Hypergraph model (pseudocode for a hypergraph query)
CREATE hyperedge Transaction {
    type: "wire_transfer",
    amount: 15000,
    timestamp: "2024-01-15T10:30:00Z",
    participants: (account_A, account_B, account_C)
}

# Query: find all transactions involving account_A
MATCH (account_A) IN hyperedge (t:Transaction)
RETURN t
```

This is more natural for n-ary relationships and eliminates the intermediate node pattern entirely. The hyperedge stores the relationship properties directly, and each participant is an equal member of the relationship — no directionality to complicate queries about who is related to whom.

## Modeling Power and Complexity

Hypergraphs introduce modeling power at the cost of implementation complexity. Hypergraph databases (HyperGraphDB, Amadeus, Kùzu with hyperedge extensions) must handle variable-arity edges, which complicates storage layout, indexing, and query optimization. The adjacency index for a hypergraph needs to support "find all hyperedges containing vertex X" (reverse index) and "find all vertices in hyperedge Y" (forward index), where each hyperedge's arity can range from 1 to thousands.

Property graphs benefit from simpler B-tree or adjacency-list storage. Since every edge has exactly two endpoints, the adjacency list is a straightforward pair (source_id, target_id, edge_label). Indexing is simpler: the edge table has fixed-size columns for source and target. The query planner can make strong assumptions about join cardinality — every edge join returns matching nodes in pairs.

## Query Language Comparison

Query languages reflect the fundamental model difference. Cypher (property graph) uses pattern matching with fixed-size patterns:

```cypher
// Cypher: all paths from Alice to Charlie through KNOWS
MATCH (alice:Person {name: "Alice"})-[:KNOWS*1..3]->(charlie:Person {name: "Charlie"})
RETURN alice, charlie

// Cypher: participants in meetings chaired by Alice
MATCH (alice:Person {name: "Alice"})-[:CHAIRS]->(m:Meeting)<-[:ATTENDED]-(p:Person)
RETURN m.date, p.name
```

A hypergraph query language must match patterns with variable binding to multiple endpoints:

```sql
-- Hypergraph query: find all hyperedges containing both Alice and Bob
SELECT hyperedge_id
FROM hyperedge_membership
WHERE vertex_id IN ('Alice', 'Bob')
GROUP BY hyperedge_id
HAVING COUNT(DISTINCT vertex_id) = 2

-- Hypergraph query: meetings chaired by Alice with all attendees
SELECT h.properties->>'date' AS meeting_date,
       ARRAY_AGG(m.vertex_id) AS attendees
FROM hyperedges h
JOIN hyperedge_membership m ON h.id = m.hyperedge_id
WHERE h.type = 'Meeting'
  AND h.contains_vertex('Alice')
  AND h.properties->>'chair' = 'Alice'
GROUP BY h.id, h.properties
```

SPARQL-like semantics with blank nodes and reification can express hypergraph patterns in property graphs, but with verbose syntax that obscures the intent:

```sparql
# Property graph reification in SPARQL
# Representing a 3-way transaction
:tx1 a :Transaction ;
      :amount 15000 ;
      :involves [ :role "sender" ; :entity :account_A ] ,
               [ :role "sender" ; :entity :account_B ] ,
               [ :role "receiver" ; :entity :account_C ] .
```

## Performance Tradeoffs

For binary relationship workloads, property graphs are faster across the board. The simpler storage format means fewer pointer dereferences per traversal, and the query planner's cardinality estimates are more accurate. On the LDBC Social Network Benchmark (which is designed for property graphs), Neo4j and JanusGraph outperform hypergraph databases by 2-5x on most queries.

For n-ary relationship workloads, hypergraphs win decisively. Finding all participants of a purchase order with 100 line items requires a single hyperedge lookup vs. traversing 100 binary relationships through a reified node. Queries like "find all meetings that Alice and Bob both attended" are a single index intersection on the hyperedge membership table vs. a multi-hop Cypher pattern. The crossover point varies by implementation, but in my benchmarks, hypergraphs start winning at arity >= 5 for queries that aggregate over hyperedge members.

## Schema Flexibility and Constraints

Property graphs are generally schemaless or schema-optional — nodes and edges can have arbitrary properties. Hypergraphs need more structure because hyperedge types determine which vertex roles are valid. A Transaction hyperedge has senders and receivers; a Meeting hyperedge has attendees, chairs, and agenda items. This is both a strength (the schema enforces valid modeling) and a weakness (schema changes require migration). For exploratory data modeling, property graphs are more forgiving; for production systems with complex n-ary relationships, hypergraph schemas catch modeling errors early.

## Real-World Use Cases

Most real-world applications work well with property graphs. Social networks (friend relationships, followers), recommendation engines (user-item interactions), knowledge graphs (entity-entity relationships), and network topology (device-device connections) are all naturally binary. I've built all of these on property graphs without pain.

Hypergraphs are genuinely useful for:
- **Biochemical pathways**: Multi-molecule reactions where substrates, products, and catalysts participate in a single reaction hyperedge. A metabolic pathway with 50 reactions and 100 metabolites is naturally a hypergraph.
- **Social network group dynamics**: Group chat, team membership, event attendance — all multi-person relationships that are awkward as binary edges.
- **Data provenance**: A data processing pipeline where a single operation consumes multiple inputs and produces multiple outputs is a hyperedge.
- **Supply chain**: Purchase orders, shipments, and work orders connect multiple parties, multiple items, and multiple locations.

## The Hybrid Approach

Some modern databases take a hybrid approach. EdgeDB uses a graph model with explicit n-ary relationship support at the schema level while storing binary edges internally. RedisGraph supports hyperedge-like constructs through its property graph model with array properties. The trend is toward property graphs as the default and hypergraph patterns being expressible when needed, rather than committing fully to either model.

My recommendation: start with a property graph. If you find yourself using the intermediate node pattern frequently and it hurts query performance, evaluate hypergraph alternatives. For most teams, the simplicity and tooling maturity of property graphs outweigh the modeling elegance of hypergraphs. But for domains where n-ary relationships are the core abstraction, not an edge case, hypergraphs provide a fundamentally better fit that's worth the additional complexity.
