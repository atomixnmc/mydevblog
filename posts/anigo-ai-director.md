# AniGo AI Director

The AniGo AI Director is an autonomous agent that controls character behavior. Instead of scripting behavior trees or state machines, you give the director high-level instructions and it figures out the animation sequencing.

## How It Works

The director is a small language model (1.5B params) fine-tuned on behavior descriptions paired with animation sequences. It takes the current scene state and a goal, and outputs a sequence of animation directives:

```rust
struct DirectorGoal {
    character: EntityId,
    objective: String,     // "walk to the door and open it"
    constraints: Vec<Constraint>,
}

struct AnimationDirective {
    action: String,        // "walk", "reach", "grab"
    target: Option<Vec3>,
    duration: f32,
    blend_in: f32,
}

impl Director {
    fn plan(&self, goal: &DirectorGoal, context: &SceneContext) -> Vec<AnimationDirective> {
        let prompt = format!(
            "Scene: {}\nCharacter state: {:?}\nGoal: {}\nOutput:",
            context.description,
            context.character_state,
            goal.objective,
        );
        let tokens = self.model.generate(&prompt, max_tokens: 128);
        self.parse_directives(tokens)
    }
}
```

## Training

The director model was trained on a dataset of 50,000 (scene, goal, action_sequence) triples. We generated the data by recording human playthroughs of a sandbox environment and extracting the animation commands issued at each step. The model uses a causal transformer with 12 layers, 12 attention heads, and a 512-dim embedding:

```python
class DirectorModel(nn.Module):
    def __init__(self):
        super().__init__()
        self.embed = nn.Embedding(vocab_size=16384, dim=512)
        self.transformer = nn.TransformerDecoder(
            decoder_layer=nn.TransformerDecoderLayer(d_model=512, nhead=12),
            num_layers=12,
        )
        self.output_head = nn.Linear(512, action_vocab_size)

    def forward(self, tokens, memory):
        x = self.embed(tokens)
        x = self.transformer(x, memory)
        return self.output_head(x)
```

## Runtime Behavior

The director runs at 10 Hz — fast enough for responsive behavior, slow enough that the 20ms inference time doesn't dominate the frame budget. The directives are queued and executed by the timeline system:

```rust
fn run_director_loop(director: &Director, timeline: &mut Timeline, scene: &SceneContext) {
    loop {
        let goal = scene.current_goal();
        let directives = director.plan(&goal, scene);
        for d in directives {
            timeline.enqueue(d);
        }
        thread::sleep(Duration::from_millis(100));
    }
}
```

The director handles about 80% of character behavior correctly. For the remaining 20% — unusual geometry, multi-step interactions, objects in unexpected positions — the director issues plausible but incorrect directives. We handle this with a validation layer that checks directives against physics and collision constraints before sending them to the timeline. If a directive fails validation, the director is queried again with the failure context appended. This retry loop adds latency but rarely needs more than one retry in practice.

The AI director replaces about 2000 lines of behavior tree code in our demo. It's less predictable than a hand-crafted tree, but far more flexible — changing a character's behavior is now a prompt edit rather than a tree recompile.