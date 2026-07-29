# Uploop Binary Stream

Uploop Stream is a binary streaming protocol for real-time multiplayer state synchronization. It's not JSON over WebSocket — it's a compact binary format with delta compression, interest management, and reliability stratification.

## Wire Format

Each stream packet has a compact header followed by payload:

```
┌──────────────────────────────┐
│  PacketHeader (8 bytes)      │
│  ┌────┬──────┬──────┬─────┐ │
│  │ID  │Flags │Seq   │Crc  │ │
│  │2B  │1B    │3B    │2B   │ │
│  └────┴──────┴──────┴─────┘ │
├──────────────────────────────┤
│  Payload (variable)          │
│  ┌──────┬──────┬──────────┐ │
│  │Type  │Size  │Data      │ │
│  │1B    │VarInt│Variable  │ │
│  └──────┴──────┴──────────┘ │
└──────────────────────────────┘
```

Variable-length integers use Protobuf-style varint encoding — small values (under 128) encode as a single byte. For a typical entity update (position + rotation = 24 bytes of data), the packet is about 35 bytes, vs 120+ bytes for JSON.

## Delta Compression

Instead of sending full state every tick, Stream sends deltas:

```rust
#[derive(Serialize, Deserialize)]
enum EntityUpdate {
    Full(EntityState),           // Full state (first update or after loss)
    Delta {
        changed_fields: Bitfield, // Which fields changed
        position: Option<Vec3>,
        rotation: Option<Vec4>,
        velocity: Option<Vec3>,
        health: Option<f32>,
    },
    Input {
        inputs: Vec<InputEvent>,  // Compressed input sequence
    },
}
```

The bitfield in `Delta` indicates which fields are present. If only position changed (most common), the packet contains: `Delta { changed_fields: [position], position: [x, y, z] }` — 1 byte for bitfield + 12 bytes for Vec3 = 13 bytes. Compare to sending full state: 32+ bytes.

The server sends deltas at 20 Hz and full states at 1 Hz (for recovery). Clients missing a delta request a full state resend via an ACK/NACK mechanism — the NACK includes the last received sequence number, and the server resends from that point.

## Interest Management

Not every entity is relevant to every client. Stream uses spatial interest management:

```rust
struct InterestManager {
    view_distance: f32,
    priority_buckets: HashMap<EntityId, Priority>,
}

impl InterestManager {
    fn relevant_entities(&self, client_pos: Vec3) -> Vec<EntityId> {
        // Bucket entities by distance
        // Priority 0 (same area, <50m): send all updates
        // Priority 1 (near, 50-100m): send position + type only
        // Priority 2 (far, 100-200m): send type + direction only
        // Priority >200m: no updates
        self.entities.iter()
            .filter(|(_, e)| self.distance(client_pos, e.position) < 200.0)
            .sorted_by_key(|(_, e)| self.distance(client_pos, e.position))
            .take(200)  // Max 200 entities per client
            .collect()
    }
}
```

The priority system reduces bandwidth: a close entity (20m) gets full state at 20 Hz. A far entity (150m) gets type + direction at 2 Hz. With 200 entities, this reduces per-client bandwidth from ~8Mbps (sending all at full rate) to ~200Kbps.

## Reliability Stratification

Different data types have different reliability needs:

```rust
enum Reliability {
    Reliable,    // ACK + retransmit — player join, chat, item pickup
    Unreliable,  // No ACK — position updates, velocity
    PartiallyReliable { max_retransmits: u8 }, // Voice, damage numbers
}
```

Entity positions are unreliable (latest value supersedes old ones — no point resending a stale position). Game events are reliable (you must receive the item pickup). The protocol embeds the reliability type in the packet flags byte. Reliable packets are sequenced and retransmitted up to 5 times. After 5 retransmits without ACK, the connection is considered dead and the client is disconnected.

## Performance

We benchmarked Uploop Stream against raw WebSocket + JSON for a 50-player game with 1000 entities:

| Metric | JSON/WebSocket | Uploop Stream |
|---|---|---|
| Per-packet overhead | 120 bytes (avg) | 35 bytes (avg) |
| Bandwidth (server, per client) | 2.4 Mbps | 200 Kbps |
| Bandwidth (server, total 50 clients) | 120 Mbps | 10 Mbps |
| Packet processing (server) | 15μs/pkt | 3μs/pkt |
| CPU usage (server, 50 clients) | 60% core | 15% core |

Stream's bandwidth savings come from delta compression (sending only changed fields) and interest management (sending only relevant entities). The CPU savings come from binary parsing (no JSON allocation) and the compact encoding reducing memory bandwidth.

Stream is designed for WebSocket transport but can run over WebRTC data channels. WebRTC adds 3-5ms of jitter buffer latency but provides NAT traversal. We use WebSocket for LAN/cloud games and WebRTC for peer-to-peer connections — the Stream protocol layer is identical, only the transport adapter changes.