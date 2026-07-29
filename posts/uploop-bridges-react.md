# Uploop Bridges React

Uploop Bridges is a React renderer that renders components through Uploop GE (GPU Engine) instead of the DOM. It lets you write React components that render with GPU-accelerated graphics — shadows, post-processing, particle systems — using familiar React patterns.

## How It Works

Bridges implements a custom React reconciler that targets Uploop GE's scene graph instead of the DOM. Components map to scene objects:

```tsx
import { Canvas, Mesh, Light, Camera } from '@uploop/bridges';

function Scene() {
  return (
    <Canvas>
      <Camera position={[0, 2, 5]} />
      <Light type="directional" intensity={10} />

      <Mesh geometry="sphere" material={{ color: '#ff6600', roughness: 0.3 }}>
        <transform position={[0, 1, 0]} rotation={[0, time * 0.5, 0]} />
      </Mesh>

      <Ground />
    </Canvas>
  );
}
```

The reconciler handles the same lifecycle as React DOM — `useEffect`, `useState`, context — but the output is WebGPU command buffers instead of HTML. State changes trigger scene graph updates, which GE batches into the next frame's render pass.

## Composability

Bridges supports higher-order components. A wrapper component can add effects to its children:

```tsx
function Bloom({ children, intensity }) {
  return (
    <PostProcessing effect="bloom" intensity={intensity}>
      {children}
    </PostProcessing>
  );
}

function App() {
  return (
    <Canvas>
      <Bloom intensity={1.5}>
        <ParticleSystem count={1000} />
      </Bloom>
    </Canvas>
  );
}
```

The `PostProcessing` component wraps its children in a render pass with a bloom post-process effect. React's component composition works naturally because Bridges maps the component tree to GE's render graph.

## Bridging DOM and GPU

Bridges allows embedding DOM content inside 3D scenes via texture surfaces:

```tsx
function VirtualScreen() {
  return (
    <Mesh geometry="plane">
      <SurfaceTexture width={1024} height={768}>
        <div style={{ background: 'white', padding: 20 }}>
          <h1>Hello from the DOM!</h1>
          <Counter />
        </div>
      </SurfaceTexture>
    </Mesh>
  );
}
```

This is how Uploop apps render complex UI inside 3D environments — forms, charts, and data tables rendered as DOM textures on virtual screens. The DOM subtree renders to an offscreen canvas, which uploads as a GPU texture each frame.

## Performance

Bridges runs at 60 FPS on integrated GPUs for moderate scenes (under 100 meshes, under 50 lights). The reconciler overhead is about 0.5ms per frame for a complex component tree. State updates trigger targeted scene graph mutations instead of rebuilding the entire frame, keeping GPU work minimal. On an M1 MacBook Air, a 200-component scene runs at a steady 58-60 FPS. The only frame drops come from texture uploads, which we handle with async streaming to avoid blocking the render thread. If you want GPU-powered React without Three.js boilerplate, Bridges is designed for exactly that niche.