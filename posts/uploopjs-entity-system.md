# Uploop Entity System

Uploop's entity system is an ECS (Entity Component System) designed for GPU-accelerated game states. Unlike traditional ECS (Flecs, Bevy ECS), Uploop's ECS stores component data in GPU-compatible buffers so that queries and mutations can run on the GPU.

## GPU-Native ECS

Traditional ECS stores components in CPU-side sparse sets. Queries iterate these sets on the CPU. Uploop stores components in GPU-side storage buffers (SSBOs) and runs queries on the GPU using compute shaders:

```rust
// Component definition — Rust side
#[derive(Component)]
struct Transform {
    position: Vec3,
    rotation: Vec4,
    scale: Vec3,
}

#[derive(Component)]
struct Velocity {
    linear: Vec3,
    angular: Vec3,
}
```

![](2023/uploopjs-entity-system_img-001.png)

```rust
// GPU query — runs as compute shader
#[gpu_query]
fn physics_system(query: Query<(&Transform, &mut Transform, &Velocity)>) {
    // This generates a compute shader:
    //   layout(std430, binding = 0) readonly buffer TransformIn { ... };
    //   layout(std430, binding = 1) buffer TransformOut { ... };
    //   layout(std430, binding = 2) readonly buffer Velocity { ... };
    //   void main() {
    //       uint id = gl_GlobalInvocationID.x;
    //       TransformOut[id].position = TransformIn[id].position + Velocity[id].linear * dt;
    //   }
}
```

## Query Compilation

Uploop's ECS compiles queries into compute shaders at build time. The `#[gpu_query]` macro generates both the shader code and the dispatch metadata:

```rust
struct PhysicsSystem {
    shader: ComputeShader,
    transform_in_binding: u32,  // 0
    transform_out_binding: u32, // 1
    velocity_binding: u32,      // 2
    dispatch_size: (u32, u32, u32),
}
```

The dispatch size is derived from entity count. Each GPU thread processes one entity. For 10,000 entities, dispatch is (ceil(10000/256), 1, 1) = (40, 1, 1) with 256-thread workgroups.

## Cross-Language Queries

Queries can span multiple languages:

![](2023/uploopjs-entity-system_img-002.png)

```javascript
// JavaScript — declarative query
const result = uploop.query(
    'Transform', 'Velocity', 'Mesh',  // read components
    ['Transform', 'Position'],         // write components
    e => e.velocity.linear.length() > 0  // filter
);
// Returns typed arrays mapped to GPU buffers
result.forEach(entity => {
    entity.transform.position.y += dt;
});
```

The JavaScript query is compiled to a GPU compute shader with a JS fallback for the filter predicate. If the predicate can't be expressed as a shader (uses arbitrary JS features), the query falls back to CPU-side processing. We added a JIT path that compiles simple predicates to WGSL — this covers about 80% of real-world filters (comparisons, boolean combinations, arithmetic).

## Entity Archetypes

Uploop groups entities by their component set (archetype):

```
Archetype: [Transform, Velocity]
  Entity 1: { pos: (0,0,0), vel: (1,0,0) }
  Entity 2: { pos: (1,2,3), vel: (0,1,0) }

Archetype: [Transform, Mesh, Material]
  Entity 3: { pos: (5,0,0), mesh: Cube, mat: Red }
  Entity 4: { pos: (0,5,0), mesh: Sphere, mat: Blue }
```

![](2023/uploopjs-entity-system_img-003.png)

Components within an archetype are stored as columns in GPU storage buffers:

```
Transform.position: [0,0,0, 1,2,3, 5,0,0, 0,5,0]
Transform.rotation: [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0]
Velocity.linear:    [1,0,0, 0,1,0, null, null]
```

Columnar storage means queries only touch the buffers they need. A system querying `Transform` + `Velocity` reads only those 2 buffers, not the full archetype row. This reduces memory bandwidth — typical bandwidth per query is 12 bytes per entity (2 × Vec3) instead of 48+ bytes per entity (full archetype row).

## Performance

We benchmarked Uploop's GPU ECS against Bevy's CPU ECS with 100,000 entities running a simple movement system (read position/velocity, write position). Results:

| System | FPS | CPU time (ms) | GPU time (ms) |
|---|---|---|---|
| Bevy ECS (CPU) | 58 | 4.2 | 0 |
| Uploop GPU ECS | 144 | 0.1 | 2.8 |

The GPU ECS achieves 144 FPS limited by the display refresh rate — the actual GPU time is 2.8ms (potential 350+ FPS). The CPU is nearly idle (0.1ms for dispatch overhead). The trade-off is latency — GPU queries have ~3ms pipeline latency vs CPU queries' sub-microsecond latency. For position updates that don't require immediate feedback, GPU queries are fine. For input-driven state changes (character responds to keypress), we use CPU-side queries with a dedicated low-latency archetype.
