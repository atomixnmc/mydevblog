# Uploop Server SSR

Uploop Server is a server-side rendering (SSR) engine for Uploop applications. It renders 3D scenes on the server and streams the result as video frames to clients — enabling 3D applications on devices that can't run WebGPU.

## Architecture

```
Client (WebRTC/WebSocket)
    ▲
    │ Video frames (H.264/H.265)
    │ Input events (click, keyboard, gamepad)
    │
Server (headless GPU)
    ├── GPU Renderer (WebGPU via Dawn/Vulkan)
    ├── Encoder (NVENC/VAAPI/Software)
    └── Stream Manager
```

The server runs a headless GPU (Nvidia RTX 4090 with no display attached). It renders frames using WebGPU (via Dawn, Google's WebGPU implementation for native use). The rendered frames are encoded as H.264 and streamed to the client over WebRTC.

## Headless Rendering

```rust
use uploop_server::{HeadlessGPU, StreamConfig};

let gpu = HeadlessGPU::new(Backend::Vulkan)?;
let stream = gpu.create_stream(StreamConfig {
    width: 1920,
    height: 1080,
    fps: 60,
    bitrate: 20_000_000, // 20 Mbps
    codec: Codec::H264,
});

let scene = uploop::Scene::new();
scene.add_mesh(/* ... */);

loop {
    gpu.render(&scene, &stream)?;
    // Stream automatically sends frame to connected clients
    std::thread::sleep(Duration::from_nanos(16_666_667)); // 60 FPS
}
```

The headless GPU creates a Vulkan instance without a window. Frames are rendered to an offscreen framebuffer, which is copied to the encoder's input buffer. The encoder produces H.264 NAL units, which are packetized and sent via WebRTC's data channel or video track.

## Client-Side

The client receives the video stream and renders it in a `<video>` element. Input events are sent back to the server:

```typescript
const client = new UploopClient({
    serverUrl: "wss://game-server.example.com/stream",
    quality: "1080p@60fps",
});

client.addEventListener("frame", (frame) => {
    // Video frame rendered into <video>
    displayElement.src = frame.url;
});

// Send input back
document.addEventListener("mousemove", (e) => {
    client.sendInput({
        type: "pointer",
        x: e.clientX,
        y: e.clientY,
    });
});
```

The client is a thin shell — all rendering happens on the server. The WebRTC connection handles video frames (from server to client) and data channel messages (from client to server for input).

## Use Cases

**Low-end devices**: Smart TVs, set-top boxes, and mobile devices that don't support WebGPU can run Uploop applications via SSR. The device only needs H.264 decoding, which virtually all devices support.

**Server-side AI**: AI-driven scenes (Uploop Vided) that run on the GPU. The server renders with AI-enhanced graphics and streams the result. The client doesn't need a GPU at all.

**Security**: The application code never leaves the server. Clients receive video frames only — they can't inspect the scene graph, extract models, or modify state.

## Performance

| Metric | Local (WebGPU) | SSR (Local network) | SSR (Internet) |
|---|---|---|---|
| Frame latency | 16ms | 25ms | 45-80ms |
| Client CPU usage | 5-15% | 1-3% | 1-3% |
| GPU requirement | Required | None | None |
| Bandwidth (1080p@60) | 0 | 15-25 Mbps | 15-25 Mbps |

SSR adds 9-64ms of latency depending on network conditions. For non-interactive applications (viewing a 3D model, watching a simulation), this is acceptable. For interactive applications (games, real-time editing), local rendering is better.

We optimize SSR latency with: look-ahead rendering (render 2 frames ahead), adaptive bitrate (drop to 720p@30 when latency exceeds 100ms), and frame interpolation on the client (generates intermediate frames using a lightweight AI model that runs on the client's video decoder). The interpolation adds 2ms and makes 45fps feel like 90fps for camera movement — not perfect but good enough for most 3D viewing applications.