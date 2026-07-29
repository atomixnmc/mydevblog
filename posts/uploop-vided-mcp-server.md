# Uploop Vided MCP Server

Uploop Vided exposes its video generation capabilities through the Model Context Protocol (MCP). This means any MCP client — Claude Desktop, VS Code Copilot, custom tools — can call Vided's video generation, editing, and composition tools.

## MCP Interface

Vided implements the MCP transport over SSE, exposing tools and resources:

```python
from mcp import Server, Tool, Resource

class VidedServer(Server):
    async def register_tools(self):
        # Video generation
        self.add_tool(Tool(
            name="generate_video",
            parameters={
                "prompt": str,
                "duration": float,
                "fps": int,
                "style": Optional[str],
                "aspect_ratio": Optional[str],
            },
            handler=self.handle_generate_video,
        ))

        # Video editing
        self.add_tool(Tool(
            name="edit_video",
            parameters={
                "video_id": str,
                "edit_prompt": str,
                "start_frame": int,
                "end_frame": int,
                "strength": float,
            },
            handler=self.handle_edit_video,
        ))

        # Video composition
        self.add_tool(Tool(
            name="compose_video",
            parameters={
                "layers": list,
                "output_size": tuple,
            },
            handler=self.handle_compose_video,
        ))
```

## Generating Video from Claude

With Vided's MCP server running, any MCP client can generate video:

```
User: "Create a 5-second video of a futuristic city at night with neon lights"

Claude: [Calls Vided MCP tools]

Steps:
1. generate_video(prompt="futuristic city at night, neon lights, cinematic",
                   duration=5.0, fps=24, style="cyberpunk")
2. Result: video_id="vid_abc123"
3. generate_video(prompt="flying car crossing the city, motion blur",
                   duration=3.0, fps=24, style="cyberpunk")
4. Result: video_id="vid_def456"
5. compose_video(layers=[
     {"video_id": "vid_abc123", "z_index": 0},
     {"video_id": "vid_def456", "position": (400, 300), "z_index": 1, "scale": 0.5},
   ], output_size=(1920, 1080))

[Video output displayed in chat]
```

The MCP protocol handles the video data as binary base64-encoded resources. Vided registers a resource handler for `video://{video_id}` so clients can display videos inline.

## Custom Workflows

Users can define custom MCP workflow tools:

```python
@vided_server.tool()
async def create_explainer_video(
    script: list[dict],  # [{"text": "...", "visual": "...", "duration": 3.0}, ...]
) -> str:
    """Create an explainer video from a script. Each script segment is a text
    overlay with a corresponding generated visual."""
    layers = []
    for i, segment in enumerate(script):
        visual_id = await self.generate_video(
            prompt=segment["visual"],
            duration=segment["duration"],
            fps=24,
        )
        layers.append({"video_id": visual_id, "z_index": i * 2})
        layers.append({
            "text": segment["text"],
            "position": "bottom",
            "duration": segment["duration"],
            "z_index": i * 2 + 1,
        })
    return await self.compose_video(layers, output_size=(1920, 1080))
```

## Deployment

The MCP server runs as a standalone process with a config file:

```toml
[vided]
model = "vided-xl-v2"
device = "cuda:0"
cache_dir = "/data/vided-cache"

[mcp]
transport = "sse"
host = "0.0.0.0"
port = 8080
auth_token = "sk-vided-..."  # Optional API key
```

Start with `vided-mcp-server --config config.toml`. The server loads the model into GPU memory (requires 16GB VRAM for the XL model, 8GB for the base model) and listens for MCP connections. The auth token, when set, is verified against the MCP `Authorization: Bearer` header.

## Performance

Vided's MCP server generates 4-second clips in about 45 seconds (24 FPS, 768x512). The MCP protocol overhead is minimal — about 50ms per request (JSON serialization + auth check). The bottleneck is the diffusion process, not the protocol. We run multiple generation requests concurrently on the same GPU (batch processing), which improves throughput from 1 clip per 45 seconds to 2 clips per 55 seconds (batching amortizes the attention computation). The MCP server handles up to 4 concurrent requests before the GPU runs out of VRAM for latents.