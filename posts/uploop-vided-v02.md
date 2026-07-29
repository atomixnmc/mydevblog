# Uploop Vided v0.2

Vided v0.2 ships temporal consistency improvements, a new composition API, and the MCP server for AI video editing.

## Temporal Consistency

The biggest complaint about v0.1 was flickering — frames would change lighting, textures, and character positions unpredictably. We added temporal conditioning:

```python
class TemporalConditioning:
    def __init__(self, window_size: int = 5):
        self.window_size = window_size
        self.latent_buffer = deque(maxlen=window_size)

    def condition(self, latent: torch.Tensor, step: int) -> torch.Tensor:
        # Schedule for temporal attention
        if step < 10:  # Early steps: weak conditioning
            weight = 0.3
        elif step < 15:
            weight = 0.6
        else:  # Late steps: strong conditioning for consistency
            weight = 0.9

        if len(self.latent_buffer) < 2:
            self.latent_buffer.append(latent)
            return latent

        # Blend with previous frame's latent
        prev = self.latent_buffer[-1]
        blended = latent * (1 - weight) + prev * weight
        self.latent_buffer.append(latent)
        return blended
```

The temporal buffer stores the last 5 frames' latents. Early denoising steps use weak conditioning (0.3 weight) to allow creative freedom. Late steps use strong conditioning (0.9 weight) to ensure the final output matches the previous frame. The weighted blend smooths out flickering without making the video static — motion is preserved because the blending is per-pixel in latent space.

## Composition API

The composition API allows multi-layer video assembly:

```python
from uploop.vided import Scene, Layer

scene = Scene(1920, 1080, fps=30)

# Background
bg = vided.generate("sunset landscape, 4K", duration=5.0)
scene.add_layer(Layer(bg, position=(0, 0), z_index=0))

# Character
char = vided.generate("person walking, medium shot", duration=3.0)
scene.add_layer(Layer(
    char,
    position=(200, 400),
    z_index=1,
    scale=0.7,
    mask=vided.segment("person"),  # Auto-mask
))

# Text overlay
scene.add_text("Hello World", position="center", font_size=48)

clip_id = scene.render()
```

The `mask` parameter uses SAM2-based automatic segmentation. The character layer is masked so only the person is visible, not the background from their generated clip. This enables compositing independently generated clips into a coherent scene.

## MCP Server

The MCP server (Model Context Protocol) exposes video generation as tools callable from AI assistants:

```bash
vided-mcp-server --config config.toml
```

The server listens for MCP connections and handles video generation requests. Integration with Claude Desktop enables natural language video editing — describe what you want, and Claude calls the Vided tools to generate it. The server requires 16GB VRAM for the XL model and handles up to 4 concurrent requests.

## Performance Improvements

| Model | v0.1 (s/frame) | v0.2 (s/frame) | Speedup |
|---|---|---|---|
| Base (512×512) | 0.8 | 0.35 | 2.3x |
| XL (768×512) | 1.5 | 0.5 | 3.0x |
| XL (1024×768) | 3.2 | 0.9 | 3.6x |

Speedups come from: latent caching across frames (reuse K/V from frame N for frame N+1), sliding window attention (16-frame window instead of full temporal attention), and warm-start initialization (first frame: 20 steps, subsequent: 5 steps each). The warm-start technique alone accounts for 60% of the speedup — generating frame 0 at 20 steps then each subsequent frame at 5 steps produces quality comparable to 20 steps per frame, because consecutive frames share significant latent content.