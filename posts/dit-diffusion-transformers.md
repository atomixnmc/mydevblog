# Diffusion Transformers (DiT): Scaling Diffusion with Transformers

Diffusion Transformers (DiT), introduced by William Peebles and Saining Xie in 2023, replace the U-Net backbone of diffusion models with a Transformer architecture. The results were immediate and dramatic: state-of-the-art image generation that scales predictably with compute.

**The architectural shift**: Traditional diffusion models (DDPM, Stable Diffusion) use a U-Net with convolutional blocks and self-attention layers. DiT replaces this entirely with a Vision Transformer (ViT) that operates on latent patches. The input noise latent (e.g., 64×64×4) is divided into patches, linearly embedded into tokens, and processed through standard Transformer blocks. The output tokens are reshaped into a denoised latent.

**Conditioning mechanisms** differ from U-Net approaches. DiT injects timestep and class labels through adaptive layer normalization (adaLN). Instead of adding channel-wise scaling to convolutional features, DiT modulates the scale and shift parameters of LayerNorm at each Transformer block: `adaLN(h) = tanh(γ) * LN(h) + β`, where γ and β are regressed from the timestep and label embeddings. Text conditioning (for DiT models trained on captions) uses cross-attention similar to Stable Diffusion.

**Scaling behavior** is the headline result. DiT exhibits power-law scaling: a 2x increase in GFLOPs (model compute) consistently improves FID scores across model sizes from DiT-S (33M params) to DiT-XL (675M params). This predictable scaling mirrors language model scaling laws, suggesting that Transformer-based diffusion models benefit from the same compute-optimal training regimes.

**Training efficiency**: DiT matches U-Net quality with 70% fewer FLOPs at the same image quality. The patch-based processing enables flexible compute allocation—larger patch sizes reduce sequence length and compute at the cost of generation quality. Training can start with large patches for fast iteration, then fine-tune with smaller patches for quality.

**Inference improvements**: DiT's native resolution flexibility enables training at one resolution and fine-tuning for another without architectural changes. Classifier-free guidance works identically to U-Net diffusion. Latent caching (reusing intermediate activations across denoising steps) provides 30-40% speedup with minimal quality loss.

DiT has rapidly been adopted as the backbone for video generation (Stable Video Diffusion), image editing, and pixel-level DIT models. The trend suggests that Transformers will continue replacing U-Nets across the generative AI landscape.
