# Jigsaw Trust Verification

Jigsaw is a decentralized trust verification system built on content-addressed evidence chains. Instead of centralized certificate authorities (CAs) or web-of-trust signatures, Jigsaw uses cryptographically-linked evidence bundles to establish trust between entities.

## The Trust Problem

Traditional TLS trusts CAs — if a CA is compromised, all certificates signed by it are suspect. Web-of-trust (PGP) requires manual key signing. Jigsaw's approach: trust is established through verifiable claims, where each claim is backed by evidence that can be independently audited.

## Evidence Chains

An evidence chain is a linked list of signed evidence bundles:

```
┌────────────┐     ┌────────────┐     ┌────────────┐
│ Evidence 1 │────►│ Evidence 2 │────►│ Evidence 3 │
│            │     │            │     │            │
│ hash: abc  │     │ hash: def  │     │ hash: ghi  │
│ prev: null │     │ prev: abc  │     │ prev: def  │
│ claim: ... │     │ claim: ... │     │ claim: ... │
│ sig: alice │     │ sig: bob   │     │ sig: carol │
└────────────┘     └────────────┘     └────────────┘
```

Each evidence bundle records a claim, the identity of the claimant, a signature, and a reference to the previous evidence:

```rust
struct Evidence {
    version: u8,
    prev_hash: Hash,              // Link to previous evidence
    timestamp: u64,                // Unix timestamp
    claim: Claim,                  // The trust claim
    claimant: PublicKey,           // Who made this claim
    signatures: Vec<Signature>,    // Endorsements
    content_hash: Hash,            // Hash of (prev + claim + claimant)
}
```

## Verification Algorithm

```rust
fn verify_chain(chain: &[Evidence], root_trust: &PublicKey) -> Result<TrustGrade> {
    let mut trust_score = 0.0;
    let mut current_trust = root_trust;

    for evidence in chain {
        // Verify signature
        if !verify_signature(&evidence.claimant, &evidence, &evidence.signatures) {
            return Err(VerificationError::BadSignature);
        }

        // Verify hash chain
        let expected_hash = hash_evidence(
            evidence.prev_hash,
            &evidence.claim,
            &evidence.claimant
        );
        if evidence.content_hash != expected_hash {
            return Err(VerificationError::HashMismatch);
        }

        // Accumulate trust
        trust_score += evidence.trust_weight();
        current_trust = &evidence.claimant;
    }

    Ok(TrustGrade::from_score(trust_score))
}
```

Trust decays along the chain. The first link (signed by a known-trusted entity) counts 1.0. Each subsequent link counts 0.7 × previous. After 5 hops, trust is 0.7^5 = 0.168 — weak, but not zero. This exponential decay models the intuition that trust degrades with distance.

## Verification Modes

Jigsaw supports three verification modes:

**Strict mode**: Requires a direct, signed claim from a trusted entity. No chain walking. Use case: high-security operations (financial transactions, access to sensitive data).

**Chain mode**: Walks the evidence chain up to 4 hops, accumulating trust. Use case: service discovery in a mesh, introductions between pods.

**Gossip mode**: Collects evidence from multiple sources and computes a weighted average. Each source is weighted by its own trust score. Use case: reputation systems, community moderation.

```rust
fn verify_gossip(
    target: &PublicKey,
    network: &Network,
    min_trust: f64,
) -> Result<bool> {
    // Collect evidence from all reachable peers
    let evidence = network.broadcast_lookup(target);
    let weighted = evidence.iter()
        .map(|e| (e.trust_weight() * e.source_trust(), e.claim))
        .sum::<f64>() / evidence.len() as f64;

    Ok(weighted >= min_trust)
}
```

## Proof of Work for Trust

Jigsaw optionally supports proof-of-work for establishing initial trust. An unknown entity can submit a PoW solution that verifies computational investment — this prevents Sybil attacks without requiring a prior trust relationship. The PoW difficulty is adjusted based on network consensus about recent Sybil activity. In practice, this means a new node waits about 5 minutes of computation (CPU, not GPU) before gaining minimal trust status.

The system is designed for federated deployment. Each organization runs a Jigsaw node that participates in the evidence mesh. Trust is transitive across organizations — if Org A trusts Bob, and Org B trusts Org A, then Org B can verify Bob's claims through the evidence chain, with appropriate trust decay. This is the same model as PGP's web of trust, but automated, cryptographically auditable, and integrated with runtime verification instead of manual key signing.