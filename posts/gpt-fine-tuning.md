# GPT Fine-Tuning: Making Foundation Models Your Own

Fine-tuning adapts a pre-trained GPT model to specialized tasks or domains by continuing training on curated data. While base GPT models are generalists, fine-tuning produces specialists — whether for legal document analysis, medical coding, customer support, or code generation for a specific framework. I've fine-tuned models for everything from generating unit tests for legacy codebases to summarizing clinical trial reports, and the gap between a base model and a well-tuned specialist is night and day. A base GPT-4 can write competent Python; a fine-tuned CodeLlama on your specific codebase generates code that follows your project's patterns, naming conventions, and error-handling idioms from the first line.

## The Fine-Tuning Pipeline

The process starts with a pre-trained checkpoint (GPT-3, GPT-4, or open-source alternatives like LLaMA, Mistral, or Qwen). The model's weights already encode general language understanding from internet-scale pretraining. Fine-tuning overwrites some of these weights using a smaller, domain-specific dataset. The standard approach is supervised fine-tuning (SFT): pairs of prompts and ideal completions, trained with the same causal language modeling objective as pretraining — minimizing cross-entropy loss on the target tokens.

```python
from transformers import AutoModelForCausalLM, AutoTokenizer, Trainer, TrainingArguments

model = AutoModelForCausalLM.from_pretrained("mistralai/Mistral-7B-v0.1")
tokenizer = AutoTokenizer.from_pretrained("mistralai/Mistral-7B-v0.1")
tokenizer.pad_token = tokenizer.eos_token

def format_example(prompt, completion):
    """Format a training example with conversational structure."""
    return f"### Instruction\n{prompt}\n\n### Response\n{completion}{tokenizer.eos_token}"

training_args = TrainingArguments(
    output_dir="./mistral-finetuned",
    per_device_train_batch_size=4,
    gradient_accumulation_steps=8,  # Effective batch size = 32
    learning_rate=2e-5,
    warmup_ratio=0.03,
    num_train_epochs=3,
    logging_steps=10,
    save_strategy="epoch",
    fp16=True,
    report_to="wandb"
)

trainer = Trainer(
    model=model,
    args=training_args,
    train_dataset=train_dataset,
    data_collator=DataCollatorForSeq2Seq(tokenizer, padding=True)
)
trainer.train()
```

## Dataset Quality Trumps Quantity

This is the single most important lesson in fine-tuning: a clean dataset of 1,000 high-quality examples often outperforms 100,000 noisy ones. I learned this the hard way when my first fine-tune on 50K web-scraped support conversations produced a model that was worse than the base — it had memorized the noise patterns from bad responses. After cleaning down to 2,000 curated examples with verified correct answers, the model was dramatically better.

```python
def curate_dataset(raw_examples):
    """Filter and deduplicate training examples."""
    seen = set()
    curated = []

    for ex in raw_examples:
        # Remove near-duplicate instructions
        instruction_hash = hash(ex["instruction"].strip().lower())
        if instruction_hash in seen:
            continue
        seen.add(instruction_hash)

        # Filter low-quality examples
        if len(ex["completion"]) < 20:
            continue  # Too short, likely incomplete
        if ex.get("score", 5) < 4:
            continue  # Human-rated as low quality

        curated.append(ex)

    return curated
```

Key curation strategies: ensure coverage of edge cases, remove duplicate prompts, validate completions are factually correct, and balance difficulty levels. For domain adaptation (e.g., medical GPT), include a mix of raw domain text (for continued pretraining) and instruction-response pairs (for task performance).

## Parameter-Efficient Fine-Tuning (PEFT)

Full fine-tuning of a 7B parameter model requires ~56GB of VRAM (2x the model size for optimizer states). PEFT methods reduce this dramatically. LoRA (Low-Rank Adaptation) freezes the original weights and inserts trainable rank-decomposition matrices into attention layers:

```python
from peft import LoraConfig, get_peft_model, TaskType

lora_config = LoraConfig(
    r=16,  # Rank — controls expressiveness vs efficiency
    lora_alpha=32,
    target_modules=["q_proj", "v_proj", "k_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
    lora_dropout=0.05,
    bias="none",
    task_type=TaskType.CAUSAL_LM
)

model = get_peft_model(model, lora_config)
model.print_trainable_parameters()  # ~0.2% of parameters trainable
```

Training updates only ~0.1-1% of the total parameters, reducing VRAM requirements from multiple GPUs to a single consumer card. QLoRA adds 4-bit (NF4) quantization of the base model, further cutting memory to ~10GB for a 7B model. The tradeoff is debated: LoRA models sometimes lag full fine-tuning on complex reasoning tasks like math and code generation. My experience is that LoRA works well for style adaptation, formatting changes, and domain-specific vocabulary, but falls short when the task requires learning new reasoning patterns.

## Instruction Tuning and Chat Formatting

The format of your training data matters enormously. Models fine-tuned with consistent chat formatting are dramatically more controllable than those trained on raw text:

```python
def format_chat_example(messages):
    """Format messages for chat-tuned models like LLaMA-3."""
    formatted = ""
    for msg in messages:
        role = msg["role"].upper()
        formatted += f"<|{role}|>\n{msg['content']}\n"
    formatted += "<|ASSISTANT|>\n"
    return formatted
```

The Alpaca, Vicuna, and OpenAssistant datasets established patterns for instruction tuning, but the field has moved to "chat" format where multi-turn conversation is the default. The key is consistency: the tokenizer needs to see the exact same formatting patterns during inference as during training.

## Training Recipes and Hyperparameters

The learning rate for fine-tuning is typically 1e-5 to 5e-5 — much lower than pretraining, since the model already has good weights and we want to avoid catastrophic forgetting. The cosine schedule with warmup is standard: warm up from 0 to the target LR over 3-5% of steps, then decay to 10% of the peak LR. Weight decay of 0.1 prevents overfitting on small datasets. For batch size, effective batch sizes of 32-128 work well — use gradient accumulation to reach this on modest hardware. Training for more than 3-5 epochs on small datasets leads to overfitting; monitor validation loss and stop when it diverges from training loss.

## Evaluation Beyond Loss

Loss isn't sufficient for evaluating a fine-tuned model. Build a held-out evaluation set separated by domain, difficulty, and task type:

```python
def evaluate_model(model, tokenizer, eval_examples):
    results = {"exact_match": [], "bleu": [], "human_score": []}

    for ex in eval_examples:
        prompt = ex["instruction"]
        expected = ex["completion"]

        output = generate(model, tokenizer, prompt, max_length=512)

        # Automated metrics
        results["exact_match"].append(1 if output.strip() == expected.strip() else 0)
        results["bleu"].append(compute_bleu(output, expected))

    return {k: np.mean(v) for k, v in results.items()}
```

Monitor for catastrophic forgetting — the model losing general capabilities as it specializes. A common pattern is to evaluate on a general benchmark (MMLU, HellaSwag) before and after fine-tuning. If general performance drops more than 5%, you're either overtuning or the dataset distribution is too narrow.

## Deployment Considerations

Fine-tuned models need thoughtful deployment. Quantization (AWQ, GPTQ) reduces model size 2-4x with minimal quality loss. vLLM provides PagedAttention for efficient serving, supporting LoRA adapters as add-ons to a base model. For production, I recommend serving the base model with hot-swappable LoRA adapters rather than multiple full copies — one vLLM instance can serve dozens of fine-tuned LoRAs with minimal overhead.

```python
# vLLM with LoRA adapter serving
from vllm import LLM, SamplingParams

llm = LLM(model="mistralai/Mistral-7B-v0.1")
# Load LoRA adapter at request time
outputs = llm.generate(
    prompts,
    sampling_params,
    lora_request=LoRARequest("my-domain-model", 1, "./lora-weights")
)
```

## Cost-Benefit Analysis

Full fine-tuning of a 7B model costs ~$50-200 in compute on a single A100 or rented RTX 4090. A 70B model runs $500-2000+. LoRA reduces this 10-100x, often below $10 for a 7B model. OpenAI's fine-tuning API handles infrastructure but requires sending data to their servers and paying per-token for inference at higher rates than base models. The open-source route gives you data privacy, no per-token markup, and full control — but you own the infrastructure cost and maintenance burden.

For most teams, my recommendation is: start with few-shot prompting on a capable base model, move to RAG (Retrieval-Augmented Generation) if you need domain knowledge, and only fine-tune when you need consistent formatting, style, or behavior that few-shot can't enforce. Fine-tuning is powerful but expensive to maintain — each base model update requires re-tuning, and you need ongoing evaluation to catch quality regressions.
