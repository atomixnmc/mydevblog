import json, base64, sys, os, time
from pathlib import Path
import urllib.request

API = "http://127.0.0.1:8000/txt2img"
OUT = Path(r"G:\AtomixM\Web\mydevblog\images")
OUT.mkdir(exist_ok=True)

prompts = [
    ("react-vintage", "retro abstract geometric shapes red blue gradient, 2015 web dev aesthetic"),
    ("react-fiber", "abstract tree structure glowing nodes fiber optic connections tech blue"),
    ("react-hooks", "fishing hooks made of code symbols colorful tech illustration"),
    ("react-18", "concurrent time streams merging blue purple gradient futuristic"),
    ("react-19", "robot hand pressing action button server rack background tech"),
    ("react-native", "mobile phone native code bridge connecting to crystal tech"),
    ("libgdx", "retro game controller with java coffee cup icon pixel art gamedev"),
    ("libgdx-ecs", "entity component system puzzle pieces fitting together tech"),
    ("jme3", "3D abstract low poly forest terrain generation green blue"),
    ("jme3-shaders", "colorful gradient sphere wireframe overlay dark bg tech art"),
    ("mandelbrot", "deep zoom colorful mandelbrot set purple green blue infinite detail"),
    ("fractal-ifs", "branching fern fractal nature algorithm visualization green dark"),
    ("fractal-3d", "3D mandelbulb fractal iridescent colors deep space background"),
    ("fractal-noise", "fractal noise topographic terrain map orange blue gradient"),
    ("nodejs", "nodejs hex logo with connected service nodes microservice diagram"),
    ("event-driven", "event bus connecting hexagonal services realtime data flow blue"),
    ("nestjs", "nestjs logo module dependency graph typescript blue shield"),
    ("nestjs-advanced", "multiple microservice nodes lightning bolts event streaming"),
    ("nestjs-kafka", "apache kafka topic partitions layered logs event pipeline"),
    ("hex-grid", "hexagonal grid glowing edges strategy game map tactical view"),
    ("hex-math", "mathematical coordinate system hex grid axial cube coordinates"),
    ("spatial-index", "quadtree subdivision 2D space bounding boxes algorithm visualization"),
    ("octree-bvh", "3D octree subdivision sphere hierarchical bounding volumes tech"),
    ("transformer", "transformer attention diagram multi-head connections colorful"),
    ("diffusion", "denoising diffusion process noise to clear image steps AI"),
    ("llm-agents", "AI agent robot using multiple tools connected by wires"),
    ("autoregressive", "sequence prediction arrows left to right next token generation"),
    ("causal-graph", "directed acyclic graph cause effect nodes arrows scientific"),
    ("graph-db", "graph database nodes labeled edges knowledge graph visualization"),
    ("hypergraph", "hypergraph hyperedges connecting multiple nodes colorful bubbles"),
    ("hypergraph-advanced", "execution graph data flow arrows computing optimization pipeline"),
    ("logistics-vrp", "vehicle route optimization map delivery points connected paths"),
    ("logistics-warehouse", "warehouse grid layout optimized picker routes logistics sim"),
    ("solidjs", "solidjs logo signal reactivity graph fine grained updates"),
    ("angular", "angular shield component tree signal icons web framework"),
    ("i2c-ecosystem", "interconnected ecosystem hexagonal modules graph structure"),
    ("long-runtime", "polyglot runtime running multiple programming languages parallel"),
    ("long-advanced", "code transforming into visible graph structure analysis overlays"),
    ("anigo", "AI character rig neural network skeleton motion flow lines"),
    ("anigo-sgm", "structured generative model pipeline input to animation output"),
    ("jigsaw", "jigsaw puzzle pieces clicking trust verification checkmarks"),
    ("uploop", "hypergraph application framework layers UI connected data graph"),
    ("uploop-vided", "AI video composition timeline MCP tool connections editing"),
    ("uploop-flows", "multiple execution strategy profiles branching flow charts"),
    ("lac-runtime", "compute layer bridging different runtime engines abstraction"),
    ("hypergraph-polygon", "polygon runtime connecting multiple nodes distributed execution"),
    ("mydevblog", "personal tech blog website web components markdown coding theme"),
    ("rings-dht", "distributed hash table ring topology node discovery decentralized"),
    ("logistics-multi", "multi objective optimization graph pareto front tradeoffs"),
    ("angular-signals", "angular reactive signal system zone less change detection"),
    ("persistent-memory", "persistent memory storage cells data retention tech blue"),
]

style = "flat illustration, game asset, clean silhouette"

count = 0
for name, prompt in prompts:
    fname = f"blog-{name}.png"
    if (OUT / fname).exists():
        print(f"SKIP {name} (exists)")
        count += 1
        continue

    payload = json.dumps({
        "prompt": prompt,
        "style_prompt": style,
        "width": 256,
        "height": 256,
        "steps": 10,
        "cfg_scale": 1.5,
        "batch_count": 1
    }).encode()

    try:
        req = urllib.request.Request(API, data=payload, headers={"Content-Type": "application/json"},
                                     method="POST")
        with urllib.request.urlopen(req, timeout=120) as resp:
            data = json.loads(resp.read())
        img_b64 = data["images"][0]
        img_data = base64.b64decode(img_b64)
        (OUT / fname).write_bytes(img_data)
        print(f"OK {name} -> {fname} ({len(img_data)} bytes)")
        count += 1
    except Exception as e:
        print(f"FAIL {name}: {e}")

print(f"\nDone: {count}/{len(prompts)} images")
