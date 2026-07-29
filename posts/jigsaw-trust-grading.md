# Jigsaw Trust Grading

Jigsaw doesn't give binary trust decisions (trusted/untrusted). It assigns a trust grade — a struct with multiple dimensions that captures both the confidence and the reasoning.

## Trust Grade

```rust
struct TrustGrade {
    score: f64,              // 0.0 to 1.0
    confidence: f64,         // 0.0 to 1.0 — how sure are we?
    chain_depth: usize,      // How many evidence hops?
    sources: Vec<SourceInfo>, // Who provided evidence?
    expiration: u64,         // When does this grade expire?
    reasoning: Vec<String>,  // Human-readable explanation
}
```

The `score` is the accumulated trust from the evidence chain. The `confidence` is derived from the number of independent evidence sources and their agreement. Two independent sources giving score 0.8 produces confidence 0.9. One source giving score 0.8 produces confidence 0.6.

## Grade Levels

```rust
fn grade_to_label(grade: &TrustGrade) -> &str {
    match grade {
        g if g.score >= 0.9 && g.confidence >= 0.8 => "VERIFIED",
        g if g.score >= 0.7 && g.confidence >= 0.6 => "LIKELY_TRUSTED",
        g if g.score >= 0.5 => "PROVISIONAL",
        g if g.score >= 0.3 => "LOW_CONFIDENCE",
        _ => "UNVERIFIED",
    }
}
```

**VERIFIED**: Direct evidence from a trusted source with multiple independent endorsements. Use for sensitive operations — financial transactions, access control, identity verification.

**LIKELY_TRUSTED**: Strong evidence chain (2-3 hops) from trusted sources. Use for moderate-risk operations — service-to-service communication, data sharing.

**PROVISIONAL**: Some evidence exists but not enough confidence. Use for low-risk operations — read-only access, anonymous analytics.

**LOW_CONFIDENCE**: Weak or conflicting evidence. Use for non-sensitive operations — public data access, rate-limited queries.

**UNVERIFIED**: No evidence found or evidence chain broken. No operations permitted beyond public endpoints.

## Grading in Action

```rust
let verifier = JigsawVerifier::new(config);

// Grade a peer
let grade = verifier.grade(&peer_pk).await?;

match grade {
    g if g.score > 0.8 && g.confidence > 0.7 => {
        // Allow write access
        grant_access(peer_pk, AccessLevel::Write);
    }
    g if g.score > 0.5 => {
        // Allow read-only
        grant_access(peer_pk, AccessLevel::Read);
    }
    _ => {
        // Deny access
        return Err(AcccessError::InsufficientTrust);
    }
}

log::info!(
    "Peer {} graded: score={:.2}, confidence={:.2}, sources={}",
    peer_pk, grade.score, grade.confidence, grade.sources.len()
);
```

## Evidence Decay

Evidence has a half-life. A signature from 30 days ago counts half as much as a fresh one. From 60 days, one quarter:

```rust
fn decay_weight(timestamp: u64, now: u64) -> f64 {
    let age_days = (now - timestamp) as f64 / 86400.0;
    0.5_f64.powf(age_days / 30.0)  // 30-day half-life
}
```

The decay function means old evidence is not discarded (you don't need to re-attest every month) but it gradually becomes less influential. An evidence chain entirely from stale sources (>90 days) produces grade 0.12 at best — effectively unverifiable. Entities must refresh their evidence periodically.

## Multiple Sources

When multiple sources provide evidence for the same entity, Jigsaw combines them using a weighted average weighted by source trust:

```rust
fn combine_sources(grades: &[(TrustGrade, f64)]) -> TrustGrade {
    let total_weight: f64 = grades.iter().map(|(g, w)| g.score * w).sum();
    let total_confidence: f64 = grades.iter().map(|(g, w)| g.confidence * w).sum();
    let total_w: f64 = grades.iter().map(|(_, w)| w).sum();

    TrustGrade {
        score: total_weight / total_w,
        confidence: total_confidence / total_w,
        chain_depth: grades.iter().map(|(g, _)| g.chain_depth).max().unwrap_or(0),
        sources: grades.iter().flat_map(|(g, _)| g.sources.clone()).collect(),
        expiration: grades.iter().map(|(g, _)| g.expiration).min().unwrap_or(0),
        reasoning: vec!["Combined from multiple sources".to_string()],
    }
}
```

The `source_weight` for each source is its own trust grade's score. This means a high-trust source's evidence counts more than a low-trust source's — trust is recursive. The system bootstraps with root-of-trust anchors that have hardcoded weight 1.0. From there, trust propagates.