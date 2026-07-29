# Training DiT Models

Diffusion Transformers (DiTs) replace the U-Net backbone in diffusion models with a Transformer. The core idea is simple — patchify the latent representation, feed patches as tokens through a transformer, and predict the noise. Training DiTs requires careful attention to architecture, conditioning, and compute efficiency.

## Architecture

A DiT consists of a patch embedding layer, a stack of transformer blocks, and a de-patchify layer:

```python
class DiT(nn.Module):
    def __init__(self, image_size=256, patch_size=2, in_channels=4):
        super().__init__()
        self.patch_embed = PatchEmbed(
            image_size, patch_size, in_channels, hidden_size=1152
        )
        self.blocks = nn.ModuleList([
            DiTBlock(hidden_size=1152, num_heads=16)
            for _ in range(28)
        ])
        self.final_layer = FinalLayer(hidden_size=1152, patch_size=2, out_channels=4)

    def forward(self, x, t, y):
        x = self.patch_embed(x)        # (B, N, D)
        t = self.timestep_embed(t)     # Sinusoidal position encoding
        y = self.label_embed(y)        # Class labels or text embeddings
        for block in self.blocks:
            x = block(x, t, y)         # Adaptive Layer Norm (adaLN)
        return self.final_layer(x)
```

The training objective is the standard simple loss — L2 between predicted and actual noise:

```python
def dit_loss(model, x_0, t, noise):
    x_t = q_sample(x_0, t, noise)     # Forward diffusion
    noise_pred = model(x_t, t)        # Predict noise
    return F.mse_loss(noise_pred, noise)
```

## Conditioning with adaGN

DiT blocks use adaptive layer norm (adaLN) — scale and shift parameters are predicted from the timestep and class embedding:

```python
class DiTBlock(nn.Module):
    def __init__(self, hidden_size, num_heads):
        super().__init__()
        self.norm1 = nn.LayerNorm(hidden_size, elementwise_affine=False)
        self.attn = Attention(hidden_size, num_heads)
        self.norm2 = nn.LayerNorm(hidden_size, elementwise_affine=False)
        self.mlp = MLP(hidden_size * 4)
        self.adaLN = nn.Sequential(
            nn.SiLU(),
            nn.Linear(hidden_size, 6 * hidden_size),
        )

    def forward(self, x, t, y):
        shift_msa, scale_msa, gate_msa, shift_mlp, scale_mlp, gate_mlp = \
            self.adaLN(t + y).chunk(6, dim=-1)
        x = x + gate_msa * self.attn(modulate(self.norm1(x), shift_msa, scale_msa))
        x = x + gate_mlp * self.mlp(modulate(self.norm2(x), shift_mlp, scale_mlp))
        return x
```

adaLN works significantly better than cross-attention for timestep conditioning. The scale/shift/gate mechanism lets the model selectively amplify or suppress features based on the diffusion timestep — early in sampling (high noise) the model prioritizes layout, later it prioritizes detail.

## Training Configuration

We trained a 600M parameter DiT on 256x256 ImageNet with 256 A100 GPUs. Key hyperparameters:

- **Batch size**: 2048 (global), gradient accumulation to reach effective 4096
- **Learning rate**: 1e-4 with cosine decay, 5000-step warmup
- **AdamW**: β1=0.9, β2=0.999, weight decay=0.01
- **EMA**: Exponential moving average with decay 0.9999 — the EMA weights consistently generate better samples than the online weights
- **Training steps**: 400K (about 7 days)

DiT converges slower than U-Net diffusion models in terms of wall-clock time (transformer attention is expensive), but achieves better final FID scores — we saw 2.27 FID for DiT-XL/2 vs 3.45 for the U-Net baseline. The trade-off is inference speed: DiT's self-attention is O(N²) in patches, where N = (image_size/patch_size)². For 256x256 with patch_size=2, that's 16384 tokens — manageable. For 1024x1024, it's 262K tokens, which requires windowed attention.

## Classifier-Free Guidance

CFG is essential for DiT quality. Training uses 10% unconditional dropout — the class label embedding is zeroed with 10% probability, so the model learns class-unconditional generation. At inference, the prediction is extrapolated away from the unconditional direction: `pred = unconditional + guidance_scale * (conditional - unconditional)`. We found guidance_scale=4.0 optimal for ImageNet — higher values increase saturation and reduce diversity.