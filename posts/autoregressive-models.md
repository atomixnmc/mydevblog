# Autoregressive Models: From GPT to PixelCNN

Autoregressive models form one of the most influential families in deep learning, generating data one token at a time conditioned on previous outputs. The core principle is deceptively simple: factorize a joint probability distribution into a product of conditional probabilities using the chain rule of probability. For a sequence x₁, x₂, ..., xₙ, the model learns P(x) = ∏ P(xₜ | x<ₜ).

**GPT and the Transformer Revolution** brought autoregressive modeling to unprecedented scale. GPT-2 (2019) demonstrated that next-token prediction on diverse internet text yields a surprisingly capable generative model. GPT-3 scaled this to 175 billion parameters, exhibiting few-shot learning without fine-tuning. The decoder-only Transformer architecture processes all previous tokens through causal self-attention, where each position can only attend to earlier positions via masked attention masks.

**On the vision side**, PixelCNN applied autoregressive generation to images, modeling pixels as a sequence from top-left to bottom-right. Each pixel is predicted based on all previously generated pixels using masked convolutions. While PixelCNN avoids the slow sequential generation of earlier approaches, it still suffers from the fundamental autoregressive bottleneck: generation is inherently O(n) steps for n tokens.

**WaveNet** brought the same idea to raw audio waveforms, producing remarkably natural speech synthesis. The key innovation was dilated convolutions, which exponentially increase the receptive field without blowing up parameters.

The fundamental tradeoff remains: autoregressive models offer tractable likelihoods and stable training through teacher forcing, but sequential generation limits inference speed. Modern approaches like speculative decoding and parallel generation aim to bridge this gap while preserving the benefits of the autoregressive framework.
