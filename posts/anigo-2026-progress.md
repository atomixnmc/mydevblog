# AniGo 2026 Progress

AniGo has been in development for about 18 months. It's functional for demos but not yet production-ready for game studios. Here's where things stand.

## Motion Matching

The motion matching pipeline (200 minutes of motion capture, 1500 clips) is solid. The HNSW index returns nearest neighbors in ~10μs. Blending is smooth with foot locking and terrain adaptation. The main bottleneck is feature extraction — converting joint transforms to world space for each character costs about 5μs per character.

**Accuracy**: 85% of motion matching queries return a visually acceptable match. 10% return a slightly mismatched clip (wrong foot timing, strange arm position) that's still usable with blending. 5% return a clearly wrong match (different locomotion type, body intersection) that causes visible artifacts. These are the cases we're focused on — adding more clips, adjusting feature weights, and improving the terrain adaptation.

## AI Director

The 1.5B parameter director model handles 80% of character behavior correctly. The 20% failure rate is acceptable for demos but not for production. We're exploring few-shot prompting (giving the model 2-3 examples of correct behavior for novel situations) and rule-based fallback (if the director produces incorrect directives, fall back to a hand-crafted tree).

## Timeline System

The timeline system replaced the state machine approach. It's simpler to use (push events, set durations, done) and more flexible (any number of concurrent events, dynamic weight adjustment). The main limitation is non-destructive editing — once an event is on the timeline, you can't modify its clip without removing and re-adding it. We're working on an "event patch" API that allows modifying clip parameters without timeline disruption.

## Performance

| Component | Per-character time | 100 characters | 500 characters (4 threads) |
|---|---|---|---|
| Feature extraction | 5μs | 0.5ms | 0.2ms |
| Motion matching | 10μs | 1.0ms | 0.3ms |
| Blending + IK | 15μs | 1.5ms | 0.5ms |
| Scene graph + skinning | 10μs | 1.0ms | 0.3ms |
| AI Director | 20μs (10Hz) | 0.4ms | 0.1ms |
| **Total** | **60μs average** | **4.4ms** | **1.4ms** |

At 100 characters, animation takes 4.4ms (27% of a 16.6ms frame). At 500 characters with 4 threads, it takes 1.4ms (8%). The system scales well because characters are independent — no shared state locking.

## Missing Pieces

- **Blend spaces**: No parametric blending between motion categories (e.g., walk speed from 0 to 6 m/s). Currently, speed changes require a transition between discrete walk clips.
- **Inverse kinematics (full body)**: We have foot IK but no full-body IK for reaching, climbing, or object interaction. The joint hierarchy solver isn't written yet.
- **Physics integration**: Characters clip through world geometry. We need a collision-aware motion matching that rejects clips causing penetration. The validation layer in the AI Director partially addresses this but doesn't replace proper collision response.
- **Animation compression**: Motion clips are stored as full-precision joint transforms. With 200 minutes of animation, memory usage is about 500MB. We need quantization (16-bit half-floats) and keyframe decimation.

## Timeline

Physics integration (collision-aware motion matching) is Q3 2026. Blend spaces and full-body IK are Q4 2026. Production release (v1.0) is Q1 2027. The project is open-source — contributions are welcome via the AniGo GitHub repository.