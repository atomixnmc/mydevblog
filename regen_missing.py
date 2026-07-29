import json, base64
from pathlib import Path
import urllib.request

API = "http://127.0.0.1:8000/txt2img"
ROOT = Path(r"G:/AtomixM/Web/mydevblog/images")
STYLE = "3d render, octane render, volumetric lighting, cinematic, detailed, 8k"

jobs = [
    ("2014/sgmedia-finance.png", "financial charts and spreadsheets with gaming assets, budget planning, startup finance concept"),
    ("2017/atomixgame-org.png", "github open source organization profile, multiple repositories, game development community"),
    ("2022/logistics-vrp.png", "vehicle routing problem solution map, multiple delivery routes optimized path, 3d isometric"),
    ("2022/octree-3d.png", "3D octree spatial partitioning of a sphere, bounding volumes, hierarchical subdivision, tech art"),
    ("2022/solidjs-signals.png", "solidjs reactive signal graph visualization, fine-grained updates, dependency tracking"),
]

for path, prompt in jobs:
    fpath = ROOT / path
    fpath.parent.mkdir(parents=True, exist_ok=True)
    payload = json.dumps({"prompt":prompt,"style_prompt":STYLE,"width":256,"height":256,"steps":12,"cfg_scale":2.0,"batch_count":1}).encode()
    try:
        req = urllib.request.Request(API, data=payload, headers={"Content-Type":"application/json"}, method="POST")
        with urllib.request.urlopen(req, timeout=120) as resp:
            data = json.loads(resp.read())
        fpath.write_bytes(base64.b64decode(data["images"][0]))
        print(f"OK {path} ({fpath.stat().st_size} bytes)")
    except Exception as e:
        print(f"FAIL {path}: {e}")
