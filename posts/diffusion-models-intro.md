# Diffusion Models: From DDPM to Stable Diffusion

Diffusion models have rapidly overtaken GANs as the state of the art in image generation. The core idea is inspired by non-equilibrium thermodynamics: systematically destroy structure in data by adding noise, then learn to reverse that process. When I first read the DDPM paper in 2020, it felt like watching someone turn scrambled eggs back into a clean egg — the math was elegant, but the results were still grainy. By the time Stable Diffusion landed in 2022, the field had moved so fast that we went from "can this generate a face?" to "can this generate a photorealistic face of a specific person in a specific pose with specific lighting" in under two years.

## Denoising Diffusion Probabilistic Models (DDPM)

DDPM established the mathematical foundations that everything else builds on. The forward process gradually adds Gaussian noise over T steps (typically 1000), turning a clean image \(x_0\) into pure noise \(x_T \sim \mathcal{N}(0, I)\). Each step is defined as:

\[q(x_t | x_{t-1}) = \mathcal{N}(x_t; \sqrt{1-\beta_t} x_{t-1}, \beta_t I)\]

The \(\beta_t\) schedule controls how quickly noise is added — typically a linear or cosine schedule. The beautiful property of the forward process is that we can sample any \(x_t\) directly from \(x_0\) in closed form:

\[x_t = \sqrt{\bar{\alpha}_t} x_0 + \sqrt{1-\bar{\alpha}_t} \epsilon\]

The reverse process learns to denoise step by step: \(p_\theta(x_{t-1} | x_t)\). Training minimizes the variational lower bound, which simplifies to predicting the noise \(\epsilon\) that was added:

```python
import torch
import torch.nn as nn

class SimpleDiffusionModel(nn.Module):
    def __init__(self, unet):
        super().__init__()
        self.unet = unet  # U-Net with time embeddings

    def training_step(self, x_0, t=None):
        batch_size = x_0.shape[0]
        if t is None:
            t = torch.randint(0, T, (batch_size,))

        # Sample noise and noisy image
        noise = torch.randn_like(x_0)
        x_t = self.q_sample(x_0, t, noise)

        # Predict noise
        noise_pred = self.unet(x_t, t)
        loss = nn.functional.mse_loss(noise_pred, noise)
        return loss

    @torch.no_grad()
    def sample(self, shape, device):
        x_T = torch.randn(shape, device=device)
        for t in reversed(range(T)):
            z = torch.randn_like(x_T) if t > 0 else 0
            x_T = self.p_sample(x_T, t, z)
        return x_T
```

Sampling iterates from noise backward, requiring 1000 model evaluations per image. This is impractically slow for real-time use — imagine waiting 15 seconds to generate each image on a high-end GPU.

## DDIM: Faster Sampling

Denoising Diffusion Implicit Models (DDIM) addressed the speed bottleneck by reformulating the process as non-Markovian. The key insight: the forward process doesn't *have* to be Markovian. By defining a family of forward processes that all share the same marginals, DDIM creates a deterministic reverse process that can skip steps:

```python
@torch.no_grad()
def ddim_sample(model, shape, device, steps=50):
    x_T = torch.randn(shape, device=device)
    step_size = T // steps  # Skip most steps
    times = list(range(0, T, step_size))[::-1]

    for t in times:
        t_tensor = torch.full((1,), t, device=device, dtype=torch.long)
        noise_pred = model(x_T, t_tensor)

        # DDIM update (deterministic)
        x_0_pred = (x_T - torch.sqrt(1 - alpha_bar[t]) * noise_pred) / torch.sqrt(alpha_bar[t])
        x_T = torch.sqrt(alpha_bar[t-1]) * x_0_pred + torch.sqrt(1 - alpha_bar[t-1]) * noise_pred

    return x_T
```

With DDIM, generating decent images in 50 steps is standard, and quality holds up well even at 20 steps. The deterministic sampling path also enables latent interpolation — morph between two images by averaging their noise representations and walking the path between them.

## Classifier-Free Guidance

Classifier-Free Guidance (CFG) is the dominant conditioning method in modern diffusion models. Instead of training a separate classifier to guide generation, CFG trains a single model with both conditional and unconditional objectives, then interpolates between them at inference:

```
epsilon_guided = epsilon_uncond + w * (epsilon_cond - epsilon_uncond)
```

The guidance scale \(w\) controls how strongly the model follows the conditioning. A scale of 7.5 is typical for text-to-image — high enough to follow the prompt, low enough to avoid artifacts. I've found that different prompts benefit from different scales: simple prompts need less guidance, complex prompts with multiple subjects need more.

## Latent Diffusion Models

The critical architectural insight of Latent Diffusion Models (LDM) is to run diffusion in a compressed latent space rather than pixel space. A pre-trained VAE compresses images from 512×512×3 to 64×64×4 — a 48× reduction in spatial dimension. The diffusion U-Net operates on these latents, drastically reducing computational cost:

```python
class LatentDiffusion(nn.Module):
    def __init__(self, vae, unet, text_encoder):
        super().__init__()
        self.vae = vae          # Pre-trained, frozen
        self.unet = unet        # Trained, operates on latents
        self.text_encoder = text_encoder  # CLIP, frozen

    def encode(self, image):
        # Image → latent space
        return self.vae.encode(image).sample() * 0.18215  # Scale factor

    def decode(self, latent):
        # Latent → image space
        return self.vae.decode(latent / 0.18215)

    def forward(self, latent, timestep, text_embeddings):
        # Cross-attention layers connect UNet to text embeddings
        return self.unet(latent, timestep, encoder_hidden_states=text_embeddings)
```

Text conditioning uses cross-attention layers where the U-Net's intermediate feature maps query the CLIP text encoder's output. This is where the "compositional" understanding comes from — the cross-attention maps show which words in the prompt correspond to which spatial regions in the generated image. Tools like Cross-Attention Control and Prompt-to-Prompt exploit this structure for fine-grained editing.

## Stable Diffusion: The Practical Breakthrough

Stable Diffusion made Latent Diffusion practical at consumer GPU scale. With ~860M parameters in the U-Net, it generates a 512×512 image in under 5 seconds on an 8GB VRAM GPU through weight quantization (fp16) and the latent space compression. The model was trained on LAION-5B and released as open weights in August 2022, triggering an explosion of community fine-tunes. The open release was a strategic bet by Stability AI — and it paid off massively, creating an ecosystem that no closed model could match.

## Community Ecosystem and Fine-Tuning

The open weights led to a Cambrian explosion of derived models. DreamBooth fine-tunes the model on a dozen images of a subject to generate that subject in novel contexts. LoRA (Low-Rank Adaptation) inserts tiny trainable modules into the cross-attention layers, making it possible to fine-tune a style or subject in under a minute on consumer hardware. ControlNet adds spatial conditioning (canny edges, depth maps, pose skeletons) by copying and freezing the encoder layers while training a parallel copy. IP-Adapter adds image-prompt conditioning, letting you generate images "in the style of" a reference image.

```python
# Loading a LoRA with diffusers
from diffusers import StableDiffusionPipeline
import torch

pipe = StableDiffusionPipeline.from_pretrained(
    "runwayml/stable-diffusion-v1-5",
    torch_dtype=torch.float16
).to("cuda")

# Load a fine-tuned LoRA weights
pipe.load_lora_weights("path/to/lora-weights.safetensors")

prompt = "a photo of a cat wearing a spacesuit, digital art"
image = pipe(prompt, num_inference_steps=30, guidance_scale=7.5).images[0]
```

## Advanced Sampling Methods

The sampling process has seen rapid innovation. DPM-Solver and DPM++ use numerical ODE solvers to generate high-quality images in 10-20 steps. LCM (Latent Consistency Models) distill the diffusion process into a direct mapping from noise to image in 1-4 steps. The tradeoff is visible: fast samplers lose detail and prompt alignment compared to 50-step DDIM, but for prototyping or real-time applications, the speed is transformative. Tools like SDXL Turbo push this further, aiming for truly interactive generation speeds.

## Video, 3D, and Multi-Modal Diffusion

Diffusion models are expanding beyond images. Stable Video Diffusion extends the architecture to video generation by adding temporal attention layers that connect frames across time. Zero-1-to-3 repurposes image diffusion for novel view synthesis — generate a 3D object from a single image. Sora (from OpenAI) uses a diffusion-transformer hybrid at unprecedented scale. The pattern is consistent: take the diffusion formulation, adapt the architecture to the modality, scale up compute. The results keep getting better.

## Future Directions

The field continues to evolve rapidly. Consistency models eliminate the iterative sampling entirely, mapping noise to data in a single step. Rectified flow directly learns a straight-line path from noise to data, enabling fast sampling with simpler math. Transformer-based diffusion architectures (DiT, MDT) are replacing U-Nets at large scales, with better scaling behavior. The integration of diffusion models into game engines, design tools, and video production pipelines is already happening. What started as a thermodynamic analogy has become the dominant paradigm in generative modeling, and we're only beginning to explore what it can do.
