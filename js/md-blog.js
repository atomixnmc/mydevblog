const BLOG = {
  posts: [],
  ghRepos: [],
  currentTopic: null,

  voice: {
    React: (p) => "> \u{1F4AD} *Personal note:* I've been tracking React since its v0.3 days \u2014 back when createClass was the only game in town and JSX felt like a weird experiment. Every new release peels back another layer of abstraction. With " + p.title.split(':')[0] + ", I found myself wondering: _are we finally getting the right defaults, or just different defaults?_",
    'Game Dev': (p) => `> \u{1F3AE} *Dev log:* Game dev has this unique property \u2014 you ship a broken build and it's funny, not catastrophic. Recently I was pair-debugging a libGDX sprite batching issue with a friend at 2 AM. Turned out to be a texture atlas page size. ${p.title} digs into stuff like that.`,
    Microservices: (p) => `> \u26A1 *From the trenches:* Microservices are like hosting a dinner party where every dish has its own kitchen. I've been running Node/NestJS services in production since 2018, and the patterns that survive are the boring ones \u2014 predictable retries, bounded queues, and knowing when _not_ to split a service.`,
    Fractals: (p) => `> \u{1F300} *Late-night rabbit hole:* There's something meditative about watching a Mandelbrot deep-zoom render. I once left one running overnight and dreamed in complex planes. Fractals teach you that simple rules + iteration = infinite complexity. Kind of like software.`,
    'Geometry & Maths': (p) => `> \u{1F4D0} *Math is cheating:* Every time I implement a spatial index or hex grid, I'm reminded that the best optimizations aren't algorithmic \u2014 they're mathematical. A hex coordinate system isn't clever code; it's clever _geometry_.`,
    Frontend: (p) => `> \u{1F5BC}\uFE0F *Framework fatigue?* Maybe. But I learned more from comparing Solid's signals to Angular's signals than from any single framework tutorial. ${p.title} is part of that ongoing investigation.`,
    'React Native': (p) => `> \u{1F4F1} *Mobile reality check:* React Native promised "learn once, write anywhere." What it delivered was "debug once, cry everywhere." But damn, when Hermes hits 60fps and the bridge doesn't drop a frame, it feels like magic. ${p.title} explores that tension.`,
    AI: (p) => `> \u{1F916} *Prompting humans:* I spent a week fine-tuning a 7B model for code generation and learned that the hardest part isn't the model \u2014 it's knowing what you actually want. LLMs mirror our own fuzzy thinking back at us. ${p.title} is me trying to think less fuzzy.`,
    Logistics: (p) => `> \u{1F69A} *The boring stuff matters:* Logistics optimization isn't glamorous. But when a Grasshopper-solved VRP shaves 12% off delivery fuel costs, that's real impact. I worked with a small logistics team in 2022 applying metaheuristics to last-mile delivery. ${p.title} builds on that experience.`,
    'Graphs & AI': (p) => `> \u{1F578}\uFE0F *Graphs are the new tables:* I became obsessed with hypergraphs after realizing that property graphs couldn't express n-ary relationships cleanly. Causal graphs, GNNs, hypergraphs \u2014 ${p.title} is part of a running series on _why graphs matter for AI_.`,
    i2c: (p) => `> \u{1F517} *Ecosystem thinking:* Building the i2c stack (HyperGraph, Fluid, Rings) has been my longest-running research thread. The idea: what if data, index, and program weren't separate layers but a single graph? ${p.title} documents the wins and the bruises.`,
    AniGo: (p) => `> \u{1F3AC} *The AI animator:* AniGo started as a question: "Can an LLM direct animation keyframes?" The answer is yes, but it needs guardrails \u2014 literally, constraint gradients. ${p.title} is the technical story behind making AI-generated motion _not_ look uncanny.`,
    Long: (p) => `> \u{1F527} *Runtime archaeology:* Building a polyglot runtime from scratch isn't just hard \u2014 it's _humbling_. Long started as "what if JS ran on a graph?" and turned into "what if _every_ language ran on a graph?" ${p.title} is a piece of that journey.`,
    Jigsaw: (p) => `> \u{1F510} *Trust is a spectrum:* Jigsaw came from a simple insight: verification isn't binary. A piece of evidence can be plausible, corroborated, or attested. Graded trust changes how you think about security.`,
    Lac: (p) => `> \u{1F9E9} *The glue layer:* Lac exists so you can swap runtimes without touching business logic. Think of it as the HAL from _2001: A Space Odyssey_ \u2014 but for computation, not spaceships. Hopefully fewer homicidal outbursts.`,
    Uploop: (p) => `> \u{1F310} *Framework from the future:* Uploop flips the script: instead of components calling APIs, entities declare what they _are_ and the framework generates the rest. It's reactive, graph-native, and AI-readable. ${p.title} is the deep dive.`,
    Meta: (p) => `> \u{1F4DD} *Meta moment:* This blog itself is a project. Shoelace WebComponents, client-side Markdown, AI-generated images. ${p.title} is self-referential. How very 2026 of me.`,
    SGMedia: (p) => `> \u{1F3E2} *Founder flashback:* SGMedia was my first real company \u2014 founded in a Saigon coffee shop in 2013, killed by YouTube's adpocalypse in 2018. We built real-time game ecosystems with Node.js and Unity. ${p.title} is a piece of that story.`,
    Personal: (p) => `> \u{1F30D} *Life update:* Not every post needs to be technical. Sometimes the most important migrations are the ones you make in real life \u2014 countries, cities, communities. This one is about the journey, not the framework.`,
  },

  fallbackVoice(p) {
    const t = p.topic || 'tech';
    const voices = [
      `> \u{1F4A1} *Wandering thought:* I was revisiting ${t} the other day and realized how much the landscape shifted since I first encountered it. ${p.title} is my attempt to capture the current state \u2014 before it shifts again.`,
      `> \u{1F50D} *Deep dive:* ${p.title} isn't just a summary \u2014 it's what I wish I'd known when I started exploring ${t}. The docs skip the hard parts. Here they are.`,
      `> \u{1F3AF} *Why this matters:* I've been asked "why ${t}?" enough times that I wrote ${p.title} as the long-form answer. TL;DR: because the boring tools break first, and ${t} doesn't break.`,
      `> \u{1F9E0} *Hot take:* Everyone talks about ${t} like it's settled science. It's not. Here's what I've found by actually implementing it instead of just reading about it.`
    ];
    return voices[Math.floor(Math.random() * voices.length)];
  },
