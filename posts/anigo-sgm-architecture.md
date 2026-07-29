# AniGo SGM Architecture

The Scene-Graph-Manager (SGM) framework is AniGo's architectural backbone. It combines three subsystems — scene graph (spatial hierarchy), geometry (meshes + skeleton), and manager (animation + AI) — into a unified API for animated characters.

## Subsystem Breakdown

### Scene Graph

The scene graph manages spatial transforms as a tree:

```rust
struct SceneNode {
    local_transform: Transform,      // Relative to parent
    world_transform: Transform,      // Cached, updated only when dirty
    children: Vec<SceneNodeId>,
    parent: Option<SceneNodeId>,
    dirty: bool,
    entity_id: Option<EntityId>,     // Link to character entity
}

impl SceneNode {
    fn set_local_transform(&mut self, transform: Transform) {
        self.local_transform = transform;
        self.dirty = true;
        // Dirty propagation happens lazily — only when world_transform is queried
    }

    fn world_transform(&mut self) -> Transform {
        if self.dirty {
            self.world_transform = self.parent()
                .map(|p| p.world_transform() * self.local_transform)
                .unwrap_or(self.local_transform);
            self.dirty = false;
        }
        self.world_transform
    }
}
```

The scene graph uses lazy dirty propagation — marking a node dirty doesn't recalculate its subtree immediately. Only when a child's `world_transform()` is called does the recalculation propagate down. This means a frame that only renders visible characters (frustum culled) never calculates transforms for invisible ones.

### Geometry

```rust
struct Geometry {
    mesh: Mesh,                    // Vertices, indices, UVs, normals
    skeleton: Skeleton,            // Joint hierarchy
    skinning_matrices: Vec<Mat4>,  // Computed each frame from animation
    materials: Vec<Material>,      // Per-submesh materials
}

struct Skeleton {
    joints: Vec<Joint>,
    bind_pose: Vec<Mat4>,          // Inverse bind matrices
}

impl Skeleton {
    fn compute_skinning(&self, animation_pose: &Pose) -> Vec<Mat4> {
        self.joints.iter().map(|joint| {
            let animated = animation_pose.joint_matrix(joint.index);
            self.bind_pose[joint.index] * animated
        }).collect()
    }
}
```

### Manager

```rust
struct Manager {
    motion_state: MotionGraph,     // Current motion matching state
    timeline: Timeline,            // Event queue
    ai_director: Option<Director>, // Optional AI behavior system
    blend_state: BlendState,       // Crossfade transitions
}

impl Manager {
    fn update(&mut self, dt: f32, input: &ControllerInput) -> Pose {
        // AI director produces goal → motion matching finds clip
        let goal = self.ai_director
            .as_ref()
            .map(|d| d.plan(input))
            .unwrap_or_else(|| Goal::from_input(input));

        let clip = self.motion_state.query(&goal);
        self.timeline.push(clip);
        self.timeline.sample(dt)
    }
}
```

## Data Flow

```
         Frame Tick (16.6ms at 60 FPS)
                    │
     ┌──────────────▼──────────────┐
     │    Manager::update(dt)      │
     │      → AI Director          │
     │      → Motion Matching      │
     │      → Timeline Advance     │
     └──────────────┬──────────────┘
                    │ Pose
     ┌──────────────▼──────────────┐
     │    Geometry::apply_pose     │
     │      → IK Foot Locking      │
     │      → Skinning Matrices    │
     └──────────────┬──────────────┘
                    │ Vertices
     ┌──────────────▼──────────────┐
     │    SceneNode::update        │
     │      → Transform Propagation│
     │      → Dirty Flag Check     │
     └──────────────┬──────────────┘
                    │ World-space mesh
     ┌──────────────▼──────────────┐
     │    Render::draw_mesh        │
     └─────────────────────────────┘
```

## Why Separate Subsystems?

The three subsystems were initially one struct. Splitting them improved testability (each subsystem has independent tests), parallelism (scene graph updates are independent from animation — they can run on different threads), and composability (a character can share geometry with another but have a different manager for different animation behavior).

The SGM framework is single-threaded by design — characters don't share state, so the framework can parallelize at the character level. The character update loop runs as: for each character, update manager → apply pose → update scene graph → submit to renderer. The loop is parallelized with rayon: `characters.par_iter_mut().for_each(|c| c.update(dt))`. With 100 characters, this parallel loop runs in about 3ms on 8 cores vs 5ms single-threaded.