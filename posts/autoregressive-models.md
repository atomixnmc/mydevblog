# Autoregressive Models: From GPT to PixelCNN

Autoregressive models form one of the most influential families in deep learning, generating data one token at a time conditioned on previous outputs. The core principle is deceptively simple: factorize a joint probability distribution into a product of conditional probabilities using the chain rule of probability. For a sequence x₁, x₂, ..., xₙ, the model learns P(x) = ∏ P(xₜ | x<ₜ).

This framing turns the impossibly hard problem of modeling a high-dimensional joint distribution into a tractable sequence of next-step predictions. The price you pay is sequential generation: every token depends on every token before it, making parallel generation impossible without approximation.

## The Chain Rule in Practice

The chain rule of probability is the mathematical backbone. For any sequence of random variables, the joint probability decomposes as:

```
P(x₁, x₂, ..., xₙ) = P(x₁) × P(x₂|x₁) × P(x₃|x₁, x₂) × ... × P(xₙ|x₁, ..., xₙ₋₁)
```

An autoregressive model learns each conditional term. During training, the model sees the ground-truth previous tokens (a technique called teacher forcing) and predicts the next one. The loss is typically cross-entropy between the predicted distribution over tokens and the actual next token.

```python
# Simplified autoregressive training loop
import torch
import torch.nn as nn

class AutoregressiveModel(nn.Module):
    def __init__(self, vocab_size, d_model=512, n_layers=6):
        super().__init__()
        self.embedding = nn.Embedding(vocab_size, d_model)
        self.layers = nn.TransformerDecoderLayer(d_model, nhead=8, batch_first=True)
        self.decoder = nn.TransformerDecoder(self.layers, num_layers=n_layers)
        self.output_proj = nn.Linear(d_model, vocab_size)

    def forward(self, x, mask=None):
        # x: [batch, seq_len]
        x = self.embedding(x)  # [batch, seq_len, d_model]
        # Causal mask prevents attending to future tokens
        if mask is None:
            mask = nn.Transformer.generate_square_subsequent_mask(x.size(1))
        x = self.decoder(x, memory=None, tgt_mask=mask)
        logits = self.output_proj(x)  # [batch, seq_len, vocab_size]
        return logits

# Training step
model = AutoregressiveModel(vocab_size=50000)
optimizer = torch.optim.AdamW(model.parameters(), lr=3e-4)
criterion = nn.CrossEntropyLoss()

for batch in dataloader:
    # batch.input_ids: [batch, seq_len]
    logits = model(batch.input_ids[:, :-1])  # predict next token from context
    loss = criterion(
        logits.reshape(-1, 50000),
        batch.input_ids[:, 1:].reshape(-1)   # shift by 1 for teacher forcing
    )
    loss.backward()
    optimizer.step()
```

The causal mask in the transformer decoder ensures position t can only attend to positions < t. This masking is what makes the model autoregressive—without it, each token would see its own future, and the model would learn nothing.

## GPT and the Transformer Revolution

The GPT family brought autoregressive modeling to unprecedented scale. GPT-2 (2019), with 1.5 billion parameters, demonstrated that next-token prediction on diverse internet text yields a surprisingly capable generative model without task-specific training. The paper's title—"Language Models are Unsupervised Multitask Learners"—captured the key insight: by predicting the next word across enough data, the model implicitly learns translation, summarization, question answering, and reasoning.

GPT-3 (2020) scaled this to 175 billion parameters and introduced the concept of in-context learning: by providing a few examples in the prompt, the model could perform tasks it was never explicitly trained on. This was the moment the field realized that scale alone could produce emergent capabilities.

The decoder-only Transformer architecture used by GPT models differs from the encoder-decoder architecture of the original Transformer (Vaswani et al., 2017). The key architectural decisions:

- **Causal self-attention** — Each position can only attend to earlier positions. Implemented via an upper-triangular mask in the attention computation.
- **Layer normalization placement** — GPT uses pre-norm (LayerNorm before the sublayer) rather than post-norm, which stabilizes training at scale.
- **Learned position embeddings** — Rather than sinusoidal embeddings, GPT learns position embeddings during training.
- **No cross-attention** — Unlike encoder-decoder models, decoder-only models have no separate encoder; they process a single sequence.

```python
# Causal self-attention simplified
def causal_attention(Q, K, V, mask=None):
    # Q, K, V: [batch, heads, seq_len, d_k]
    scores = torch.matmul(Q, K.transpose(-2, -1)) / math.sqrt(d_k)

    if mask is None:
        # Upper triangular mask: positions can't attend to future
        seq_len = Q.size(-2)
        mask = torch.triu(torch.ones(seq_len, seq_len, device=Q.device), diagonal=1).bool()
        scores = scores.masked_fill(mask.unsqueeze(0).unsqueeze(0), float('-inf'))

    weights = torch.softmax(scores, dim=-1)
    return torch.matmul(weights, V)
```

At inference time, autoregressive generation requires a loop: predict token t+1, append it to the sequence, and re-run the model. This is O(n²) in the sequence length due to the attention computation—every new token attends to all previous tokens.

## KV Caching: Making Inference Fast

The naive autoregressive loop recomputes attention for all previous tokens at every step. This is wasteful: the key and value vectors for token positions 1 through t don't change when predicting token t+1. KV caching stores these vectors and reuses them.

```python
# KV-cached generation
class CachedAutoregressiveModel(nn.Module):
    def __init__(self, model):
        super().__init__()
        self.model = model
        self.kv_cache = {}  # layer_idx -> (K, V)

    @torch.no_grad()
    def generate(self, input_ids, max_new_tokens=100):
        self.kv_cache = {}
        for _ in range(max_new_tokens):
            # Only compute attention for the latest token
            # Previous KVs are cached
            logits = self.model(input_ids[:, -1:], past_key_values=self.kv_cache)
            next_token = logits[:, -1, :].argmax(dim=-1, keepdim=True)
            input_ids = torch.cat([input_ids, next_token], dim=-1)
        return input_ids
```

With KV caching, the computational cost per token drops from O(t * d) to O(d)—the sequence length no longer grows the per-step cost. This is why large language models can generate hundreds of tokens while maintaining acceptable per-token latency.

## Autoregressive Models for Images: PixelCNN

The same principle applies to images, but the "sequence" is across pixels. PixelCNN (van den Oord et al., 2016) models the joint distribution over pixels as a product of conditional distributions, each conditioned on all previously generated pixels. The generation order is raster scan: top-left to bottom-right, row by row.

```python
# Simplified PixelCNN masked convolution
class MaskedConv2d(nn.Conv2d):
    def __init__(self, mask_type, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.mask_type = mask_type  # 'A' or 'B'
        self.register_buffer('mask', self.weight.data.clone())
        _, _, h, w = self.weight.size()
        self.mask.fill_(1)
        # Zero out future pixels
        if mask_type == 'A':
            self.mask[:, :, h//2, w//2:] = 0  # Current pixel future in same row
        self.mask[:, :, h//2+1:, :] = 0  # Future rows
        self.mask[:, :, h//2, w//2+1:] = 0  # Current pixel same row future
```

The trick is masked convolutions: the convolution kernel is masked so each pixel can only see pixels above and to the left (or, for RGB, the previously generated channels). Mask-A blocks block the current pixel entirely; Mask-B blocks allow the current pixel to condition on its own previously generated channels.

PixelCNNs were state-of-the-art for image generation in 2016-2017, producing sharp samples on CIFAR-10 and ImageNet. The fundamental limitation was generation speed: a 256x256 image requires 65,536 sequential steps. At 10ms per step, that's over 10 minutes per image.

## WaveNet: Autoregressive Audio Synthesis

WaveNet (DeepMind, 2016) brought autoregressive modeling to raw audio waveforms at 16kHz sampling rate. The key innovation was dilated convolutions, which increase the receptive field exponentially without the quadratic cost of attention:

```
Layer 1: dilation = 1,  receptive field = 2
Layer 2: dilation = 2,  receptive field = 4
Layer 3: dilation = 4,  receptive field = 8
...
Layer N: dilation = 2ⁿ⁻¹, receptive field = 2ⁿ
```

With 10 layers of exponentially dilating convolutions, the receptive field covers 1024 samples—about 64ms of audio at 16kHz. Stacking these blocks achieves receptive fields of several seconds.

WaveNet produced remarkably natural speech synthesis, often indistinguishable from human recordings in blind tests. Google deployed it as Google Assistant's voice. But the generation speed was a practical limitation: generating one second of audio at 16kHz required 16,000 sequential neural network evaluations.

## The Tradeoffs

Autoregressive models have a clean theoretical foundation and a clear deployment path. Here's the full tradeoff matrix:

**Advantages:**
- **Tractable likelihoods** — The exact log-likelihood of a data point is computable, unlike GANs or VAEs.
- **Stable training** — Teacher forcing means no adversarial training, no saddle points, no mode collapse.
- **Simple objective** — Cross-entropy loss, well-understood and optimized to death.
- **Strong scaling** — The objective correlates well with downstream quality; more data and parameters reliably improve results.

**Disadvantages:**
- **Sequential generation** — O(n) sequential steps for n tokens. No amount of hardware parallelism can change this fundamental constraint.
- **Exposure bias** — During training, the model sees ground-truth context. During generation, it sees its own predictions. Distribution shift accumulates over long sequences.
- **No latent structure** — Every token is generated directly; there's no learned latent space like VAEs or diffusion models.

## Modern Advances

The field has developed strategies to overcome the sequential bottleneck:

**Speculative decoding** uses a smaller, faster draft model to propose multiple tokens, then the large model verifies them in parallel. For typical text, a single verification step can accept 3-5 draft tokens, effectively multiplying generation speed by 3-5x without quality loss.

```python
# Pseudocode for speculative decoding
def speculative_decode( draft_model, target_model, prefix, gamma=4):
    # Draft model proposes gamma tokens
    draft_tokens = draft_model.generate(prefix, max_new_tokens=gamma)
    # Target model verifies all at once
    target_logits = target_model(prefix + draft_tokens)
    # Rejection sampling: accept tokens where target agrees with draft
    accepted = []
    for i, draft_token in enumerate(draft_tokens):
        if random() < min(1, target_logits[i] / draft_logits[i]):
            accepted.append(draft_token)
        else:
            # Sample from target distribution as fallback
            accepted.append(sample(target_logits[i]))
            break
    return accepted
```

**Parallel decoding** approaches like Medusa add multiple prediction heads to generate several tokens per step. Each head predicts a token at a different offset, and tree-based attention enables the model to consider multiple candidate continuations simultaneously.

**Non-autoregressive models** (NAR) discard the sequential constraint entirely, generating all tokens in parallel. Masked language models like BERT and diffusion models like DALL-E 3 and Stable Diffusion achieve this by iterative refinement rather than left-to-right generation. The tradeoff: NAR models typically lag behind AR models in generation quality, especially for long-range coherence.

## The Autoregressive Future

Large language models have cemented autoregressive generation as the dominant paradigm for text. The combination of the Transformer architecture, massive scale, and the simple next-token prediction objective produces systems that exhibit remarkable intelligence.

For images and audio, autoregressive models have been mostly superseded by diffusion models, which offer better quality-per-compute for high-dimensional continuous data. But even diffusion models often use discrete autoregressive components—DALL-E 3 uses a text encoder built on autoregressive language models, and audio diffusion systems frequently condition on autoregressive text models.

The autoregressive framework persists because it solves the fundamental problem of generative modeling—how to assign probability to complex structured data—in a way that is simple, scalable, and well-understood. Every token generated is informed by everything that came before, and that gives autoregressive models a quality of coherence that other approaches struggle to match.

## Training Instability at Scale

Autoregressive models have a well-deserved reputation for training stability compared to GANs, but at scale they exhibit failure modes that require careful management.

**Loss spikes** are the most common issue. After hundreds of billions of tokens of seemingly stable training, the loss will suddenly spike by 10-100x, potentially destroying hours of progress. These spikes are poorly understood but correlate with:
- Rare token combinations that push activations into extreme regimes.
- Gradient accumulation errors at very large batch sizes (4M+ tokens per batch).
- Numerical precision issues in the softmax operation when logits are very large.

The standard mitigation is gradient clipping with a conservative threshold (max_norm=1.0) and activation checkpointing. Some training runs use automatic loss spike detection with rollback: if the loss exceeds a threshold, the optimizer reverts to the previous checkpoint and reduces the learning rate.

```python
# Loss spike detection and rollback
class SpikeAwareTrainer:
    def __init__(self, model, optimizer, spike_threshold=5.0):
        self.model = model
        self.optimizer = optimizer
        self.threshold = spike_threshold
        self.rolling_loss = deque(maxlen=100)
        self.checkpoint_dir = Path("checkpoints")

    def train_step(self, batch):
        logits = self.model(batch.input_ids)
        loss = cross_entropy(logits, batch.target_ids)
        self.rolling_loss.append(loss.item())

        if len(self.rolling_loss) > 10:
            median_loss = np.median(self.rolling_loss)
            if loss.item() > median_loss * self.threshold:
                # Spike detected! Roll back
                print(f"Spike detected: {loss.item():.2f} vs median {median_loss:.2f}")
                self._restore_last_checkpoint()
                self.optimizer.param_groups[0]['lr'] *= 0.5
                return loss.item()

        loss.backward()
        torch.nn.utils.clip_grad_norm_(self.model.parameters(), 1.0)
        self.optimizer.step()
        self.optimizer.zero_grad()
        return loss.item()
```

**Gradient vanishing and exploding** are less severe in transformers than in RNNs, but they still occur, especially in very deep models (80+ layers). Pre-layer normalization and residual scaling (dividing residual connections by sqrt(depth)) help, but the problem doesn't fully disappear.

## The Economics of Autoregressive Inference

For anyone deploying autoregressive models in production, understanding the economics is critical. The cost structure is dominated by the sequential generation constraint.

**Memory bandwidth is the bottleneck.** A 70B parameter model at 16-bit requires reading 140GB from GPU memory for each token generated. H100 has 2TB/s memory bandwidth, giving a theoretical maximum of ~14 tokens/s. In practice, with KV cache management and attention computation overhead, you get 8-12 tokens/s for a single sequence.

**Batching improves throughput but not latency.** Processing 16 sequences in parallel uses the same model weights (read once, broadcast) but requires the KV cache to fit each sequence's context. The throughput scales almost linearly with batch size until you hit memory limits.

```python
# Estimating inference throughput
def throughput_estimate(model_size_b, precision_bits, mem_bw_gbs, batch_size, avg_output_tokens):
    """Tokens per second for autoregressive inference"""
    weights_bytes = model_size_b * precision_bits / 8 / 1e9
    kv_bytes_per_seq = model_size_b * 0.1  # rough estimate for 32K context

    memory_per_step = weights_bytes + kv_bytes_per_seq * batch_size
    memory_reads_per_sec = mem_bw_gbs / memory_per_step

    tokens_per_sec = memory_reads_per_sec * batch_size
    latency_per_token = 1 / memory_reads_per_sec * 1000  # ms

    return {
        'tokens_per_sec': tokens_per_sec,
        'latency_per_token_ms': latency_per_token,
        'memory_per_step_gb': memory_per_step
    }

# H100 + 70B model at 16-bit
est = throughput_estimate(70, 16, 2000, 1, 32768)
print(f"{est['tokens_per_sec']:.0f} tokens/s, {est['latency_per_token_ms']:.0f}ms per token")
# ~13 tokens/s, ~75ms per token
```

**Speculative decoding changes the economics significantly.** With a 7B draft model proposing 4 tokens per step and the 70B target model verifying them in parallel, effective throughput jumps to ~40-50 tokens/s. The cost is double the VRAM (both models must be loaded), but the throughput improvement justifies it for latency-sensitive applications.

## The Road Ahead for Autoregressive Models

Several promising directions are pushing past the fundamental limitations:

**Linear attention** replaces the O(n²) self-attention with O(n) alternatives like Mamba (state-space models) or linear attention variants. Mamba-2 achieves GPT-3-class quality on language tasks while supporting unlimited context lengths and faster generation. The tradeoff is that linear attention models currently lag behind transformers on recall-intensive tasks like long-context question answering.

**Multi-token prediction** modifies the training objective to predict multiple future tokens simultaneously. DeepMind's work shows that predicting the next 2-4 tokens (not just the next 1) improves model quality and inference efficiency. The model learns richer representations because it must plan further ahead.

**Jointed autoregressive-diffusion models** combine the strengths of both approaches. The autoregressive component handles discrete tokens (text), while the diffusion component handles continuous data (images, audio). This hybrid approach powers models that generate mixed-modal outputs without sacrificing quality in any modality.

Despite these innovations, the core autoregressive insight remains: sequential generation conditioned on history is a powerful inductive bias that matches how humans produce and consume information. We read left to right, speak word by word, and compose music note by note. Autoregressive models capture this temporality in a way that parallel generation approaches struggle to replicate.

The framework will continue to evolve, but the chain rule isn't going anywhere.
