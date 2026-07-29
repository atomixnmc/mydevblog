# Model Taste vs. Benchmarks: Why I Don't Trust Leaderboards

Benchmarks say "this model is best." I say "this model is boring."

The AI model landscape has a fundamental problem: everyone optimizes for metrics that don't match what creators actually want. FID scores, CLIP alignment, and human preference ratings from Mechanical Turk workers tell you which model generates the most "accurate" images. They don't tell you which model generates images you'd actually want to hang on your wall.

I've spent hundreds of hours scrolling through model outputs on Replicate, Civitai, and Hugging Face, and I've developed strong opinions about what makes a model worth using.

**What Benchmarks Miss**

The community fine-tunes on Civitai consistently beat the base models in subjective quality, even when their benchmark scores are worse. A LoRA trained on 50 curated images of a specific art style will produce more visually appealing results than SDXL at its base configuration—even though the base model scores higher on CLIP alignment.

```
Subjective Quality vs. Benchmarks (My Ratings):
Model                        | FID ↓ |CLIP ↑| My Score (1-10)
─────────────────────────────|───────|──────|────────────────
SDXL Base                    | 23.4  | 0.32 | 6
SDXL + RealVision LoRA       | 27.1  | 0.30 | 8
FLUX.1-dev Base              | 18.2  | 0.35 | 7
FLUX + Artistic Illustration | 22.0  | 0.33 | 9
Playground v2                 | 20.1  | 0.34 | 5
```

**My Personal Bias**

I favor artistic LoRAs over photorealism. I'd rather generate an image that looks like a watercolor painting with visible brush strokes than a photograph that's technically perfect but emotionally empty. Models like "Artistic Illustration" and "Watercolor XL" consistently produce outputs I'd actually use in a project, even though they score lower on FID (which penalizes non-photorealistic outputs).

The sweet spot is models that trained on small, curated datasets of actual artists' work—not the massive, unfiltered internet scrapes that produce "average" quality. The community fine-tunes that took 30 minutes on a single GPU often outperform the million-dollar base models for specific use cases.

**What I Actually Use**

For concept art: FLUX + artistic LoRAs. The base model handles composition while the LoRA adds texture and style.

For game assets: SDXL + photorealistic LoRA. The extra detail at 1024x1024 resolution helps when the asset needs to be consistent across multiple generations.

For UI mockups: A custom fine-tune I trained on 200 screenshots of modern app designs. No base model handles this well—benchmarks don't test for "looks like a legitimate mobile app."

Don't chase the leaderboard. Find the model that produces images you'd actually use, even if its FID score makes it look worse on paper. Your audience won't see the benchmark. They'll see the art.
