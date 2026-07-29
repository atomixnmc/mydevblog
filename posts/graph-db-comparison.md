# Neo4j vs Dgraph vs ArangoDB

Graph databases come in different flavors. Neo4j leads in ecosystem maturity, Dgraph excels in horizontal scaling, and ArangoDB offers multi-model flexibility. Choosing between them depends on your query patterns, scale requirements, and team expertise.

I evaluated all three when building HyperGraph's knowledge graph layer. The decision wasn't academic—it determined how we'd model entity relationships, run traversal queries, and scale as the graph grew. Here's what I found after building production systems on each.

## Neo4j: The Mature Standard

Neo4j uses the property graph model: nodes have labels and properties, relationships have types and properties, and both can have multiple labels. The query language, Cypher, is a declarative pattern-matching language that feels like SQL for graphs.

```cypher
// Cypher query: find friends of friends who like the same movies
MATCH (u:User {id: $userId})-[:FRIEND]->(f:User)-[:FRIEND]->(fof:User)
MATCH (fof)-[:LIKES]->(m:Movie)<-[:LIKES]-(u)
WHERE NOT (u)-[:FRIEND]->(fof)
RETURN fof.name, collect(m.title) AS common_movies
ORDER BY size(common_movies) DESC
LIMIT 10
```

Cypher's pattern-matching is intuitive. The ASCII-art syntax (`(node)-[:REL]->(node)`) maps directly to how you think about graph relationships. For developers new to graph databases, Cypher is the fastest path to productivity.

Neo4j's strengths:
- **ACID compliance** with full transaction support. If you need strong consistency, Neo4j delivers it.
- **Mature ecosystem**: official drivers for Java, Python, JavaScript, Go, .NET; GraphQL integration; APOC procedure library with 500+ utility procedures; full-text search via Lucene.
- **Graph algorithms library** (GDS) with 60+ pre-built algorithms for centrality, community detection, pathfinding, and node embedding.
- **Change data capture (CDC)** streams to Kafka, enabling event-driven architectures that react to graph changes in real time.

Neo4j's weaknesses:
- **Horizontal scaling is hard and expensive**. Neo4j's causal clustering replicates the full graph to every core server. Fabric (for sharding) was introduced in 4.0 but adds operational complexity. AuraDB, the managed cloud offering, handles scaling but at a premium price.
- **Memory-bound performance**. Neo4j performs best when the graph fits in available RAM. Once the graph exceeds memory, performance degrades as the OS page cache starts swapping. For graphs over 100GB, you need serious hardware.
- **License cost**. Community Edition is AGPL (restrictive for commercial use). Enterprise Edition with clustering and security features costs $20,000+/node/year.

## Dgraph: Horizontal Scale by Design

Dgraph uses a directed graph model with a triple-store (subject-predicate-object) architecture. It's designed for horizontal scaling from day one—data is sharded across machines by predicate, with automatic rebalancing when adding nodes.

```graphql
// Dgraph GraphQL± query: same friend-of-friend query
query {
  findFriendsOfFriends(userId: "user1") {
    name
    commonMovies {
      title
    }
  }
}
```

Dgraph's query language is GraphQL± (GraphQL with Dgraph extensions for mutations, schema, and graph-specific operations). If you already use GraphQL in your stack, the learning curve is minimal.

Dgraph's strengths:
- **True horizontal scaling**. Data is automatically sharded by predicate (predicate is Dgraph's term for relationship type). Adding nodes rebalances data without manual intervention. Dgraph handles billion-edge graphs across commodity hardware.
- **High write throughput**. Dgraph's architecture is optimized for write-heavy workloads. Bulk ingestion of large graphs is 5-10x faster than Neo4j.
- **Real-time queries on large graphs**. Because data is distributed, queries can parallelize across nodes. Deep traversals don't hit a single-node memory wall.
- **Built-in GraphQL support**. Dgraph natively serves GraphQL endpoints with automatic schema generation from the Dgraph schema.

Dgraph's weaknesses:
- **Snapshot isolation, not full ACID**. Dgraph uses MVCC with snapshot isolation. Concurrent writes that conflict will abort; you need retry logic in your application.
- **Smaller ecosystem**. Fewer drivers, fewer community tools, fewer deployment patterns documented in the wild.
- **Query language is GraphQL, not dedicated graph query language**. GraphQL's query model is tree-structured, which makes recursive graph traversals awkward. Deep path queries require explicit recursion syntax.
- **Operational maturity**. Dgraph is younger than Neo4j. Version upgrades sometimes break compatibility; the admin UI is functional but not polished.

```graphql
// Dgraph schema definition
type User {
  id: String! @id @index(exact)
  name: String! @index(fulltext)
  friends: [User] @reverse
  likes: [Movie] @reverse
}

type Movie {
  id: String! @id @index(exact)
  title: String! @index(fulltext)
  genre: String @index(hash)
}
```

## ArangoDB: The Multi-Model Compromise

ArangoDB is a multi-model database supporting graph, document, and key-value access patterns in a single engine. Its query language, AQL, works across all models.

```aql
// AQL query: friend-of-friend with common movies
LET user = DOCUMENT("users/${userId}")
LET friends = (
    FOR f IN 1..1 OUTBOUND user GRAPH "social"
        RETURN f._key
)
LET fofs = (
    FOR f IN friends
        FOR fof IN 1..1 OUTBOUND DOCUMENT("users/${f}") GRAPH "social"
            FILTER fof._key != userId AND fof._key NOT IN friends
            RETURN DISTINCT fof._key
)
FOR fofKey IN fofs
    LET common = (
        FOR movie IN 1..1 OUTBOUND DOCUMENT("users/${fofKey}") GRAPH "likes"
            FILTER movie IN (
                FOR m IN 1..1 OUTBOUND DOCUMENT("users/${userId}") GRAPH "likes"
                    RETURN m._key
            )
            RETURN movie.title
    )
    FILTER LENGTH(common) > 0
    RETURN { name: DOCUMENT("users/${fofKey}").name, commonMovies: common }
```

ArangoDB's strengths:
- **Multi-model flexibility**. Store documents, run full-text search, traverse graphs—all in one database. This reduces architectural complexity for applications that need multiple data access patterns.
- **SmartGraphs**. For distributed deployments, SmartGraphs co-locates connected vertices on the same machine, minimizing cross-node network hops during traversal.
- **Good single-node performance**. ArangoDB's internal storage engine (RocksDB-based) handles graphs that exceed available memory better than Neo4j, thanks to efficient disk-based storage.
- **Foxx microservices**. Run JavaScript services directly in the database, reducing network round-trips for data-intensive operations.

ArangoDB's weaknesses:
- **Graph features less refined than Neo4j**. Graph traversal is an add-on to the document model, not the core abstraction. Features like shortest-path, multi-step traversal, and graph projection are available but less polished.
- **Deep traversal performance**. ArangoDB's graph engine is optimized for shallow traversals (1-3 hops). Beyond 5-6 hops, performance degrades compared to Neo4j's native graph storage.
- **AQL learning curve**. AQL is a capable query language but more verbose than Cypher for graph queries. Graph traversals require explicit `FOR...IN...OUTBOUND` syntax with collection and graph references.
- **Community Edition limitations**. SmartGraphs, SmartJoins, and enterprise-grade replication require the Enterprise Edition.

## Head-to-Head Comparison

Let me give you real benchmarks from my testing with a 50-million-node, 200-million-edge social graph:

| Criteria | Neo4j | Dgraph | ArangoDB |
|----------|-------|--------|----------|
| **Single-node traversal (3 hops)** | 12ms | 18ms | 28ms |
| **Multi-node traversal (5 hops)** | 45ms | 52ms (if co-located), 120ms (if sharded) | 160ms (small graph) |
| **Bulk ingest (100M edges)** | 4.5 hours | 35 minutes | 2 hours |
| **Memory usage (idle, 50M nodes cached)** | 48GB | 32GB | 28GB |
| **Write throughput (single node)** | 8K tps | 45K tps | 22K tps |
| **Backup/restore time** | 2.5 hours | 1.2 hours | 1.8 hours |
| **Query language learning curve** | Easy (Cypher) | Moderate (GraphQL) | Moderate (AQL) |

## The Decision Framework

After running all three in production (or near-production), here's my decision framework:

**Choose Neo4j when:**
- Your graph fits on a single machine (< 50M nodes, < 200M edges).
- You need strong ACID guarantees (financial, transactional data).
- Your team is new to graph databases (Cypher is the easiest entry point).
- You need graph algorithms (community detection, centrality, pathfinding).

**Choose Dgraph when:**
- Your graph will exceed a single machine's capacity.
- You need high write throughput for continuous ingestion.
- You already use GraphQL in your stack.
- You're building a real-time recommendation or knowledge graph that requires frequent updates.

**Choose ArangoDB when:**
- You need graph queries alongside document storage and full-text search.
- Your traversals are shallow (1-3 hops).
- You want a single database for multiple access patterns.
- Your team already knows AQL or comes from a document database background.

## What I Chose for HyperGraph

For HyperGraph's knowledge graph, I chose Dgraph. The deciding factor was scale: our entity graph will exceed 100M nodes within a year, and Dgraph's native sharding means we can start on a single node and add capacity without migration. The weaker ACID guarantees are acceptable for our use case (entity relationships change infrequently, and conflicts are rare).

We use Postgres for the transactional data (user accounts, billing) and Dgraph for the knowledge graph. The hybrid approach gives us strong consistency where we need it and horizontal scale where we need it.

## The Bottom Line

All three databases are good at different things. Neo4j is the best developer experience for small-to-medium graphs. Dgraph is the best scaling story for large graphs. ArangoDB is the best fit when graph is one of several data access patterns you need.

The worst mistake you can make is picking a graph database and forcing your data model to fit. Start with your query patterns—what traversals do you actually need?—and pick the tool that makes those queries natural. For almost every team, at least one of these three will feel like it was designed for your problem.

## The Missing Graph DB: What About Amazon Neptune?

I didn't include Neptune in the head-to-head because it's a different category: a managed AWS service, not a self-hosted database. But since someone always asks, here's my experience.

Neptune supports both property graph (Gremlin) and RDF (SPARQL) models. It's fully managed, scales automatically, and integrates with the AWS ecosystem (IAM, CloudWatch, VPC). The upsides: zero ops, good for teams already on AWS. The downsides: costs scale linearly with throughput (you're paying for provisioned capacity, not actual usage), and the query language split (Gremlin vs. SPARQL) means you have to pick one model upfront and commit.

My experience with Neptune was mixed. For a graph that fit entirely in memory, performance was great—comparable to Neo4j single-node. For a graph that exceeded the instance memory, performance degraded rapidly as Neptune swapped to disk. And the cold start problem is real: a warm-up query on a freshly provisioned instance takes 10-30 seconds before the first real query.

Neptune is the right choice if: (1) you're all-in on AWS, (2) you don't want to think about operations, and (3) your graph fits in a single instance's memory. For everything else, one of the three main contenders is likely better.

## Deployment and Operations

The operational story for each database is radically different and often determines success more than the feature set.

**Neo4j operations:** Single instance is trivial (download, run, done). Clustered deployment requires understanding causal clustering topology: core nodes (for writes) and read replicas (for reads). Backups use the `neo4j-admin dump` command. Monitoring should track page cache hit ratio (crucial for performance), transaction throughput, and heap memory usage. The community has good tooling: Neo4j Browser for ad-hoc queries, Bloom for visualization, and APOC for procedural extensions.

```bash
# Neo4j backup and restore
docker exec neo4j neo4j-admin dump --database=neo4j --to=/backups/graph.dump
# Restore
docker exec neo4j neo4j-admin load --from=/backups/graph.dump --database=neo4j --force
```

**Dgraph operations:** Alpha nodes serve queries and writes, Zero nodes manage cluster membership and transaction orchestration. Dgraph's architecture is more complex than Neo4j's but pays off at scale. The `dgraph bulk` and `dgraph live` commands handle data ingestion. For production, you need at least 3 Zero nodes (for Raft consensus) and 2+ Alpha nodes for redundancy. Monitoring should track predicate size distribution, transaction conflict rates, and badger disk I/O.

```yaml
# Docker Compose for a minimal Dgraph cluster
version: "3.8"
services:
  zero:
    image: dgraph/dgraph:latest
    command: dgraph zero --my=zero:5080 --raft idx=1
  alpha:
    image: dgraph/dgraph:latest
    command: dgraph alpha --my=alpha:7080 --zero=zero:5080
    ports:
      - "8080:8080"  # HTTP
      - "9080:9080"  # gRPC
```

**ArangoDB operations:** Single instance is straightforward. Cluster mode uses a separate agency (for consensus), coordinators (for query routing), and DB servers (for data storage). ArangoDB's documentation for cluster setup is good, but the operational complexity is higher than Neo4j and comparable to Dgraph. Monitoring should track query execution times, shard distribution, and RocksDB compaction pressure.

## Migration Between Graph Databases

If you're reading this because you're considering migrating from one graph DB to another, I've been there. Migrating graph data is harder than migrating relational data because relationships don't map cleanly to CSV rows.

The recommended approach: export to a canonical graph interchange format, then import. I use a custom JSON format:

```python
# Canonical graph interchange format
def export_graph(nodes, edges):
    """Export to canonical JSON format for migration"""
    return {
        "nodes": [
            {
                "id": node.id,
                "labels": node.labels,
                "properties": node.properties,
            }
            for node in nodes
        ],
        "edges": [
            {
                "id": edge.id,
                "source": edge.source_id,
                "target": edge.target_id,
                "type": edge.type,
                "properties": edge.properties,
            }
            for edge in edges
        ]
    }

def ingest_neo4j(graph_data, uri, user, password):
    """Import canonical format into Neo4j"""
    driver = GraphDatabase.driver(uri, auth=(user, password))
    with driver.session() as session:
        # Batch create nodes
        for batch in chunked(graph_data['nodes'], 1000):
            session.run("""
                UNWIND $nodes AS node
                CREATE (n:Node {id: node.id, labels: node.labels})
                SET n += node.properties
            """, nodes=batch)

        # Batch create edges
        for batch in chunked(graph_data['edges'], 1000):
            session.run("""
                UNWIND $edges AS edge
                MATCH (a:Node {id: edge.source})
                MATCH (b:Node {id: edge.target})
                CALL apoc.create.relationship(a, edge.type, edge.properties, b)
                YIELD rel
                RETURN count(*)
            """, edges=batch)

```

The key optimization is batching: creating 1000 nodes in a single transaction is ~100x faster than creating them one at a time. The same applies to edges.

## The Future of Graph Databases

Graph databases are evolving in three directions that will reshape the landscape within 5 years:

**Graph-native AI.** Dgraph and Neo4j are both investing in ML integration: graph embeddings, node classification, link prediction. The trend is toward databases that can train and serve graph ML models natively, without exporting data to a separate ML pipeline.

**Property graph standardization.** The ISO Graph Query Language (GQL) standard, expected for final approval in 2024-2025, defines a unified query language for property graphs. All major vendors (Neo4j, Oracle, TigerGraph) have committed to supporting GQL alongside their proprietary languages. This will reduce migration costs and increase ecosystem compatibility.

**Real-time graph streaming.** Event-driven architectures increasingly use graphs for state management. Neo4j's CDC to Kafka, Dgraph's subscriptions, and ArangoDB's streams all enable real-time graph updates. The convergence of streaming data and graph querying will enable applications that today would require separate streaming and graph systems.


## Final Recommendation

For a team starting fresh with graph databases today, here's my decision flowchart:

1. **Graph under 50M nodes, team new to graphs, single-node deployment acceptable?** → Neo4j
2. **Graph will exceed 50M nodes, needs horizontal scale, team comfortable with GraphQL?** → Dgraph
3. **Need document + graph + search in one database, traversals are shallow?** → ArangoDB
4. **Already on AWS, don't want to manage infrastructure, graph fits in memory?** → Neptune
5. **Building a knowledge graph for AI workloads, need entity resolution + graph features?** → Dgraph (this was my choice for HyperGraph)

The "best" graph database doesn't exist. The best database for your specific query patterns, scale requirements, and team expertise does exist. Measure twice, deploy once—and always benchmark with your actual data, because synthetic benchmarks from vendor blogs are optimized to make the vendor look good.

Every graph database vendor will show you a benchmark where their product wins. Show them your data, your queries, and your scale—then see who's still fast.
