# Rings DHT Rust Implementation

The Rings DHT is HyperGraph's distributed hash table, written in Rust. It organizes peers into concentric rings based on latency and provides efficient lookup, replication, and fault tolerance for graph data.

## Core Components

The implementation is about 8,000 lines of Rust across three modules:

### 1. `rings-core`

The DHT protocol: consistent hashing, peer identification, lookup logic. Uses Kademlia-style XOR distance but with ring-aware routing:

```rust
struct NodeId([u8; 32]);  // Blake3 hash of public key

impl NodeId {
    fn distance(&self, other: &NodeId) -> Distance {
        Distance(self.0.iter()
            .zip(other.0.iter())
            .map(|(a, b)| a ^ b)
            .collect::<Vec<_>>())
    }

    fn ring(&self, config: &RingConfig) -> Ring {
        let latency = config.estimate_latency(self);
        if latency < Duration::from_micros(1000) {
            Ring::Core
        } else if latency < Duration::from_millis(10) {
            Ring::Region
        } else if latency < Duration::from_millis(50) {
            Ring::Edge
        } else {
            Ring::Global
        }
    }
}
```

The ring assignment is based on measured latency between peers. Each peer periodically pings its neighbors to update latency estimates. If a peer's latency drops below a threshold, it moves to a closer ring. If it increases, it moves outward.

### 2. `rings-storage`

Persistent storage for DHT data using RocksDB:

```rust
pub struct RingsStorage {
    db: rocksdb::DB,
    // Column families
    data: rocksdb::ColumnFamily,      // Key → Value
    metadata: rocksdb::ColumnFamily,  // Key → Metadata (TTL, version)
    routing: rocksdb::ColumnFamily,   // PeerId → RoutingInfo
}

impl RingsStorage {
    pub fn put(&self, key: &[u8], value: &[u8], ttl: Duration) -> Result<()> {
        self.db.put_cf(&self.data, key, value)?;
        let meta = Metadata { created_at: now(), ttl };
        self.db.put_cf(&self.metadata, key, &bincode::serialize(&meta)?)?;
        Ok(())
    }

    pub fn get(&self, key: &[u8]) -> Result<Option<(Vec<u8>, Metadata)>> {
        let value = self.db.get_cf(&self.data, key)?;
        let meta = self.db.get_cf(&self.metadata, key)?
            .map(|bytes| bincode::deserialize(&bytes))
            .transpose()?;
        Ok(value.map(|v| (v, meta.unwrap())))
    }
}
```

### 3. `rings-net`

Networking layer using QUIC (via `quinn`):

```rust
pub struct RingsNetwork {
    endpoint: quinn::Endpoint,
    peers: HashMap<NodeId, quinn::Connection>,
}

impl RingsNetwork {
    pub async fn lookup(&self, key: &[u8]) -> Result<Vec<u8>> {
        // Find nearest peers for the key
        let peers = self.routing_table.lookup(key);

        // Query peers in parallel (ring order: Core first)
        let results = futures::future::join_all(
            peers.iter().map(|p| self.query_peer(p, key))
        ).await;

        results.into_iter()
            .find_map(|r| r.ok())
            .ok_or(Error::KeyNotFound)
    }

    async fn query_peer(&self, peer: &NodeId, key: &[u8]) -> Result<Vec<u8>> {
        let conn = self.connect(peer).await?;
        let (mut send, mut recv) = conn.open_bi().await?;
        send.write_all(&LookupRequest { key }.encode()).await?;
        let response = recv.read_to_end(64 * 1024).await?;
        Ok(LookupResult::decode(&response)?.value)
    }
}
```

## Testing

The DHT is tested with a simulation framework that creates virtual nodes and networks:

```rust
#[tokio::test]
async fn test_ring_replication() {
    let mut sim = Simulation::new();
    // Create 10 nodes in Core ring, 10 in Region
    for _ in 0..10 {
        sim.add_node(NetworkConfig::core());
    }
    for _ in 0..10 {
        sim.add_node(NetworkConfig::region());
    }

    // Store data
    let key = b"test-key";
    sim.store(key, b"test-value").await.unwrap();

    // Kill 3 Core nodes (out of 10)
    for _ in 0..3 {
        sim.kill_random_node(Ring::Core).await;
    }

    // Data should still be retrievable
    let value = sim.lookup(key).await.unwrap();
    assert_eq!(value, b"test-value");
}
```

## Current Performance

| Operation | Latency (p50) | Latency (p99) | Throughput |
|---|---|---|---|
| Local lookup (same DC) | 0.5ms | 2ms | 100K/s |
| Regional lookup (same continent) | 8ms | 25ms | 10K/s |
| Global lookup | 80ms | 200ms | 1K/s |
| Store (with replication) | 2ms | 8ms | 50K/s |

The implementation runs on Kubernetes with 50 pods across 3 regions. Membership convergence after a pod restart takes about 15 seconds (3 gossip cycles × 5 seconds each). The current bottleneck is the QUIC connection establishment — opening a new connection to a previously unknown peer takes 1 RTT (1-50ms depending on distance). Connection reuse amortizes this over the session lifetime.