# Prompt Engineering: Getting the Most from LLMs

Prompt engineering is the discipline of crafting inputs to large language models to produce desired outputs reliably. As LLMs become more capable, the skill of communicating intent precisely has become a valuable technical competency.

**The anatomy of a good prompt**: Effective prompts combine three elements—instruction, context, and output format. The instruction states the task explicitly: "Summarize the following article in three bullet points." Context provides relevant background: "The audience is CTOs evaluating cloud providers." Output format constrains structure: "Return valid JSON with keys: summary, key_insights, risks." Together, they reduce the model's search space for acceptable responses.

**Few-shot prompting** provides examples of desired input-output pairs in the prompt. For sentiment classification, include "Review: 'This product is amazing' → Sentiment: Positive" as a template. Research shows that 3-5 diverse examples outperform large numbers of similar examples. The examples should span the difficulty distribution—include edge cases (neutral, mixed, ambiguous) to calibrate the model's boundaries.

**Chain-of-thought prompting** elicits reasoning before the final answer. "Let's think step by step" appended to a math problem improves accuracy from ~30% to ~70% on arithmetic benchmarks. More structured variants include "First, identify the variables. Second, write the equation. Third, solve." The reasoning trace also provides interpretability—you can see where the model's logic diverges and refine the prompt accordingly.

**Role prompting** sets persona: "You are a senior software engineer reviewing code for security vulnerabilities." The persona activates knowledge distributions learned during training, biasing the model toward relevant expertise. Role prompts are most effective when the role is specific and credible: "senior security engineer at a fintech company" outperforms "security expert."

**System prompts** (in API-based models) set persistent instructions that apply to the entire conversation. Use system prompts for safety guardrails, output formatting rules, and persona definitions. User prompts change per request. System instructions about tone, expertise level, and constraints remove repetition from user prompts.

**Iterative refinement** is the practical workflow. Start with a minimal prompt, evaluate output, add constraints that address failures, and repeat. Version control prompts as code—changes that improve one use case often degrade another. Systematic evaluation with held-out test cases separates actual improvement from perceived improvement.
