# Large Language Models: A Technical Introduction

Large Language Models (LLMs) represent a paradigm shift in natural language processing—neural networks trained on internet-scale text that can generate coherent prose, answer questions, write code, and reason about complex topics. Understanding how they work requires unpacking three key concepts: scale, architecture, and training.

I spend most of my days now building with and on top of these models through HyperGraph. Understanding their internals isn't academic—it determines whether my prompts work, my inference costs stay controlled, and my applications actually do what users expect.

## The Transformer Architecture

The Transformer architecture (Vaswani et al., 2017) is the foundation of every modern LLM. At its core is the attention mechanism, which computes weighted relationships between every pair of tokens in a sequence. Self-attention allows the model to capture long-range dependencies—a pronoun referring to a noun three paragraphs back—without the vanishing gradient problems of recurrent networks.

The scaled dot-product attention formula is:

```
Attention(Q, K, V) = softmax(QKᵀ / √dₖ)V
```

Each token produces a Query vector, a Key vector, and a Value vector. The similarity between Query and Key determines how much each token "attends" to every other token. The resulting attention weights average the Value vectors, producing an output that incorporates context from the entire sequence.

```python
import torch
import torch.nn.functional as F

def scaled_dot_product_attention(Q, K, V, mask=None):
    """
    Q: [batch, heads, seq_len, d_k] - Queries
    K: [batch, heads, seq_len, d_k] - Keys
    V: [batch, heads, seq_len, d_k] - Values
    """
    d_k = Q.size(-1)
    scores = torch.matmul(Q, K.transpose(-2, -1)) / math.sqrt(d_k)

    if mask is not None:
        scores = scores.masked_fill(mask == 0, float('-inf'))

    weights = F.softmax(scores, dim=-1)
    return torch.matmul(weights, V)
```

The "large" in LLMs comes from scaling this architecture: more layers (depth), wider hidden dimensions (width), and more attention heads (parallel attention computations). GPT-3 has 96 attention layers, a hidden dimension of 12,288, and 96 attention heads—totaling 175 billion parameters.

## The Attention Mechanism in Detail

Multi-head attention runs multiple attention operations in parallel, each learning different relationship types. One head might learn syntactic relationships (subject-verb agreement), another might learn semantic relationships (pronoun resolution), and another might learn positional relationships (token distance).

```python
class MultiHeadAttention(nn.Module):
    def __init__(self, d_model, n_heads):
        super().__init__()
        self.n_heads = n_heads
        self.d_k = d_model // n_heads

        self.W_q = nn.Linear(d_model, d_model)
        self.W_k = nn.Linear(d_model, d_model)
        self.W_v = nn.Linear(d_model, d_model)
        self.W_o = nn.Linear(d_model, d_model)

    def forward(self, x, mask=None):
        batch_size, seq_len, _ = x.shape

        # Project and reshape for multi-head
        Q = self.W_q(x).view(batch_size, seq_len, self.n_heads, self.d_k).transpose(1, 2)
        K = self.W_k(x).view(batch_size, seq_len, self.n_heads, self.d_k).transpose(1, 2)
        V = self.W_v(x).view(batch_size, seq_len, self.n_heads, self.d_k).transpose(1, 2)

        # Apply attention
        attention = scaled_dot_product_attention(Q, K, V, mask)

        # Concatenate heads and project
        attention = attention.transpose(1, 2).contiguous().view(
            batch_size, seq_len, -1
        )
        return self.W_o(attention)
```

The computational cost of self-attention is O(n²), where n is the sequence length. This quadratic scaling is the primary constraint on context length—a 32K token context requires 1000x more attention computation than a 1K token context. Sparse attention patterns (like those used in GPT-4 and Claude) reduce this to O(n * log n) by restricting which token pairs can attend.

## Training: Two Stages

Training happens in two stages, and understanding the distinction is crucial for using LLMs effectively.

**Pre-training** uses self-supervised learning on massive text corpora (Common Crawl, books, Wikipedia, GitHub) with a simple objective: predict the next token. This task forces the model to learn grammar, factual knowledge, reasoning patterns, and stylistic conventions—everything needed to predict what comes next in diverse text.

The compute requirements are staggering. Training GPT-3 cost an estimated $4-12 million in cloud compute alone. Llama 3 405B, Meta's largest model, was trained on 30,000 H100 GPUs for approximately 54 days. The energy consumption is roughly equivalent to powering 5,000 US homes for a day.

```python
# Simplified pre-training loop
for batch in dataloader:  # Each batch: millions of tokens
    logits = model(batch.input_ids)
    loss = cross_entropy(logits.view(-1, vocab_size),
                         batch.target_ids.view(-1))
    loss.backward()
    optimizer.step()
    # Gradient clipping to prevent loss spikes
    torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
```

**Fine-tuning** adapts the pre-trained model to specific tasks using smaller, curated datasets. Instruction fine-tuning teaches the model to follow directions. RLHF (Reinforcement Learning from Human Feedback) aligns the model with human preferences by training a reward model on human comparisons and then optimizing against it.

```python
# RLHF alignment loop (simplified)
# Step 1: Train reward model on human preference data
reward_model = RewardModel(pretrained_llm)
for human_preferences in dataset:
    # Humans ranked responses: response_a > response_b
    reward_a = reward_model(response_a)
    reward_b = reward_model(response_b)
    loss = -torch.log(sigmoid(reward_a - reward_b))
    loss.backward()

# Step 2: Optimize policy against reward model (PPO)
for step in range(n_steps):
    responses = policy.generate(prompts)
    rewards = reward_model(responses)
    # PPO update: maximize reward while staying close to original policy
    policy_loss = ppo_loss(policy, ref_policy, responses, rewards)
    policy_loss.backward()
    optimizer.step()
```

## Emergent Abilities

Emergent abilities appear at scale that smaller models lack entirely. These are not explicitly programmed; they emerge from the statistical patterns in training data.

**In-context learning**—performing a task from just a few examples in the prompt—emerges around the 1-10 billion parameter range. A small model must be fine-tuned for a task; a large model can learn it from examples in the prompt at inference time. This is the core capability behind few-shot prompting.

**Chain-of-thought reasoning** emerges at roughly 100B+ parameters. Given a prompt like "Let's think step by step," the model generates intermediate reasoning steps before producing the final answer. On math word problems, chain-of-thought improves accuracy from ~30% to ~80% for large models, while having little effect on small ones.

**Instruction following**—the ability to understand and execute free-form natural language instructions—requires both scale and instruction fine-tuning. Models below ~10B parameters struggle with complex instructions regardless of fine-tuning.

These emergent abilities are not continuous. They appear suddenly at specific scale thresholds, suggesting phase transitions in what the model can do. The boundary is still being mapped: new abilities continue to emerge as models grow.

## Scaling Laws

The empirical relationship between model performance and three factors—model size (parameters), data size (tokens), and compute (FLOPs)—follows predictable scaling laws. Performance improves as a power law with each factor, with diminishing returns from scaling any single factor in isolation.

Kaplan et al. (2020) found that for optimal performance, model size and training data should scale together: if you double model size, you should roughly double training data. The Chinchilla scaling law (Hoffmann et al., 2022) refined this: most large models were undertrained relative to their size. A 70B model should be trained on roughly 1.4 trillion tokens, not the 300B tokens that earlier models used.

This explains the shift from "bigger models" to "better data." Llama 3 was trained on 15 trillion tokens—an order of magnitude more than Chinchilla's recommendation. The extra data continues to improve performance, just with diminishing returns.

## Practical Deployment

Running an LLM in production requires solving three hard problems: inference cost, latency, and safety.

**Inference cost** is dominated by memory bandwidth, not computation. Generating a single token requires loading the entire model's parameters from GPU memory. For a 70B parameter model at 16-bit precision, that's 140GB of data per token. H100s have 2TB/s memory bandwidth, giving a theoretical maximum of ~14 tokens/second per GPU.

```python
# Inference throughput calculation
model_params = 70e9  # 70 billion
bytes_per_param = 2  # 16-bit precision
model_size_gb = model_params * bytes_per_param / 1e9  # 140GB
memory_bandwidth = 2e12  # 2 TB/s for H100
max_tokens_per_sec = memory_bandwidth / (model_params * bytes_per_param)
# ~14 tokens/second per GPU
```

**Quantization** reduces memory requirements. 8-bit quantization halves memory (70GB for 70B), and 4-bit quantization quarters it (35GB). The quality loss is surprisingly small—less than 5% on standard benchmarks for 4-bit quantization—making it standard practice for deployment.

**KV caching** stores attention key-value pairs from previous tokens, avoiding redundant computation. For a 32K context with a 70B model, the KV cache is roughly 2GB per concurrent request. With 32 concurrent requests, that's 64GB of GPU memory just for caches—on top of the model weights.

**Speculative decoding** uses a small draft model to generate multiple candidate tokens, then the large model verifies them in parallel. This 2-4x speedup is free in quality and is becoming standard in production inference stacks.

## Safety and Alignment

LLMs can produce harmful outputs—hate speech, instructions for dangerous activities, misinformation. Safety alignment attempts to steer outputs away from harmful content while maintaining capability.

RLHF (Reinforcement Learning from Human Feedback) is the dominant alignment technique. Human annotators compare model outputs for harmlessness, helpfulness, and honesty. A reward model learns to predict human preferences. The policy (the LLM) is then optimized to maximize the reward while staying close to its original behavior distribution (via KL divergence penalty).

```python
# PPO with KL penalty for alignment
def align_step(policy, reward_model, ref_policy, prompts):
    responses = policy.generate(prompts)
    rewards = reward_model(prompts, responses)

    # KL divergence between current and reference policy
    kl = kl_divergence(policy.log_probs(responses),
                       ref_policy.log_probs(responses))

    # PPO objective with KL penalty
    advantage = rewards - baseline
    ratio = exp(policy.log_probs(responses) - old_policy.log_probs(responses))
    clipped = clamp(ratio, 0.8, 1.2) * advantage
    policy_loss = -min(ratio * advantage, clipped) + beta * kl

    return policy_loss
```

The alignment tax is real: heavily aligned models can become "cautious to the point of uselessness," refusing legitimate requests that slightly resemble harmful ones. Finding the right balance is an active research area.

## The Road Ahead

The field continues to evolve rapidly. Mixture-of-Experts (MoE) architectures like Mixtral 8x7B achieve GPT-3-class quality with 1/5 the inference cost by activating only a subset of parameters for each token. Retrieval-Augmented Generation (RAG) grounds model outputs in external knowledge bases, reducing hallucinations. Long-context models (GPT-4 128K, Claude 200K, Gemini 1M+) are pushing past the O(n²) attention bottleneck.

The models I use today in HyperGraph would have seemed like science fiction when I started in AI. The models I'll use in two years will make today's look primitive. The rate of progress isn't a linear trend—it's an explosion, and we're all still learning how to aim it.

## Prompt Engineering and System Design

Understanding how LLMs work internally directly informs how you build applications on top of them. After a year of production experience with GPT-4, Claude, Llama, and Mixtral, here are the patterns that consistently work:

**System prompts are not optional.** Every deployed LLM needs a system prompt that defines its role, constraints, and output format. Without one, the model defaults to generic helpfulness, which is rarely what you want in production.

```python
# A production system prompt for a code review assistant
SYSTEM_PROMPT = """You are a senior code reviewer with expertise in Python, TypeScript, and Rust.

Rules:
- Review for correctness, performance, and maintainability, in that order.
- Ignore style nits (formatting, naming) unless they affect readability.
- Flag security vulnerabilities immediately with CVE references.
- Provide a confidence score (HIGH/MEDIUM/LOW) for each finding.
- If you cannot reproduce a logic error, say "COULD NOT VERIFY" rather than guessing.

Output format:
{
  "verdict": "APPROVED" | "CHANGES_REQUESTED",
  "findings": [
    {
      "severity": "CRITICAL" | "MAJOR" | "MINOR",
      "line": integer,
      "description": string,
      "suggestion": string
    }
  ]
}
"""
```

**Structured output via JSON mode.** Most API providers support JSON mode (forced JSON parsing of the output), which eliminates the need to parse natural language responses. Combined with a well-designed system prompt schema, JSON mode makes LLMs reliable enough for automated pipelines.

**Few-shot examples beat instructions.** For complex tasks, 3-5 examples in the prompt consistently outperform detailed instructions. The examples should show edge cases and failure modes, not just happy paths.

**Temperature control.** For any task where correctness matters (code generation, data extraction, classification), use temperature=0.0. The deterministic output eliminates the "it worked yesterday but not today" problem. Reserve higher temperatures for creative tasks (content generation, brainstorming).

```python
# Temperature selection guide
def select_temperature(task_type):
    if task_type in ['extraction', 'classification', 'code_gen', 'qa']:
        return 0.0  # Deterministic: same input = same output
    elif task_type in ['summarization', 'rewriting']:
        return 0.3  # Low creativity: preserves meaning
    elif task_type in ['brainstorming', 'creative_writing']:
        return 0.8  # High creativity: explores possibilities
    else:
        return 0.5  # Default: balanced
```

## The Inference Stack: What I Run in Production

HyperGraph's inference stack has evolved through three iterations. Here's the current setup, optimized for cost and latency:

- **Model**: Mixtral 8x22B (141B MoE, ~39B active params per token). Comparable quality to Llama 3 70B at 1/3 the serving cost.
- **Inference engine**: vLLM with continuous batching, prefix caching, and PagedAttention.
- **Hardware**: 2x A100 80GB, PCIe (not NVLink). The MoE architecture means less inter-GPU communication than dense models.
- **Quantization**: FP8 (native on H100) or AWQ 4-bit (on A100). Quality loss < 1%.
- **KV cache**: 32K tokens per sequence, dynamic memory allocation via PagedAttention.
- **Routing**: Self-hosted for primary workload, OpenAI fallback for overflow.

This stack serves approximately 500K tokens per day at a cost of $0.30/K tokens—about 1/10 of OpenAI's API pricing. The tradeoff is operational overhead and occasional outages, but the cost savings justify it at our volume.

## The Safety Question

No technical introduction to LLMs is complete without addressing safety. These models are capable tools that can also generate misinformation, biased content, harmful instructions, and private data leakage.

**Input safety** (prompt injection) is the attack vector most relevant to application developers. Malicious users craft prompts that override system instructions, extract system prompts, or coerce the model into ignoring safety filters. Mitigations include input sanitization, output classification, and maintaining a separate "judge" model that evaluates responses before they reach users.

**Output safety** (harmful content) is addressed by alignment techniques (RLHF, constitutional AI) but no alignment is perfect. Production systems need an output safety layer that classifies responses before delivery. I use a small classifier model (DeBERTa-v3, fine-tuned on toxicity and PII detection) as a filter on all LLM outputs. It adds 2ms latency and catches about 95% of problematic outputs.

## Where We're Headed

The pace of progress in LLMs is unlike anything I've experienced in 20 years of software engineering. The models I deploy today will be obsolete in 6 months. The architectures I use (Transformer, MoE, RLHF) will be replaced by something new within 2 years.

What won't change: the fundamental capability of language models to understand and generate human-like text. The applications we're building today—code assistants, knowledge management systems, automated writing tools—will only become more capable. The challenge is building on top of models that keep getting better, without getting locked into today's limitations.

That's what HyperGraph is designed for: not to compete with LLMs, but to give them structure—a knowledge graph that grounds their outputs in verified facts, a query system that lets them access data beyond their training cutoff, and an architecture that makes them reliable enough for production use.

The models are the engine. The graph is the infrastructure. Together, they're building the future of how we interact with information.
