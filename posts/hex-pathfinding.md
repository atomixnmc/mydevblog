# A* Pathfinding on Hex Grids

Pathfinding on hex grids is a natural fit for A*. Each hex has six uniform neighbours, so the cost estimates are clean and the paths look smooth. The key differences from square-grid pathfinding: the coordinate system (axial or cube), the heuristic distance function, and the neighbour enumeration.

The A* algorithm itself doesn't change—maintain open and closed sets, score nodes by `f = g + h`, expand the lowest-f node. What changes is the **heuristic** and **neighbour generation**. On a hex grid, use **hex distance** as the heuristic:

```js
function hexDistance(a, b) {
  const dq = a.q - b.q;
  const dr = a.r - b.r;
  const ds = a.s - b.s;  // s = -q - r
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(ds)) / 2;
}
```

This is admissible (never overestimates) because hex distance is the true shortest path length. On a hex grid with uniform movement costs, hex distance equals the actual path cost, so A* finds the optimal path with minimal node expansion.

```js
function aStarHex(start, goal, obstacles) {
  const open = new PriorityQueue();
  const gScore = new Map();
  const cameFrom = new Map();

  open.enqueue(start, 0);
  gScore.set(hexKey(start), 0);

  while (!open.isEmpty()) {
    const current = open.dequeue();
    if (current.q === goal.q && current.r === goal.r) {
      return reconstructPath(cameFrom, current);
    }
    for (const dir of CUBE_DIRECTIONS) {
      const neighbor = {
        q: current.q + dir.q,
        r: current.r + dir.r,
        s: current.s + dir.s
      };
      if (obstacles.has(hexKey(neighbor))) continue;

      const tentativeG = gScore.get(hexKey(current)) + 1;
      if (tentativeG < (gScore.get(hexKey(neighbor)) ?? Infinity)) {
        cameFrom.set(hexKey(neighbor), current);
        gScore.set(hexKey(neighbor), tentativeG);
        open.enqueue(neighbor, tentativeG + hexDistance(neighbor, goal));
      }
    }
  }
  return null; // No path
}
```

**Terrain costs** slot in naturally: multiply the movement cost by the terrain multiplier (mud = 3, road = 0.5, grass = 1). Weighted A* (multiplying heuristic by 1.1–1.5) finds paths faster by exploring fewer nodes, at the cost of slight non-optimality. For RTS games with hundreds of units pathfinding simultaneously, that trade-off pays off.

**Blocking patterns** differ from square grids. A wall of hexes two wide is impassable on a square grid but can be "squeezed" through on a hex grid due to the offset layout. When building obstacles, fill entire hexes rather than using edges to avoid visual ambiguity.

For large grids, pair A* with a hierarchical pathfinding layer (HPA*): cluster hexes into regions, pathfind between regions, then refine within each region. This drops pathfinding time from milliseconds to microseconds on 1000×1000 grids.
