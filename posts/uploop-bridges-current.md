# Uploop Bridges Current State

Uploop Bridges is the React renderer for Uploop's GPU engine. It's functional but not yet ready for production game UI. Here's the current status.

## What Works

**Component rendering**: React components render to Uploop's scene graph. A `<Mesh>` component creates a mesh node, a `<Light>` creates a light node. Props update trigger scene graph mutations — changing `<Mesh position={[1,2,3]}>` updates the mesh's transform buffer. The reconciler diffs the component tree against the scene graph and applies minimal updates.

**Scene composition**: Components compose naturally — `<Canvas>` wraps the render context, children add to the scene. The context system (React Context) works: a `<ThemeContext>` in `<Canvas>` is accessible by any descendant mesh component.

**DOM integration**: The `<SurfaceTexture>` component renders React DOM content onto a GPU texture. This is the primary use case — 3D scenes with embedded 2D UI (forms, charts, HUDs). The DOM content is rendered to an offscreen canvas, uploaded as a GPU texture, and mapped onto a 3D surface.

## What's Flaky

**Event handling**: DOM events (click, hover, drag) work but the hit-testing is slow. When you click on a 3D scene, Bridges must ray-cast through the scene graph to find the clicked object. For scenes with 1000+ objects, this takes 2-5ms. We're working on a GPU-based hit testing (ray cast against bounding boxes on GPU) that should bring this under 0.5ms.

**Animation**: React's `requestAnimationFrame`-based animation (Framer Motion, react-spring) conflicts with Uploop's render loop. The React animation drives state changes at 60 FPS, which triggers scene graph updates at 60 FPS, which uploads buffer updates to the GPU. This works but wastes GPU bandwidth when nothing visually changes (e.g., a color animation that doesn't change the mesh geometry). We need a "commit only dirty buffers" optimization that skips the GPU upload when only color/shader parameters changed (small payload) vs geometry changed (large payload).

**State management**: Zustand and Jotai work with Bridges. Redux works partially — the subscription model conflicts with how Bridges batches GPU uploads. Redux dispatches that trigger many component updates in one frame can cause Bridges to upload the same buffer multiple times in one frame.

## Performance

| Scene | FPS | GPU upload size/frame |
|---|---|---|
| 10 meshes, static | 60 | 0 bytes (cached) |
| 100 meshes, animated | 55 | 50KB (transforms) |
| 500 meshes, animated | 42 | 250KB |
| 1000 meshes, animated | 28 | 500KB |

The bottleneck at 1000 meshes is GPU upload bandwidth. Each animated mesh uploads its transform (64 bytes) each frame. For 1000 meshes, that's 64KB — not huge, but the upload competes with render commands for PCIe bandwidth. We mitigate this by: uploading only meshes visible in the viewport (frustum culling), batching transform uploads into a single buffer (one DMA transfer instead of 1000), and using persistent mapped buffers (BAR1) on supported GPUs.

## Known Issues

- **Memory leaks**: Components that unmount and remount leave orphaned GPU resources. The ref counting on GPU buffers has a bug. We're investigating.
- **CSS styling**: Shoelace components rendered through `<SurfaceTexture>` render correctly but the event handling is off — mouse coordinates from the 3D hit-test don't always map correctly to the 2D texture coordinates, causing misplaced hover effects.
- **Hot reload**: React Fast Refresh doesn't work with Bridges — unmounting a component doesn't clean up its GPU resources, so hot reloading memory leaks. Restart the dev server when changing shader code.

Bridges is usable for non-critical UIs (debug overlays, developer tools, menu screens). For production UI (HUDs, interactive elements), we recommend either reducing the component count or using Bridges for the 3D scene and overlaying a traditional DOM UI on top.