# Spatial Indexing: Quadtrees for 2D Games

If your game checks every entity against every other entity for collisions, you're paying O(n²) per frame. Quadtrees reduce that to O(n log n) by partitioning space hierarchically. For any 2D scene with more than a few dozen objects—bullet hell shooters, RTS units, platformers—a quadtree is the difference between 60fps and a slide show.

A quadtree recursively subdivides space into four quadrants. Each node holds a capacity (max objects before splitting) and a bounding box. When a node overflows, it splits into four children and redistributes its objects. Objects that straddle boundaries live in the parent node.

```js
class QuadTree {
  constructor(bounds, capacity = 4) {
    this.bounds = bounds;  // { x, y, w, h }
    this.capacity = capacity;
    this.objects = [];
    this.children = null;
  }

  insert(obj) {
    if (!this.contains(obj)) return false;
    if (this.objects.length < this.capacity && !this.children) {
      this.objects.push(obj);
      return true;
    }
    if (!this.children) this.subdivide();
    for (let child of this.children) {
      if (child.insert(obj)) return true;
    }
    this.objects.push(obj); // straddles boundary
    return true;
  }

  query(range, result = []) {
    if (!this.intersects(range)) return result;
    for (let obj of this.objects) {
      if (this.inside(obj, range)) result.push(obj);
    }
    if (this.children) {
      for (let child of this.children) child.query(range, result);
    }
    return result;
  }

  subdivide() {
    const { x, y, w, h } = this.bounds;
    this.children = [
      new QuadTree({ x: x,       y: y,       w: w/2, h: h/2 }, this.capacity),
      new QuadTree({ x: x + w/2, y: y,       w: w/2, h: h/2 }, this.capacity),
      new QuadTree({ x: x,       y: y + h/2, w: w/2, h: h/2 }, this.capacity),
      new QuadTree({ x: x + w/2, y: y + h/2, w: w/2, h: h/2 }, this.capacity),
    ];
    // Redistribute existing objects to children
    const old = this.objects;
    this.objects = [];
    for (let obj of old) {
      for (let child of this.children) {
        if (child.insert(obj)) break;
      }
    }
  }
}
```

The `query` method is what your collision system calls. Pass the bounding box of your moving entity; the quadtree returns only objects in overlapping quadrants. For a bullet with a small hitbox, this might return 3–5 candidates instead of 200.

**Tuning tips**: Keep `maxObjects` around 4–8 and `maxDepth` around 8–10 to avoid degenerate behaviour. If objects move every frame, rebuild or re-insert instead of updating positions in-place. For static geometry (terrain tiles), build the tree once and reuse.

Quadtrees pair perfectly with A* or Dijkstra pathfinding as well—use the tree to fast-reject open nodes that are clearly in blocked regions, pruning large parts of the search space.
