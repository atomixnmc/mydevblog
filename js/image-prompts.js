// Image prompts for blog post illustrations
// 1 image per ~3 posts = 63 images for 188 posts
const IMAGE_PROMPTS = [
  // React era
  { prefix: 'react-vintage', prompt: 'retro abstract geometric shapes in red blue gradient, 2015 web dev aesthetic, flat design, minimalist', style: 'flat illustration, game asset, clean silhouette', posts: ['react-from-scratch-v1','react-v1-migration','react-setstate-patterns'] },
  { prefix: 'react-fiber', prompt: 'abstract tree structure with glowing nodes, fiber optic connections, data flow visualization, tech blue', style: 'flat illustration, game asset, clean silhouette', posts: ['react-v16-fiber','react-reconciliation','react-v16-lifecycles'] },
  { prefix: 'react-hooks', prompt: 'fishing hooks made of code symbols, colorful tech illustration, minimalist', style: 'flat illustration, game asset, clean silhouette', posts: ['react-hooks-intro','react-context-api','react-error-boundaries'] },
  { prefix: 'react-18', prompt: 'concurrent time streams merging into one, blue purple gradient, futuristic UI concept', style: 'flat illustration, game asset, clean silhouette', posts: ['react-v18-concurrent','react-18-strict-mode','react-18-automatic-batching'] },
  { prefix: 'react-19', prompt: 'robot hand pressing action button, server rack background, tech illustration', style: 'flat illustration, game asset, clean silhouette', posts: ['react-19-actions','react-19-use','react-19-compiler'] },
  { prefix: 'react-native', prompt: 'mobile phone with native code bridge connecting to crystal, tech illustration', style: 'flat illustration, game asset, clean silhouette', posts: ['react-native-intro','react-native-vs-solid','react-native-reanimated'] },

  // Game Dev
  { prefix: 'libgdx', prompt: 'retro game controller with java coffee cup icon, pixel art, gamedev', style: 'flat illustration, game asset, clean silhouette', posts: ['libgdx-hello-world','libgdx-scene2d','libgdx-box2d-physics'] },
  { prefix: 'libgdx-ecs', prompt: 'entity component system diagram as puzzle pieces fitting together, tech', style: 'flat illustration, game asset, clean silhouette', posts: ['libgdx-ecs-architecture','libgdx-ashley-ecs','libgdx-particle-effects'] },
  { prefix: 'jme3', prompt: '3D abstract low poly forest with terrain generation, green blue gradient', style: 'flat illustration, game asset, clean silhouette', posts: ['jme3-basics','jme3-terrain-generation','jme3-model-loading'] },
  { prefix: 'jme3-shaders', prompt: 'colorful gradient sphere with wireframe overlay on dark background, tech art', style: 'flat illustration, game asset, clean silhouette', posts: ['jme3-shaders','jme3-water-effects','jme3-physics-bullet'] },

  // Fractals
  { prefix: 'mandelbrot', prompt: 'deep zoom into colorful mandelbrot set, purple green blue, infinite detail', style: 'flat illustration, game asset, clean silhouette', posts: ['fractal-intro','mandelbrot-deep-zoom','fractal-buddhabrot'] },
  { prefix: 'fractal-ifs', prompt: 'branching fern fractal pattern, nature algorithm visualization, green on dark', style: 'flat illustration, game asset, clean silhouette', posts: ['fractal-ifs','fractal-lsystems','fractal-flame'] },
  { prefix: 'fractal-3d', prompt: '3D mandelbulb fractal, iridescent colors, deep space background', style: 'flat illustration, game asset, clean silhouette', posts: ['fractal-3d-mandelbrot','fractal-menger-sponge','fractal-doom-fire'] },
  { prefix: 'fractal-noise', prompt: 'fractal noise pattern as topographic terrain map, orange blue gradient', style: 'flat illustration, game asset, clean silhouette', posts: ['fractal-noise-terrain','fractal-visual-programming','fractal-visual-programming-tools'] },

  // Microservices / NestJS
  { prefix: 'nodejs', prompt: 'node.js hex logo with connected service nodes, microservice architecture diagram', style: 'flat illustration, game asset, clean silhouette', posts: ['nodejs-event-loop-deep-dive','microservices-with-nodejs','nodejs-streams'] },
  { prefix: 'event-driven', prompt: 'event bus connecting multiple hexagonal services, realtime data flow, blue', style: 'flat illustration, game asset, clean silhouette', posts: ['event-driven-architecture','nodejs-backpressure','nodejs-cluster'] },
  { prefix: 'nestjs', prompt: 'nestjs logo with module dependency graph, typescript blue shield', style: 'flat illustration, game asset, clean silhouette', posts: ['nestjs-first-app','di-basics','nestjs-testing'] },
  { prefix: 'nestjs-advanced', prompt: 'multiple microservice nodes connected by lightning bolts, event streaming', style: 'flat illustration, game asset, clean silhouette', posts: ['nestjs-microservices','nestjs-graphql','nestjs-websockets'] },
  { prefix: 'nestjs-kafka', prompt: 'apache kafka topic partitions as layered logs, event streaming pipeline', style: 'flat illustration, game asset, clean silhouette', posts: ['nestjs-kafka','nestjs-rabbitmq','nestjs-grpc'] },

  // Geometry / Spatial
  { prefix: 'hex-grid', prompt: 'hexagonal grid with glowing edges, strategy game map style, tactical view', style: 'flat illustration, game asset, clean silhouette', posts: ['hex-grid-basics','hex-pathfinding','hex-map-rendering'] },
  { prefix: 'hex-math', prompt: 'mathematical coordinate system on hex grid, axial cube coordinates', style: 'flat illustration, game asset, clean silhouette', posts: ['hex-distance-math','hex-field-of-view','hex-generation-algorithms'] },
  { prefix: 'spatial-index', prompt: 'quadtree subdivision of 2D space, bounding boxes, spatial algorithm visualization', style: 'flat illustration, game asset, clean silhouette', posts: ['spatial-indexing-quadtree','spatial-indexing-grid','spatial-indexing-rstar'] },
  { prefix: 'octree-bvh', prompt: '3D octree subdivision of a sphere, hierarchical bounding volumes, tech', style: 'flat illustration, game asset, clean silhouette', posts: ['spatial-octree','spatial-bvh','spatial-indexing-grid-vs-tree'] },

  // AI / LLM
  { prefix: 'transformer', prompt: 'transformer neural network attention diagram, multi-head connections, colorful', style: 'flat illustration, game asset, clean silhouette', posts: ['transformer-attention','llm-intro','gpt-fine-tuning'] },
  { prefix: 'diffusion', prompt: 'denoising diffusion process, noise to clear image steps, AI generation visualization', style: 'flat illustration, game asset, clean silhouette', posts: ['diffusion-models-intro','dit-diffusion-transformers','dit-training'] },
  { prefix: 'llm-agents', prompt: 'AI agent robot using multiple tools connected by wires, autonomous reasoning', style: 'flat illustration, game asset, clean silhouette', posts: ['llm-agents','chatgpt-prompt-engineering','llm-rag-patterns'] },
  { prefix: 'autoregressive', prompt: 'sequence prediction arrows from left to right, next token generation, AI model', style: 'flat illustration, game asset, clean silhouette', posts: ['autoregressive-models','dit-vs-gan-vs-ar','causal-inference-ml'] },

  // Graphs / HyperGraph
  { prefix: 'causal-graph', prompt: 'directed acyclic graph of cause and effect, nodes with arrows, scientific diagram', style: 'flat illustration, game asset, clean silhouette', posts: ['causal-graphs-intro','causal-discovery','causal-graph-learning'] },
  { prefix: 'graph-db', prompt: 'graph database nodes connected by labeled edges, knowledge graph visualization', style: 'flat illustration, game asset, clean silhouette', posts: ['graph-db-comparison','graph-neural-networks','hypergraph-vs-property-graph'] },
  { prefix: 'hypergraph', prompt: 'hypergraph with hyperedges connecting multiple nodes, complex network, colorful bubbles', style: 'flat illustration, game asset, clean silhouette', posts: ['hypergraph-concept','hypergraph-storage-engine','hypergraph-query-language'] },
  { prefix: 'hypergraph-advanced', prompt: 'execution graph with data flow arrows, computing nodes, optimization pipeline', style: 'flat illustration, game asset, clean silhouette', posts: ['hypergraph-execution-engine','hypergraph-query-performance','hypergraph-visualization'] },

  // Logistics
  { prefix: 'logistics-vrp', prompt: 'vehicle route optimization on map, multiple delivery points connected by paths', style: 'flat illustration, game asset, clean silhouette', posts: ['logistic-optimization-intro','logistic-vrp','logistic-grasshopper-deep'] },
  { prefix: 'logistics-warehouse', prompt: 'warehouse grid layout with optimized picker routes, logistics simulation', style: 'flat illustration, game asset, clean silhouette', posts: ['logistic-warehouse','logistic-metaheuristics','logistic-simulation'] },

  // Frontend
  { prefix: 'solidjs', prompt: 'solidjs logo with signal reactivity graph, fine grained updates visualization', style: 'flat illustration, game asset, clean silhouette', posts: ['solidjs-first-look','solidjs-signals-vs-hooks','solidjs-mounting'] },
  { prefix: 'angular', prompt: 'angular shield with component tree and signal icons, web framework', style: 'flat illustration, game asset, clean silhouette', posts: ['angular-ivy','angular-standalone','angular-v13'] },

  // i2c / Long / AniGo / Jigsaw
  { prefix: 'i2c-ecosystem', prompt: 'interconnected ecosystem of hexagonal modules forming larger graph structure', style: 'flat illustration, game asset, clean silhouette', posts: ['i2c-ecosystem-intro','hypergraph-fluid-substrate','fluidy-compiler-runtime'] },
  { prefix: 'long-runtime', prompt: 'polyglot runtime environment running multiple programming languages in parallel', style: 'flat illustration, game asset, clean silhouette', posts: ['long-polyglot-runtime','long-ir-design','long-boa-parity'] },
  { prefix: 'long-advanced', prompt: 'code transforming into visible graph structure with analysis overlays', style: 'flat illustration, game asset, clean silhouette', posts: ['long-hypergraph-visibility','long-v03-dataflow','long-standard-modules'] },
  { prefix: 'anigo', prompt: 'AI character rig with neural network skeleton, motion flow lines, animation', style: 'flat illustration, game asset, clean silhouette', posts: ['anigo-ai-animation','anigo-motion-synthesis','anigo-timeline-system'] },
  { prefix: 'anigo-sgm', prompt: 'structured generative model pipeline, input to animation output, flow diagram', style: 'flat illustration, game asset, clean silhouette', posts: ['anigo-sgm-framework','anigo-ai-agent-director','anigo-procedural-rigging'] },
  { prefix: 'jigsaw', prompt: 'jigsaw puzzle pieces clicking together with trust verification checkmarks', style: 'flat illustration, game asset, clean silhouette', posts: ['jigsaw-trust-verification','jigsaw-cbor-evidence','jigsaw-7-crates'] },
  { prefix: 'uploop', prompt: 'hypergraph application framework layers, UI connected to data graph, architecture', style: 'flat illustration, game asset, clean silhouette', posts: ['uploopjs-concept','uploopjs-entity-system','uploop-stream-binary'] },
  { prefix: 'uploop-vided', prompt: 'AI video composition timeline with MCP tool connections, editing interface', style: 'flat illustration, game asset, clean silhouette', posts: ['uploop-vided-ai-video','uploop-vided-mcp-server','uploop-ge-gpu-engine'] },
  { prefix: 'uploop-flows', prompt: 'multiple execution strategy profiles as branching flow charts, optimization', style: 'flat illustration, game asset, clean silhouette', posts: ['uploop-flows-profiles','uploop-server-ssr','uploop-bridges-react'] },
  { prefix: 'lac-runtime', prompt: 'compute layer bridging different runtime engines, abstraction architecture', style: 'flat illustration, game asset, clean silhouette', posts: ['lac-runtime-layer','lac-engine-swap','lac-capability-model'] },
  { prefix: 'hypergraph-polygon', prompt: 'polygon shaped runtime connecting multiple nodes, distributed execution', style: 'flat illustration, game asset, clean silhouette', posts: ['hypergraph-polygon-runtime','hypergraph-current-state','hypergraph-ai-manifest'] },
  { prefix: 'mydevblog', prompt: 'personal tech blog website with web components and markdown, coding theme', style: 'flat illustration, game asset, clean silhouette', posts: ['mydevblog-relaunch','uploopjs-v08','long-current-status'] },

  // Additional spread posts
  { prefix: 'rings-dht', prompt: 'distributed hash table ring topology, node discovery network, decentralized', style: 'flat illustration, game asset, clean silhouette', posts: ['ring-dht-hypergraph','rings-dht-rust','long-native-capability'] },
  { prefix: 'logistics-multi', prompt: 'multi objective optimization graph, pareto front, balancing tradeoffs', style: 'flat illustration, game asset, clean silhouette', posts: ['logistic-multi-objective','hypergraph-temperature-routing','solidjs-v2-release'] },
  { prefix: 'angular-signals', prompt: 'angular reactive signal system, zone less change detection visualization', style: 'flat illustration, game asset, clean silhouette', posts: ['angular-signals-preview','angular-v16-signals','solidjs-v2-signals'] },
  { prefix: 'persistent-memory', prompt: 'persistent memory storage cells, data retention visualization, tech blue', style: 'flat illustration, game asset, clean silhouette', posts: ['solidjs-v1','solidjs-v2-roadmap','rest-vs-graphql-node'] },
];
