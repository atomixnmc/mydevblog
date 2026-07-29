# Jigsaw Rust Crates Evolution

The 7 Jigsaw crates have evolved significantly since their initial design. Here's how they changed, what we learned, and where they're going.

## Crate Changes

**jigsaw-core** had the most API churn. The initial design used a single `Evidence` type with optional fields. We split it into typed variants (IdentityClaim, DelegationClaim, AssertionClaim) joined by an enum. This made the type system enforce correctness — you can't create an identity claim without a subject field:

```rust
// Old: all fields optional
struct Evidence {
    claim_type: String,
    subject: Option<PublicKey>,
    delegator: Option<PublicKey>,
    // ...
}

// New: typed variants
enum Claim {
    Identity(IdentityClaim),
    Delegation(DelegationClaim),
    Assertion(AssertionClaim),
}

struct IdentityClaim {
    subject: PublicKey,  // Required
    attributes: Vec<Attribute>,
}
```

**jigsaw-cbor** added support for streaming CBOR decoding after an IoT user couldn't fit a full evidence chain in 256KB RAM. The streaming API processes one evidence at a time from a reader, keeping the memory footprint to 2KB.

**jigsaw-store** replaced its initial SQLite backend with RocksDB. SQLite worked for prototypes but couldn't handle the write throughput (10K evidence/sec). RocksDB handles this easily — the bottleneck moved to CBOR decoding (single-threaded). We're now parallelizing CBOR decoding across evidence bundles.

## Performance Lessons

| Operation | v0.1 (SQLite) | v0.5 (RocksDB) | v0.8 (RocksDB+opt) |
|---|---|---|---|
| Write 1 evidence | 450μs | 35μs | 12μs |
| Verify chain (5 hops) | 2.1ms | 180μs | 95μs |
| Query by claimant | 5ms | 200μs | 50μs (with index) |
| Bulk verify (1000 chains) | 450ms | 45ms | 18ms |

The bulk verify optimization was significant — we added parallel verification across independent chains. The verifier spawns one task per chain and collects results. With 16 cores, 1000 chains verify in 18ms vs 45ms sequential. The 12μs write latency includes the RocksDB write, WAL flush, and CBOR encoding — about 8μs of that is CBOR encoding.

## Network Protocol

**jigsaw-net** initially used raw TCP with a custom message format. We replaced it with libp2p (QUIC transport) for NAT traversal and encryption. The QUIC migration cut connection setup time from 3ms (TCP + TLS) to 1ms (QUIC 0-RTT). The libp2p integration also gave us peer discovery via mDNS and DHT, replacing our manual bootstrap list.

## Current Status

Jigsaw is in beta (v0.8.0). The core verification algorithm is stable — the evidence chain format won't change before v1.0. The network protocol is still evolving as we test with more peers. The CLI and TUI are usable but missing some features (bulk export, chain visualization filter).

The project has about 15,000 lines of Rust across all 7 crates. The test suite has 1,200 tests covering: unit tests for each crate, integration tests for the full pipeline (network → store → verify → grade), and property-based tests for CBOR encoding/decoding roundtrips. The property-based tests fuzz the CBOR decoder with malformed evidence — we found and fixed 3 panic-causing bugs in the decoder during development.