# Transformer Attention: QKV Deconstructed

The Transformer attention mechanism, introduced in "Attention Is All You Need," is the architectural innovation behind modern LLMs. At its heart is the scaled dot-product attention operating on Query, Key, and Value vectors.

**The core equation**: Attention(Q, K, V) = softmax(QK^T / √d_k) V. Queries represent what the current token is looking for. Keys represent what each token in the sequence offers. The dot product QK^T computes compatibility scores between every pair of tokens—how relevant is each token to the current position. Scaling by √d_k (the key dimension) prevents softmax gradients from vanishing as d_k grows. The softmax turns scores into a probability distribution, and the weighted sum of Values produces the attention output.

**Multi-head attention** runs this computation in parallel across H heads, each with its own learned projections W_Q, W_K, W_V. Different heads learn different relationship types: one head might focus on syntactic dependencies (subject-verb agreement), another on positional proximity, another on semantic similarity. The outputs are concatenated and projected through W_O. With 8-96 heads in modern models, the representation captures a rich set of token relationships.

**Causal masking** enforces autoregressive generation. For decoder-only transformers, the QK^T matrix is masked before softmax: positions are prevented from attending to future positions by setting those logits to -∞ (resulting in zero attention weight). This ensures token t only depends on tokens 1 through t-1, matching the next-token prediction training objective.

**Positional encoding** provides sequence order information since attention is permutation-invariant without it. The original paper used sinusoidal encodings of varying frequencies. Modern models like GPT and LLaMA use rotary positional embeddings (RoPE), which rotate the Q and K vectors by angle θ_i = base^{-2i/d} * position, encoding relative position through rotation rather than additive bias.

**Efficient attention** variants reduce the O(n²) memory complexity. FlashAttention computes attention in tiles without materializing the full QK^T matrix, achieving 2-4x speedup on GPUs. Sparse attention patterns (sliding window, dilated) approximate full attention for very long sequences. Multi-Query Attention shares KV heads across query heads, reducing KV cache memory for inference.

Understanding QKV is understanding the Transformer. Everything else—layers, normalization, feed-forward networks—is infrastructure around this core mechanism.
