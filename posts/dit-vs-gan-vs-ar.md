# DiT vs GAN vs AR for Image Generation

Three dominant approaches: Diffusion Transformers (DiT), Generative Adversarial Networks (GANs), and Autoregressive (AR) models. Each has different strengths in quality, speed, and controllability.

## Quality

| Metric | DiT-XL/2 | StyleGAN-XL | AR (DALL-E) |
|---|---|---|---|
| FID (ImageNet 256×256) | 2.27 | 2.30 | 4.50 |
| IS (ImageNet 256×256) | 278 | 265 | 210 |
| CLIP score (MS-COCO) | 0.32 | 0.30 | 0.35 |
| Freq. bandwidth | Full | Limited (G) | Full |

DiT and GAN are close on FID (Frechet Inception Distance). DiT produces more diverse samples (higher IS, Inception Score). AR models lag on FID because of the discretization loss — pixel values are quantized to tokens, and error accumulates across the autoregressive generation steps. CLIP score favors AR — the autoregressive nature means better text-image alignment because each token is conditioned on the entire text prompt.

## Speed

| Metric | DiT | GAN | AR |
|---|---|---|---|
| Inference (256×256) | 0.5s (50 steps) | 5ms (1 pass) | 2s (1024 tokens) |
| Inference (1024×1024) | 8s | 15ms | 15s+ |
| Training time | 7 days (256 GPUs) | 5 days (8 GPUs) | 14 days (512 GPUs) |
| GPU hours (training) | 43,000 | 960 | 172,000 |

GANs are orders of magnitude faster. One forward pass through a generator produces an image — no iterative denoising, no sequential token generation. DiT needs 50+ denoising steps (though LCM distillation reduces this to 4 steps with quality loss). AR models need one forward pass per token — for a 1024×1024 image at 16×16 patch size, that's 4096 forward passes.

## Controllability

DiT excels at: class-conditional generation (adaLN conditions on class labels), text-to-image (cross-attention to text embeddings), image-to-image (SDEdit from noisy input), inpainting (replace masked regions), and style transfer (feature injection from style reference).

GANs excel at: latent space interpolation (smooth morphing in W space), style mixing (combine styles from different latents), and real-time generation (sub-millisecond). GAN control is through the latent vector — there's no direct text conditioning in vanilla GANs, though conditional GANs (cGAN, BigGAN) add class conditioning.

AR models excel at: text-conditional generation (TPU-native, the AR process naturally conditions on text), in-context learning (few-shot generation from example images), and captioning/image understanding (they can caption their own outputs, which is hard for DiT and GANs).

## Practical Trade-offs

**Use DiT when**: You need high-quality, diverse outputs and have the compute budget for 50 denoising steps. Text-to-image quality is excellent with CFG. Batch generation is efficient (process 4 images in roughly the same time as 1).

**Use GAN when**: Latency matters. Single-image generation in 5ms is hard to beat. StyleGAN also gives you the most controllable latent space — W+ space interpolation for smooth transitions, style mixing for combining attributes. GANs are best for interactive applications (real-time face generation, video game textures).

**Use AR when**: In-context generation matters (show the model 2 examples and it generates similar images). Text alignment is critical (AR models have the best CLIP scores). You need a unified architecture that handles understanding and generation — the same AR model that generates images can also caption them.

## Convergence

The field is converging toward diffusion transformers for high-quality generation, GANs for real-time applications, and AR for multimodal understanding + generation. DiT distillation (LCM, progressive distillation) is closing the speed gap — 4-step DiT at near-original quality makes it competitive with GANs. AR models with improved discretization (VQGAN with larger codebooks, finite scalar quantization) are closing the FID gap. By 2027, the distinctions may be mostly architectural preferences rather than fundamental quality differences.