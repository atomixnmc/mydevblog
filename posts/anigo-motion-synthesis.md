# AniGo Motion Synthesis

Motion synthesis generates new animation sequences from existing motion data instead of simply playing back clips. AniGo's synthesis pipeline takes high-level goals (walk from point A to point B, jump over obstacle at C) and produces continuous, natural-looking motion.

## Motion Graph

At the core is a motion graph — a directed graph where nodes are motion frames and edges are transitions:

```rust
struct MotionGraph {
    nodes: Vec<MotionFrame>,     // Each frame is a pose
    edges: Vec<Transition>,      // Transitions between frames
}

struct Transition {
    from: usize,
    to: usize,
    cost: f32,      // Lower = smoother transition
    blend_ratio: f32, // 0.0 = snap, 1.0 = full blend
}
```

The graph is built by finding similar frames across different clips. If frame 100 of "walk_a" is similar to frame 30 of "walk_b" (joint positions differ by <15°), they get a bidirectional edge. The similarity threshold determines graph connectivity — too strict (5°) and there are few transitions, too loose (30°) and transitions look wrong. We settled on 15° for upper body, 10° for feet.

## Path Planning on the Graph

Given a goal (reach position P with style S), the planner finds the optimal path through the motion graph:

```rust
fn find_path(
    graph: &MotionGraph,
    start_pose: &Pose,
    goal: &Goal,
) -> Vec<Transition> {
    let start = graph.find_nearest(start_pose);
    let end = graph.find_terminal_matching(goal);

    // A* search with custom heuristic
    let path = astar(
        &graph,
        start,
        end,
        |node| heuristic(node, goal),  // Estimated cost to goal
        |transition| transition.cost,   // Actual transition cost
    );

    // Smooth the path with overlapping blends
    smooth_path(graph, path, overlap: 0.1)
}
```

The heuristic estimates trajectory similarity — how well does this frame's root trajectory and foot positions match the goal? This is why motion features include future root trajectory: the heuristic looks ahead 0.5 seconds to estimate how well the animation will track toward the goal. The smooth_path pass applies overlapping blends at each transition point to eliminate popping.

## Runtime Synthesis

```rust
struct MotionSynthesizer {
    graph: MotionGraph,
    current_path: Vec<usize>,  // Node indices
    path_position: usize,       // Where we are on the path
    blend_state: BlendState,
}

impl MotionSynthesizer {
    fn update(&mut self, dt: f32, controller: &ControllerInput) -> Pose {
        // Check if we need to replan (goal changed, obstacle appeared)
        if controller.goal_changed() {
            let new_path = self.plan_path(controller.goal());
            self.current_path = new_path;
            self.path_position = 0;
        }

        // Advance along path
        self.path_position += 1;
        if self.path_position >= self.current_path.len() {
            self.path_position = self.current_path.len() - 1;
        }

        // Sample and blend
        let node_idx = self.current_path[self.path_position];
        let base_pose = self.graph.nodes[node_idx].pose;
        let adjusted_pose = self.apply_ik_foot_locking(base_pose);
        self.blend_with_previous(adjusted_pose, dt)
    }
}
```

## Inverse Kinematics Post-Processing

Motion graph output is adjusted with IK to match the terrain:

```rust
fn apply_ground_adaptation(pose: &mut Pose, terrain: &HeightMap) {
    for foot in [Foot::Left, Foot::Right] {
        if pose.foot_contact(foot) {
            let foot_pos = pose.joint_world(foot.joint());
            let target_height = terrain.height_at(foot_pos.x, foot_pos.z);
            let delta = target_height - foot_pos.y;

            // Distribute correction up the leg chain
            let hip = pose.joint_mut(Joint::Hip(foot.side()));
            let knee = pose.joint_mut(Joint::Knee(foot.side()));

            // 70% correction at ankle, 25% at knee, 5% at hip
            rotate_around(hip, knee, delta * 0.05);
            rotate_around(knee, foot_pos, delta * 0.25);
            foot_pos.y += delta * 0.70;
        }
    }
}
```

This foot-locking and terrain adaptation happens every frame and adds about 5μs per character. Without it, synthesized motion looks good on flat ground but suffers from foot sliding and ground penetration on uneven terrain. The IK chain from hip to ankle distributes the correction to maintain natural joint angles — putting all correction at the ankle creates unnatural ankle bending on slopes.

## Performance

Motion synthesis runs at 60 FPS for up to 50 characters on a single core. Path planning (A* over the motion graph) takes 1-3ms per replan — not every frame, only when goals change. The bottleneck is IK post-processing on many characters. We batch IK computations using SIMD (SSE on x86, NEON on ARM) and process 4 characters simultaneously. This reduced IK overhead by 3x for scenes with 50+ characters.