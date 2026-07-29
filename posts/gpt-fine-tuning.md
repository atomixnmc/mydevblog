# GPT Fine-Tuning: Making Foundation Models Your Own

Fine-tuning adapts a pre-trained GPT model to specialized tasks or domains by continuing training on curated data. While base GPT models are generalists, fine-tuning produces specialists—whether for legal document analysis, medical coding, customer support, or code generation for a specific framework.

**The fine-tuning process** starts with a pre-trained checkpoint (GPT-3, GPT-4, or open-source alternatives like LLaMA and Mistral). The model's weights already encode general language understanding from internet-scale pretraining. Fine-tuning overwrites some of these weights using a smaller, domain-specific dataset. The standard approach is supervised fine-tuning (SFT): pairs of prompts and ideal completions, trained with the same causal language modeling objective as pretraining—minimizing cross-entropy loss on the target tokens.

**Dataset quality trumps quantity** in fine-tuning. A clean dataset of 1,000 high-quality examples often outperforms 100,000 noisy ones. Key curation strategies: ensure coverage of edge cases, remove duplicate prompts, validate that completions are factually correct, and balance the distribution of difficulty levels. For domain adaptation (e.g., medical GPT), include a mix of raw domain text (for continued pretraining) and instruction-response pairs (for task performance).

**Parameter-efficient fine-tuning (PEFT)** methods reduce the cost dramatically. LoRA (Low-Rank Adaptation) freezes the original weights and inserts trainable rank-decomposition matrices into attention layers. Training updates only ~0.1-1% of the total parameters, reducing VRAM requirements from multiple GPUs to a single consumer card. QLoRA adds 4-bit quantization, further cutting memory. The tradeoff is debated: LoRA-fine-tuned models sometimes lag full fine-tuning on complex reasoning tasks.

**Evaluation** requires careful design since loss isn't sufficient. Build a held-out evaluation set separated by domain, difficulty, and task type. Use both automated metrics (accuracy for classification, exact match for extraction, BLEU/ROUGE for generation) and human evaluation for subjective quality. Monitor for catastrophic forgetting—the model losing general capabilities as it specializes.

**Cost considerations**: Full fine-tuning of a 7B model costs ~$50-200 in compute; a 70B model runs $500-2000+. LoRA reduces this 10-100x. OpenAI's fine-tuning API handles infrastructure but requires sending data to their servers and paying per-token for inference.
