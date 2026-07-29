# Jigsaw Content Addressing

Jigsaw identifies evidence by its content hash, not by its location. This is the same principle as IPFS and Git — content-addressed data is immutable, verifiable, and location-independent.

## Content Hash

Every evidence bundle has a content hash computed from its serialized CBOR form:

```rust
fn content_hash(evidence: &Evidence) -> Hash {
    let mut hasher = Blake3::new();
    // Include the full CBOR encoding
    hasher.update(&evidence.canonical_cbor());
    // Include the previous evidence hash
    if let Some(prev) = evidence.prev_hash {
        hasher.update(&prev);
    }
    hasher.finalize()
}
```

The content hash is a Blake3 256-bit digest. We chose Blake3 over SHA-256 because it's 3-4x faster on large inputs (useful for bulk verification) and supports keyed hashing (for future HMAC-based authentication).

The hash is used as the evidence identifier. To fetch evidence, you ask the mesh "give me evidence with hash abc123." The mesh returns the evidence from whichever peer has it — the response is verified by re-computing the hash and checking it matches.

## Content-Addressed Links

Evidence chains are linked by content hash, not by pointers or indices:

```rust
struct EvidenceChain {
    // Vector of content hashes forming the chain
    hashes: Vec<Hash>,
}

impl EvidenceChain {
    fn verify(&self, store: &EvidenceStore) -> Result<()> {
        let mut prev_hash = None;

        for hash in &self.hashes {
            let evidence = store.get(hash)
                .ok_or(VerificationError::MissingEvidence)?;

            // Self-verification: is the content hash correct?
            let computed = content_hash(&evidence);
            if computed != *hash {
                return Err(VerificationError::HashMismatch);
            }

            // Chain verification: does the prev_hash link match?
            if evidence.prev_hash != prev_hash {
                return Err(VerificationError::BrokenChain);
            }

            prev_hash = Some(*hash);
        }

        Ok(())
    }
}
```

## Deduplication

Content addressing provides natural deduplication. Two peers that independently witness the same event produce the same evidence bundle (same content hash). The mesh only stores one copy:

```rust
fn store_evidence(store: &EvidenceStore, evidence: &Evidence) -> bool {
    let hash = content_hash(evidence);
    if store.has(&hash) {
        // Already stored — increment reference count
        store.increment_ref_count(&hash);
        false // "not new"
    } else {
        store.put(&hash, evidence);
        true // "new evidence"
    }
}
```

The reference count tracks how many times the same evidence was witnessed. When the ref count drops to zero (all witnesses retract their attestations), the evidence can be garbage collected.

## Permanent vs Ephemeral

Evidence can be tagged as permanent or ephemeral:

```rust
enum EvidencePersistence {
    Permanent,  // Never GC'd — root of trust
    Ephemeral { ttl_seconds: u64 },  // Auto-expire
    ReferenceCounted,  // GC when refs reach zero
}
```

Permanent evidence anchors the trust system — root certificates, organization identities. Ephemeral evidence has a time-to-live (session tokens, one-time authorization). Reference-counted evidence persists as long as someone references it.

The mesh enforces a minimum TTL of 60 seconds and maximum of 30 days for ephemeral evidence. Permanent evidence requires a multi-signature endorsement (3-of-5 configured trust anchors). This prevents accidental permanent storage of ephemeral data.

## Content Routing

Given a content hash, how does a peer find the evidence?

```rust
async fn find_content(hash: &Hash, mesh: &Mesh) -> Result<Evidence> {
    // 1. Check local store (fast path)
    if let Some(evidence) = store.get(hash) {
        return Ok(evidence);
    }

    // 2. Ask neighbors (DHT lookup, ~50ms)
    let providers = mesh.dht_lookup(hash).await?;

    // 3. Fetch from nearest provider
    let nearest = providers.iter()
        .min_by_key(|p| mesh.latency_to(p));
    let data = mesh.fetch_from(nearest, hash).await?;

    // 4. Verify and cache
    let evidence: Evidence = cbor_decode(&data)?;
    let computed = content_hash(&evidence);
    if computed != *hash {
        return Err(VerificationError::HashMismatch);
    }
    store.put(hash, &evidence);  // Cache locally

    Ok(evidence)
}
```

Content addressing means you always get the exact evidence you requested — the hash is both the identifier and the integrity check. There's no trust in the provider, only verification of the content.