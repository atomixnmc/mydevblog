# AniGo SGM Framework

AniGo SGM (Scene-Graph-Manager) is an ECS-like framework for animation-ready characters. It combines a scene graph (spatial hierarchy), a geometry system (meshes, skeletons), and a motion manager (animation state) into a single unified API. SGM is not a full ECS — it's specialized for the 300-500 moving parts typical of animated characters.

## Framework Structure

```
Entity (Character)
├── SceneNode (spatial)
│   ├── Transform (position, rotation, scale)
│   └── Children: [SceneNode, ...]
├── Geometry
│   ├── Mesh (vertices, indices, UVs)
│   ├── Material (shader parameters)
│   └── Skeleton (joint hierarchy)
└── Manager (animation)
    ├── MotionGraph (current motion state)
    ├── BlendState (transition blending)
    └── ControllerInput (joystick, AI)
```

Each character entity owns one scene graph (for positioning), one geometry set (for rendering), and one motion manager (for animation). The SGM framework ties these together so updating the motion manager automatically updates the scene graph.

## Scene Graph Updates from Animation

When the motion system produces a new pose, the SGM framework propagates joint transforms through the scene graph:

```rust
impl Character {
    fn apply_pose(&mut self, pose: &Pose) {
        // Pose contains joint transforms in skeleton-local space
        for (joint_index, joint_transform) in pose.joints().enumerate() {
            let scene_node = self.geometry.skeleton.node_for_joint(joint_index);

            // Convert local joint transform to model-space via hierarchy
            let parent = scene_node.parent();
            let model_transform = if let Some(parent) = parent {
                parent.model_transform() * joint_transform
            } else {
                self.scene_node.model_transform() * joint_transform  // root
            };

            scene_node.set_model_transform(model_transform);
        }

        // Update vertex skinning
        self.geometry.mesh.update_skinning(&self.geometry.skeleton);
    }
}
```

## Manager Layer

The Manager layer handles cross-system coordination — it ensures that AI input arrives before motion matching runs, and motion matching output is applied before rendering:

```rust
struct SGM {
    characters: Vec<Character>,
    systems: Vec<Box<dyn System>>,
}

trait System {
    fn phase(&self) -> SystemPhase;
    fn run(&mut self, characters: &mut [Character], dt: f32);
}

enum SystemPhase {
    Input,   // AI director, player input
    Motion,  // Motion matching, physics
    Blend,   // Transition blending, IK
    Apply,   // Scene graph update, skinning
    Render,  // Visibility culling, draw calls
}
```

Systems run in phase order. A character's AI system (Input) produces a goal. The motion system (Motion) queries the motion space. The blend system (Blend) applies IK. The apply system (Apply) sends transforms to the scene graph. The render system (Render) issues draw calls.

## Performance Profile

SGM overhead per character (100 characters, single core):

| Phase | Time (μs) | % of frame |
|---|---|---|
| Input (AI director) | 12 | 24% |
| Motion matching | 8 | 16% |
| Blend + IK | 15 | 30% |
| Scene graph update | 5 | 10% |
| Skinning + culling | 10 | 20% |
| **Total** | **50** | **100%** |

50μs per character × 100 characters = 5ms total animation pipeline. For 60 FPS (16.6ms budget), animation uses 30% of the frame — leaving room for rendering, physics, and game logic.

The SGM framework is single-threaded by design. Characters don't share state (no cross-character queries), so parallelism is trivial — we partition characters across worker threads for scenes with 500+ characters. With 4 threads, the animation pipeline for 500 characters runs in about 3.5ms.