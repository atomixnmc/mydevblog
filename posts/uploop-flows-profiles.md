# Uploop Flows and Profiles

Uploop Flows is a visual scripting system for building GPU-based data pipelines. Profiles are reusable pipeline configurations that combine flows with parameter overrides. Together they let you build complex GPU pipelines without writing pipeline code.

## Flows

A flow is a directed acyclic graph of processing nodes:

```typescript
import { Flow, Source, Transform, Sink } from '@uploop/flows';

const videoFlow = new Flow('video_pipeline');

const camera = new Source({
  type: 'camera',
  device: '/dev/video0',
  format: 'NV12',
  resolution: [1920, 1080],
  framerate: 30,
});

const crop = new Transform({
  type: 'crop',
  region: [100, 100, 800, 800],
  gpu: true, // Runs on GPU
});

const encode = new Transform({
  type: 'encode',
  codec: 'h264',
  bitrate: '8M',
  gpu: true, // Hardware encoder
});

const output = new Sink({
  type: 'file',
  path: '/output/video.mp4',
});

videoFlow.connect(camera, crop);
videoFlow.connect(crop, encode);
videoFlow.connect(encode, output);

await videoFlow.start();
```

Flows compile to GPU compute shaders where possible. The `crop` transform is a trivial shader (texture coordinate offset). The `encode` transform uses the GPU's hardware encoder (NVENC, VAAPI, VideoToolbox). Flows that can't be GPU-accelerated fall back to CPU processing transparently.

## Profiles

A profile is a flow template with parameter overrides:

```typescript
const StreamProfile = {
  name: '1080p Streaming',
  flow: videoFlow,
  overrides: {
    camera: { resolution: [1920, 1080], framerate: 30 },
    encode: { codec: 'h264', bitrate: '6M', preset: 'fast' },
  },
};

const RecordProfile = {
  name: '4K Recording',
  flow: videoFlow,
  overrides: {
    camera: { resolution: [3840, 2160], framerate: 60 },
    encode: { codec: 'hevc', bitrate: '50M', preset: 'slow' },
  },
};
```

Profiles are JSON-serializable and can be shared across devices. The override mechanism uses deep merge — you only specify the parameters that differ from the flow defaults.

## Profile Selection

Flows can switch profiles at runtime:

```typescript
const cameraController = new FlowController(videoFlow);

// Detect bandwidth and select profile
bandwidthMonitor.onchange((bw) => {
  if (bw > 50_000_000) { // 50 Mbps
    cameraController.applyProfile(RecordProfile);
  } else if (bw > 5_000_000) { // 5 Mbps
    cameraController.applyProfile(StreamProfile);
  } else {
    cameraController.applyProfile(MobileProfile);
  }
});
```

The profile switch is seamless — the flow uses a double-buffered pipeline so the transition doesn't drop frames. The old profile's in-flight frames complete processing on the old configuration while new frames use the new configuration. The switch latency is one frame (33ms at 30 FPS).

## Flow Composition

Flows can be composed hierarchically:

```typescript
const mainFlow = new Flow('main');
const cameraFlow = new Flow('camera_sub');
const overlayFlow = new Flow('overlay_sub');

// Compose sub-flows
mainFlow.compose(cameraFlow);
mainFlow.compose(overlayFlow);

// Connect sub-flow outputs
cameraFlow.connectTo(mainFlow, 'frame');
overlayFlow.connectTo(mainFlow, 'overlay');

// Main flow composites layers
mainFlow.transform('composite', (frame, overlay) => {
  // GPU shader that blends overlay onto frame
  return blend(frame, overlay, { alpha: 0.5 });
});
```

Flow composition is used for complex pipelines — security cameras with AI overlay, livestreaming with graphics, multi-camera stitching. Each sub-flow can independently select its profile, so the camera sub-flow switches between 1080p and 4K while the overlay sub-flow stays at 1080p. The composite transform handles the resolution difference automatically with GPU-based resize.