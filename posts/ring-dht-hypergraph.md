# Rings DHT for HyperGraph

Rings is a distributed hash table (DHT) built for HyperGraph's decentralized graph storage. Unlike Kademlia (used by IPFS, Ethereum), Rings organizes peers into concentric rings based on latency and data locality.

## Ring Topology

```
                     ┌─────┐
                     │Core │   Ring 0: <1ms latency (same DC)
                    ┌┴─────┴┐
                    │ Region │  Ring 1: <10ms (same region)
                   ┌┴────────┴┐
                   │  Edge   │   Ring 2: <50ms (same continent)
                  ┌┴──────────┴┐
                  │  Global   │   Ring 3: >50ms
                 ┌┴────────────┴┐
                 │  Satellite  │   Ring 4: high latency links
                 └─────────────┘
```

Data is replicated at multiple rings. A node in the Core ring has a complete copy of the data it's responsible for. A node in the Edge ring has a partial copy (recent keys, cached entries). A Global node has only routing information.

## Lookup Algorithm

```rust
fn lookup(key: &Key) -> Result<Vec<u8>> {
    // Hash the key to find the responsible peers
    let peers = consistent_hash(key);

    // Try closest ring first
    for ring in [Ring::Core, Ring::Region, Ring::Edge, Ring::Global] {
        let ring_peers: Vec<_> = peers.iter()
            .filter(|p| p.ring() == ring)
            .collect();

        // Query all peers in this ring in parallel
        let results = try_join_all(
            ring_peers.iter().map(|p| query_peer(p, key))
        ).await;

        if let Some(data) = results.into_iter().find_map(|r| r.ok()) {
            return Ok(data);
        }
    }

    Err(Error::KeyNotFound)
}
```

Lookup latency is bounded by the ring distance. For keys in the same datacenter (Ring 0), lookup takes <1ms. For keys replicated globally (Ring 3), lookup takes 50-200ms depending on network conditions.

## Replication

```rust
fn replicate(data: &[u8], key: &Key, config: &ReplicationConfig) {
    let peers = select_peers_for_key(key);

    // Replicate to N peers in the same ring
    for ring in [Ring::Core, Ring::Region, Ring::Edge] {
        let count = config.replication_factor(ring);
        let targets = peers.iter()
            .filter(|p| p.ring() == ring)
            .take(count);

        for target in targets {
            spawn(replicate_to_peer(target, key, data));
        }
    }
}
```

Typical replication factors: Ring 0 = 3 (three nodes in the same DC), Ring 1 = 2 (two nodes in the region), Ring 2 = 1 (one node on each continent). Ring 3 and beyond don't store data — they route to closer rings.

## Membership

Rings uses SWIM-style gossip for membership:

```rust
struct Membership {
    node_id: NodeId,
    ring: Ring,
    incarnation: u64,  // Monotonic counter
    status: Status,     // Alive, Suspect, Dead
}

fn gossip_round(known: &HashMap<NodeId, Membership>, rng: &mut Rng) {
    // Pick a random peer
    let target = known.iter().choose(rng).unwrap();
    // Exchange membership tables
    let updates = merge(known, target.membership_table());
    // Apply updates with suspicion timeout
    for update in updates {
        if update.incarnation > known[&update.node_id].incarnation {
            known.insert(update.node_id, update);
        }
    }
}
```

Suspicion is managed through a timeout — if a node hasn't been heard from for 15 seconds, it's marked Suspect. After 60 seconds, Dead. Dead nodes are removed from the routing table. Re-replication triggers when nodes leave their ring, redistributing their data to the remaining peers.

## Fault Tolerance

Rings tolerates up to N-1 node failures in a replication group (with RF=N) without data loss. For writes, quorum is: Ring 0 requires 2/3 acknowledgments for "write confirmed." Ring 1 requires 1/2. Ring 2 requires 0/1 (best-effort). This means data written to Ring 0 is durable even if one node in the three-node group fails. Data replicated to Ring 2 (single node per continent) is lost if that node fails, until the next replication cycle.

Rings is experimental — we run it on 10 nodes in our lab with near-100% uptime over 30 days of testing. The consistent hashing ensures minimal data redistribution when nodes join or leave (about 5% of keys move per node change). We're testing on a Kubernetes cluster with 50 pods across 3 regions — Rings handles pod restarts gracefully because gossip membership converges in under 30 seconds regardless of cluster size.