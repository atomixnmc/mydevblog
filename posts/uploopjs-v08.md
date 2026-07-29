# Uploop v0.8 Release

Uploop v0.8 is the biggest release since the initial prototype. New features: GPU ECS, binary streaming protocol, Bridges React renderer, and a rewritten scene graph.

## GPU ECS (Entity Component System)

The most requested feature. Components are stored as columns in GPU buffers. Queries compile to compute shaders automatically:

```typescript
@gpu_query
function physicsSystem(
    positions: Read<Vec3>,
    velocities: Read<Vec3>,
    outputs: Write<Vec3>,
) {
    // Compiles to a WGSL compute shader
    // Each GPU thread processes one entity
    const dt = 1.0 / 60.0;
    outputs[threadId] = positions[threadId] + velocities[threadId] * dt;
}
```

Entity queries that would take 4ms on CPU (100K entities) now take 0.1ms CPU + 2.8ms GPU — about 30% faster total, with the CPU free for other work. The real win is parallelism — GPU queries scale with GPU compute units, not CPU cores. On a 16-core CPU, 4ms of query time is the CPU fully loaded. On GPU, the same query uses a fraction of GPU compute and leaves the CPU idle for rendering or game logic.

## Binary Stream Protocol

The streaming protocol (Uploop Stream) replaces JSON-over-WebSocket with:

- Delta compression (sends only changed fields)
- Variable-length integers (10-35 bytes per entity update vs 120+ for JSON)
- Interest management (only relevant entities sent per client)
- Reliability stratification (reliable for events, unreliable for positions)

Bandwidth dropped from 2.4Mbps per client to 200Kbps for a 50-player demo with 1000 entities. Server CPU usage for networking dropped 75%.

## Bridges React Renderer

React components that render to the GPU instead of the DOM:

```tsx
function GameUI() {
  return (
    <Canvas>
      <Camera position={[0, 2, 5]} />
      <Light type="directional" />
      <Player position={position} />
    </Canvas>
  );
}
```

Bridges implements React Reconciler for Uploop's scene graph. State changes trigger GPU buffer updates. The reconciler overhead is ~0.5ms per frame for a complex component tree.

## Scene Graph Rewrite

The scene graph now uses an archetype-based storage (like ECS) instead of a naive object tree. This reduced memory per entity from 256 bytes to 64 bytes and made transform updates batch-optimized for GPU upload. Dirty flag propagation is now O(entities_changed) instead of O(entities_in_subtree) — only entities whose transform actually changed are marked dirty and re-uploaded to the GPU. For a scene with 1000 entities where 50 move each frame, this cut GPU upload bandwidth by 95% (from uploading 1000 transforms to uploading 50).

## Migration Guide

v0.7 → v0.8 breaking changes:

- **Component registration**: `registerComponent(name, schema)` → `@component class`. The decorator-based approach is more type-safe and enables the compiler to generate WGSL bindings automatically.
- **Scene graph API**: `scene.addChild()` → `scene.add()`. Child management is now through the archetype system.
- **Stream config**: `new Stream({ json: true })` → binary stream is the default. Update to `{ format: 'json' }` if you need JSON for debugging.
- **Shader API**: `ge.createShader(source)` → `ge.shader(source)`. The shader compilation is now async and cached.

The migration script handles about 80% of API changes automatically. Run `npx @uploop/upgrade` to convert your codebase.