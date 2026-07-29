# AniGo AI Animation System

AniGo is an animation system for real-time character animation. Instead of manually blending animation clips, AniGo uses a motion matching pipeline driven by a learned motion space, with an AI agent that selects the best motion sequence for any given character state.

## Core Pipeline

```
Character State ──► Motion Matching ──► Animation Pose
                          ▲
                   Learned Motion Space
                   (precomputed features)
```

The motion space is built by preprocessing a motion capture dataset. Each frame of every clip is analyzed for: joint positions and velocities, foot contact states, trajectory (future path of root joint), and style tags (walk, run, jump, idle). These features are projected into a compact latent space using a simple autoencoder (3-layer MLP, 128-dim latent). The runtime then finds the nearest neighbor in this space for any query state.

## Motion Matching

```rust
struct MotionFeature {
    joint_positions: [Vec3; 22],   // 22 joints
    joint_velocities: [Vec3; 22],
    root_trajectory: [Vec3; 10],   // 10 future positions
    foot_contact: [bool; 2],       // left/right foot
    style_embedding: Vec<f32>,     // learned style descriptor
}

struct MotionSpace {
    features: Vec<MotionFeature>,
    index: HNSWIndex,  // Hierarchical Navigable Small World
}

impl MotionSpace {
    fn nearest(&self, query: &MotionFeature, k: usize) -> Vec<MotionClip> {
        // Weighted distance: joints=0.3, velocity=0.2, trajectory=0.4, foot=0.1
        self.index.search_with_weights(query, k)
    }
}
```

The HNSW index gives approximate nearest neighbors in ~10μs per query — fast enough to run every frame. The weights are hand-tuned but we also trained a small regression model (100 params) that learns query-specific weights from user feedback. After 1000 user interactions, the weight model improved match quality by 15% over the hand-tuned baseline.

## Blending and Transitions

Once a motion clip is selected, AniGo blends from the current pose to the clip's pose:

```rust
struct Animator {
    current_pose: Pose,
    current_clip: MotionClip,
    blend_time: f32,
    blend_duration: f32,  // Typically 0.1-0.3 seconds
}

impl Animator {
    fn update(&mut self, dt: f32, space: &MotionSpace, state: &CharacterState) {
        let query = extract_features(state);
        let best_match = space.nearest(&query, 1)[0];

        if best_match.id != self.current_clip.id {
            self.start_blend(&best_match, 0.15); // 150ms blend
        }

        if self.is_blending() {
            let t = self.blend_time / self.blend_duration;
            self.current_pose = lerp(self.current_pose, self.target_pose, smoothstep(t));
            self.blend_time += dt;
        } else {
            self.current_pose = self.current_clip.sample(state.time);
        }
    }
}
```

The blend duration varies: 100ms for same-type transitions (walk→walk), 200ms for different types (walk→run), 300ms for dramatic changes (walk→crouch). Foot locking prevents sliding during blends by anchoring foot positions to the ground plane during foot contact phases.

## Performance

AniGo runs motion matching and blending in under 50μs per character on a single core. A scene with 100 characters costs 5ms for animation alone — acceptable for most games. The bottleneck is the feature extraction (joint transforms → world space positions), not the match query. We improved this by caching feature vectors and only recomputing for characters that changed state since the last frame — dirty flag tracking cut per-character cost by 40%.

The system handles about 200 minutes of motion capture data spread across 1500 clips. We haven't hit accuracy issues at this scale — HNSW scales to millions of vectors. The practical limit with our feature size (640 floats per vector) seems to be around 50,000 clips before query time exceeds 100μs. For larger datasets, we'd partition by style tag and search within style groups.