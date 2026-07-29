# AniGo Timeline System

AniGo's timeline system manages animation state as a sequence of timed events. Instead of maintaining a state machine with explicit transitions, you push animation events onto a timeline and the system blends between them automatically.

## Timeline Model

A timeline is a double-ended queue of animated events:

```rust
struct Timeline {
    events: VecDeque<AnimatedEvent>,
    current_time: f32,
    speed: f32,
}

struct AnimatedEvent {
    start_time: f32,
    duration: f32,
    animation: AnimationClip,
    blend_in: f32,    // Crossfade duration
    blend_out: f32,
    weight: f32,      // 0.0 = invisible, 1.0 = full
    tags: Vec<String>, // For querying
}
```

Events are ordered by `start_time`. The timeline advances `current_time` each frame and selects the active events — those whose time range covers `current_time`. Multiple events can be active simultaneously (e.g., walking + waving), with their contributions blended by weight.

## Pushing Events

```rust
timeline.push(AnimatedEvent {
    start_time: timeline.current_time,  // Start now
    duration: 2.0,                      // For 2 seconds
    animation: load_clip("wave_hand"),
    blend_in: 0.15,                     // 150ms blend
    blend_out: 0.2,
    weight: 0.5,                        // Half weight
    tags: vec!["gesture".into()],
});
```

Events can be queued in advance:

```rust
// Plan a sequence
timeline.push_at(1.0, walk_clip);
timeline.push_at(4.0, jump_clip);
timeline.push_at(5.5, land_clip);
timeline.push_at(6.5, idle_clip);
```

The `push_at` method inserts events at their specified time, maintaining sorted order. The timeline handles the transition from walk to jump at t=4.0 by blending walk's blend_out with jump's blend_in.

## Blending

Active events are blended together each frame:

```rust
impl Timeline {
    fn sample(&self, skeleton: &Skeleton) -> Pose {
        let active_events: Vec<_> = self.events.iter()
            .filter(|e| {
                e.start_time <= self.current_time
                    && self.current_time <= e.start_time + e.duration
            })
            .collect();

        if active_events.is_empty() {
            return Pose::bind_pose(skeleton);
        }

        let mut blended = Pose::zero(skeleton);
        let mut total_weight = 0.0;

        for event in &active_events {
            let local_t = self.current_time - event.start_time;
            let pose = event.animation.sample(local_t);

            // Apply blend in/out envelopes
            let envelope = compute_envelope(local_t, event.duration,
                                            event.blend_in, event.blend_out);
            let effective_weight = event.weight * envelope;

            blended = blend_add(blended, pose * effective_weight);
            total_weight += effective_weight;
        }

        // Normalize
        if total_weight > 0.0 {
            blended = blend_scale(blended, 1.0 / total_weight);
        }

        blended
    }
}
```

The `compute_envelope` function returns 0.0 at the event boundaries and smoothly ramps to 1.0:

```text
blend_in=0.15s           blend_out=0.2s
  0───╱╲──────────╱╲───1
     ╱  ╲        ╱  ╲
    ╱    ╲      ╱    ╲
   ╱      ╲    ╱      ╲
0 ╱        ╲  ╱        ╲ 0
  ──╮────────┬────────╭──
  0.0       t      t+2.0
```

## Timeline Queries

Events can be queried and removed by tag:

```rust
// Cancel all gesture events
timeline.cancel("gesture");
// Clear future events (keep current)
timeline.clear_future();
```

Cancellation triggers a blend-out for the cancelled events — they fade out over their `blend_out` duration instead of cutting instantly. This prevents popping. The `clear_future()` method drops all events with `start_time > current_time` — useful for interrupting a planned sequence with a high-priority action.

The timeline system replaces about 500 lines of manual blend-tree state machine code in our demo. It's less explicit than a hand-rolled blend tree (you can't see the exact transitions at a glance), but it's far more flexible — adding a new animation sequence is a push to the timeline, not a new state machine node.