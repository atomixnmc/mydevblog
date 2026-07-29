# Diffusion Models: From DDPM to Stable Diffusion

Diffusion models have rapidly overtaken GANs as the state of the art in image generation. The core idea is inspired by non-equilibrium thermodynamics: systematically destroy structure in data by adding noise, then learn to reverse that process.

**Denoising Diffusion Probabilistic Models (DDPM)** established the mathematical foundations. The forward process gradually adds Gaussian noise over T steps (typically 1000), turning a clean image into pure noise. The reverse process learns to denoise step by step: p_θ(x_{t-1} | x_t). Training minimizes the variational lower bound, simplified to predicting the added noise at each step. Sampling iterates from noise backward, requiring 1000 model evaluations per image—impractically slow for real-time use.

**DDIM (Denoising Diffusion Implicit Models)** addressed the speed bottleneck by reformulating the process as non-Markovian. DDIM can skip steps during sampling, generating decent images in 50-100 steps instead of 1000. The deterministic sampling path also enables latent interpolation: morph between two images by averaging their noise representations.

**Latent Diffusion Models** provided the critical architectural insight: run diffusion in a compressed latent space rather than pixel space. A pre-trained VAE compresses images to smaller latent representations (e.g., 64x64 instead of 512x512). The diffusion U-Net operates on these latents, drastically reducing computational cost. Text conditioning uses cross-attention layers connecting the U-Net to a CLIP text encoder.

**Stable Diffusion** made Latent Diffusion practical at consumer GPU scale. With ~860M parameters in the U-Net, it runs on 8GB VRAM through weight quantization and the latent space compression. The model was trained on LAION-5B and released as open weights, triggering an explosion of community fine-tunes (DreamBooth, LoRA), control methods (ControlNet, IP-Adapter), and workflow tools (ComfyUI, Automatic1111).

The trend is clear: diffusion models are moving toward faster sampling (LCM, consistency models), video generation (Stable Video Diffusion), and integration with other modalities through unified transformer architectures.
