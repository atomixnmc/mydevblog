# Jigsaw 7 Crates

Jigsaw's Rust implementation is organized into 7 crates. Each crate has a clear responsibility, and the public API is intentionally small. Here's the breakdown of what each crate does and why it exists.

## 1. `jigsaw-core`

The core data types: evidence, claims, signatures, trust scores. No I/O, no networking, no serialization — just types and pure functions.

```rust
use jigsaw_core::{Evidence, Claim, TrustScore};

let evidence = Evidence::new(
    Claim::Identity { subject: alice_pk },
    alice_pk,
);
let score = TrustScore::from_chain(&[evidence.clone(), evidence2]);
assert!(score.value() > 0.0);
```

Zero dependencies beyond `ed25519-dalek` and `sha2`. This crate is the consensus layer — everything else builds on these types. The reason it's separate: embedded systems that only need to verify evidence (no network stack) can depend only on `jigsaw-core`.

## 2. `jigsaw-cbor`

CBOR serialization for Jigsaw evidence. Uses `ciborium` under the hood with canonical encoding. Adds Jigsaw-specific CBOR tags (custom tags 60001-60007 for claim types, evidence bundles, and trust anchors).

```rust
use jigsaw_cbor::{to_vec, from_slice};

let bytes = to_vec(&evidence)?;
let decoded: Evidence = from_slice(&bytes)?;
assert_eq!(evidence, decoded);
```

We keep serialization separate from core because there will eventually be alternative wire formats — FlatBuffers for zero-copy parsing on embedded targets, or WAL (write-ahead log) format for the storage layer.

## 3. `jigsaw-store`

Persistent storage for evidence chains backed by RocksDB:

```rust
use jigsaw_store::EvidenceStore;

let mut store = EvidenceStore::open("/tmp/jigsaw")?;
store.append(&evidence)?;
let chain = store.get_chain(&alice_pk)?;
```

Uses RocksDB's column families: one for evidence by claimant, one for evidence by subject, one for trust anchors (root-of-trust configurations). The store supports range queries (evidence within a time window) and streaming iteration over large chains.

## 4. `jigsaw-net`

Networking layer for the Jigsaw evidence mesh:

```rust
use jigsaw_net::{MeshNode, MeshConfig};

let node = MeshNode::new(MeshConfig {
    listen_addr: "0.0.0.0:7891".parse()?,
    bootstrap_peers: vec!["peer1:7891".parse()?],
});
node.start().await?;
let evidence = node.request_chain(&bob_pk).await?;
```

Implements Kademlia-style DHT for peer discovery and gossip protocol for evidence propagation. Uses libp2p under the hood. Messages are CBOR-encoded evidence bundles. The mesh is intended for local-area deployments (same datacenter, <5ms latency) — cross-datacenter evidence propagation adds too much latency for real-time verification.

## 5. `jigsaw-verify`

Verification engine that ties core types, CBOR parsing, storage, and networking together:

```rust
use jigsaw_verify::{Verifier, VerificationConfig};

let verifier = Verifier::new(store, node, VerificationConfig {
    max_chain_depth: 5,
    min_trust_score: 0.8,
    strict_mode: false,
});
let result = verifier.verify(&bob_pk).await?;
```

This is the crate that application developers use. It collects evidence from local storage (fast path) and the mesh (slow path) and runs the verification algorithm. The separation means you can test verification logic with `jigsaw-core` alone, then add networking and storage for production.

## 6. `jigsaw-tui`

Terminal UI for debugging and administration:

```rust
// Binary: jigsaw-tui
// Shows the evidence mesh as an interactive tree
// Highlight: trust chains, verification results, mesh topology
```

Not intended for production use — it's a developer tool for visualizing evidence chains during development and debugging trust failures.

## 7. `jigsaw-cli`

Command-line interface for production operations:

```bash
# Initialize a trust anchor
jigsaw init --key alice.key

# Sign a claim
jigsaw sign --key alice.key --claim '{"type":"identity","subject":"bob_pk"}'

# Verify a public key
jigsaw verify --target bob_pk --trust-anchor alice_pk

# Export evidence chain for offline verification
jigsaw export --target bob_pk --output bob_chain.cbor
```

The CLI is the main entry point for operators. It combines all 6 library crates into a cohesive tool. The 7-crate structure means each crate compiles independently — incremental compilation is fast because changing `jigsaw-net` doesn't recompile `jigsaw-core` or `jigsaw-cbor`.