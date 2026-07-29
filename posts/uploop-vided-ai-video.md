# Uploop Vided AI Video

Uploop Vided is an AI video generation platform built on top of Uploop's GPU engine. It provides a MCP server interface for generating, editing, and compositing video clips from natural language descriptions.

## Pipeline Architecture

Vided uses a staged diffusion pipeline optimized for video:

```
Prompt ──► Text Encoder ──► Latent Init ──► Temporal Diffusion ──► Decoder
                     │              │                │
               CLIP-L/14      VAE encoder    3D U-Net + T5
```

The key difference from image generation is the temporal dimension. Instead of generating a single latent (64×64), Vided generates a latent volume (frames × 64 × 64 × latent_channels). The 3D U-Net applies both spatial and temporal attention — each frame attends to its neighbors in the temporal axis.

## MCP Server

Vided exposes its capabilities through the Model Context Protocol:

```python
from mcp.server import Server
from mcp.types import Tool

class VidedMCP(Server):
    async def generate_clip(
        self,
        prompt: str,
        duration: float = 4.0,
        fps: int = 24,
        guidance_scale: float = 7.5,
    ) -> str:  # Returns clip ID
        frames = int(duration * fps)
        latent = self.diffuse(prompt, frames, guidance_scale)
        video = self.decode(latent)
        clip_id = self.store(video)
        return clip_id

    async def edit_clip(
        self,
        clip_id: str,
        prompt: str,
        mask_type: str = "object",
        strength: float = 0.7,
    ) -> str:
        clip = self.load(clip_id)
        edited = self.inpaint(clip, prompt, mask_type, strength)
        new_id = self.store(edited)
        return new_id
```

## Composition

Vided supports compositing multiple clips into a single scene:

```python
# Compose a scene from multiple clips
scene = vided.create_scene(1920, 1080, fps=30)

# Add background clip
bg = vided.generate_clip("sunset beach, cinematic lighting")
scene.add_layer(bg, z_index=0)

# Add foreground subject
subject = vided.generate_clip(
    "person walking, medium shot, natural",
    duration=3.0,
)
scene.add_layer(subject, position=(200, 300), z_index=1)

# Add overlay text
scene.add_text("Chapter 1: The Beach", position="center", duration=2.0)

# Render
clip_id = scene.render()
```

## Performance

Vided runs on a single RTX 4090 generating 24 FPS video at 768×512. Each frame takes about 500ms of inference (20 denoising steps). For 4 seconds of video (96 frames), total generation time is about 48 seconds. The bottleneck is the temporal attention — each frame attends to 2 neighbors on each side (5-frame window), so memory scales as O(frames × window_size).

We optimized with:
- **Frame caching**: Cache key/value tensors across denoising steps. First denoising step computes full attention; subsequent steps reuse cached KVs where the latent hasn't changed significantly (cosine similarity > 0.99).
- **Sliding window attention**: Instead of full temporal attention, use a 16-frame sliding window. Frames beyond 16 don't attend to each other. This makes generation O(frames) instead of O(frames²) but introduces visible seams at window boundaries. We handle this with overlapping windows and blending.
- **Warm-start**: The first frame conditions on a text prompt; subsequent frames condition on the previous frame's latent. This cuts inference to 5 steps per frame after frame 0 instead of 20.

## Video Editing

Vided supports frame-accurate editing:

```python
clip = vided.load_clip("vacation_clip.mp4")
# Replace object in frames 30-60
edited = vided.edit_clip(
    clip,
    prompt="red car instead of blue car",
    mask_type="object",
    frames=slice(30, 60),
)
```

The editing pipeline runs SDEdit (Stochastic Differential Editing) — adding noise to the masked region and re-denoising with the target prompt. The mask is generated automatically using SAM2 tracking through the selected frames. Strength controls how much noise is added: 0.3 for subtle texture changes, 0.7 for major object replacement, 1.0 for complete regeneration of the masked region.