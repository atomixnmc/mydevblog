# Spatial Hashing: Fast Proximity Queries for Dynamic Scenes

Quadtrees are great for static scenes, but when hundreds of entities move every frame, rebuilding the tree dominates your frame budget. Spatial hashing trades tree traversal for hash table lookups—no hierarchy, no rebuilding, just constant-time insertion, query, and removal.

The principle is simple: partition the world into a uniform grid (cell size = typical entity radius × 2). For each entity, compute its cell coordinates `(gx, gy) = floor(x / cellSize, y / cellSize)`. Store entities in a hash map keyed by cell coordinates. Collision queries check the entity's cell and its eight neighbours.

```js
class SpatialHash {
  constructor(cellSize) {
    this.cellSize = cellSize;
    this.cells = new Map(); // key: "gx,gy", value: Set<Entity>
  }

  hash(x, y) {
    const gx = Math.floor(x / this.cellSize);
    const gy = Math.floor(y / this.cellSize);
    return `${gx},${gy}`;
  }

  insert(entity) {
    const key = this.hash(entity.x, entity.y);
    if (!this.cells.has(key)) this.cells.set(key, new Set());
    this.cells.get(key).add(entity);
    entity._hashKey = key; // For O(1) removal
  }

  remove(entity) {
    if (entity._hashKey && this.cells.has(entity._hashKey)) {
      this.cells.get(entity._hashKey).delete(entity);
    }
  }

  query(entity, range = 1) {
    const gx = Math.floor(entity.x / this.cellSize);
    const gy = Math.floor(entity.y / this.cellSize);
    const result = [];
    for (let dx = -range; dx <= range; dx++) {
      for (let dy = -range; dy <= range; dy++) {
        const key = `${gx + dx},${gy + dy}`;
        if (this.cells.has(key)) {
          result.push(...this.cells.get(key));
        }
      }
    }
    return result;
  }
}

// Per frame: clear and re-insert all moving entities
function updateGrid(entities, grid) {
  grid.clear(); // Rebuild each frame, or update positions in-place
  for (const e of entities) grid.insert(e);
}
```

**Cell size tuning** is the critical parameter. Too large, and each cell contains many entities, defeating the purpose. Too small, and entities span multiple cells, requiring wider neighbour queries. The sweet spot: cell size ≈ 2× the average entity interaction radius.

**Performance characteristics**: Insertion and removal are O(1). Querying a 3×3 neighbourhood is O(9 × avg_entities_per_cell). For 10,000 entities with even distribution across a 100×100 grid, each cell holds ~1 entity, so queries are O(1) in practice. Compare that to rebuilding a quadtree: O(n log n) insertion, O(log n) queries.

**Optimisations**: For extremely dense scenes, use a 2D array instead of a hash map—preallocate based on world size and cell count. This avoids string-key allocation per entity per frame. For sparse scenes, the hash map wins by using memory proportional to occupied cells only.

Spatial hashing pairs with physics engines and visibility systems. Use it for broad-phase collision detection (narrow-phase handles the actual SAT/GJK per candidate pair), for AI sensor queries ("which enemies are near?"), and for frustum culling in 2D games.
