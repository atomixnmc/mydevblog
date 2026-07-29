# Hex Distance and Range Math

Hexagonal grids are a staple of strategy games, but the math for distance and range differs from Cartesian grids. Understanding hex coordinate systems is essential for implementing movement ranges, attack radii, and field-of-view on hex maps.

I've implemented hex grid systems for three game projects over the years, and I've made every mistake in the book: using the wrong coordinate system for the use case, implementing distance as Euclidean (which gives wrong results for grid movement), and writing O(n²) range queries that killed performance for large maps. This post is the reference I wish I'd had.

## The Three Coordinate Systems

There are three primary coordinate systems for hex grids, and each has its place:

**Offset coordinates** (also called staggered coordinates) are the most intuitive for artists and level designers because they look like a 2D array with every other row shifted. The two variants are odd-row offset and even-row offset. The math for adjacency and distance is non-trivial because the offset alternates.

```python
# Offset coordinates (odd-row offset)
# Each row y has columns x; odd rows are shifted right by 0.5
def offset_neighbors(x, y):
    parity = y & 1  # 0 for even row, 1 for odd row
    if parity == 0:  # even row
        return [
            (x-1, y), (x+1, y),           # left, right
            (x-1, y-1), (x, y-1),         # upper left, upper right
            (x-1, y+1), (x, y+1),         # lower left, lower right
        ]
    else:  # odd row
        return [
            (x-1, y), (x+1, y),           # left, right
            (x, y-1), (x+1, y-1),         # upper left, upper right
            (x, y+1), (x+1, y+1),         # lower left, lower right
        ]
```

The problem with offset coordinates becomes clear when you try to compute distance between two hexes. There's no simple formula—you typically convert to another system first.

**Cube coordinates** are the mathematician's choice. They use three axes (x, y, z) with the constraint that x + y + z = 0. This seems wasteful (3 coordinates for 2D space), but the constraint makes distance calculations trivial.

```python
# Cube coordinates: x + y + z must always equal 0
class CubeCoord:
    def __init__(self, x, y, z):
        assert x + y + z == 0, f"Invalid cube coordinate: {x}+{y}+{z} != 0"
        self.x = x
        self.y = y
        self.z = z

    def distance_to(self, other):
        # Manhattan distance divided by 2
        return (abs(self.x - other.x) + abs(self.y - other.y) + abs(self.z - other.z)) // 2

    def neighbor(self, direction):
        # Six directions in cube coordinates
        directions = [
            (1, -1, 0), (1, 0, -1), (0, 1, -1),
            (-1, 1, 0), (-1, 0, 1), (0, -1, 1)
        ]
        dx, dy, dz = directions[direction]
        return CubeCoord(self.x + dx, self.y + dy, self.z + dz)
```

The distance formula `(|dx| + |dy| + |dz|) / 2` works because the constraint x + y + z = 0 guarantees that one of the deltas has the opposite sign of the other two. The division by 2 makes the result equal to the number of hex steps, which is the correct graph distance.

**Axial coordinates** (also called trapezoidal coordinates) are the practical choice. They drop one axis from cube coordinates, using only (q, r) where q = x and r = z. The constraint becomes implicit: y = -q - r.

```python
# Axial coordinates: (q, r) corresponding to cube (x, z)
# y is derived: y = -q - r
class AxialCoord:
    def __init__(self, q, r):
        self.q = q
        self.r = r

    def distance_to(self, other):
        dq = self.q - other.q
        dr = self.r - other.r
        return (abs(dq) + abs(dr) + abs(dq + dr)) // 2

    def neighbors(self):
        # Six direction vectors in axial coordinates
        directions = [(1,0), (1,-1), (0,-1), (-1,0), (-1,1), (0,1)]
        return [AxialCoord(self.q + dq, self.r + dr) for dq, dr in directions]
```

Axial coordinates are my default for game implementation. They're compact (just two integers per hex), the math is fast, and conversion to/from pixel coordinates is straightforward.

## Converting Between Systems

In practice, you'll store hexes in whatever format your map designer produces (usually offset) and convert to axial or cube for computation:

```python
def offset_to_axial(x, y):
    """Convert odd-row offset to axial (q, r)"""
    q = x - (y - (y & 1)) // 2
    r = y
    return AxialCoord(q, r)

def axial_to_offset(axial):
    """Convert axial to odd-row offset"""
    x = axial.q + (axial.r - (axial.r & 1)) // 2
    y = axial.r
    return (x, y)

def cube_to_pixel(cube, hex_size):
    """Convert cube coordinates to pixel position (pointy-top)"""
    x = hex_size * (3.0/2.0 * cube.x)
    y = hex_size * (math.sqrt(3.0)/2.0 * cube.x + math.sqrt(3.0) * cube.z)
    return (x, y)
```

The pixel conversion is critical for rendering. For pointy-top hexes, the x-spacing is 1.5 hex sizes, and the y-spacing is sqrt(3) hex sizes. The offset between rows follows from the coordinate system.

## Distance and Range Queries

Distance between two hexes is trivial in axial coordinates. But what about finding all hexes within a given range—the bread and butter of strategy game AI?

```python
def hexes_in_range(center, radius):
    """Return all axial coordinates within radius of center (inclusive)"""
    results = []
    for dq in range(-radius, radius + 1):
        for dr in range(max(-radius, -dq - radius), min(radius, -dq + radius) + 1):
            results.append(AxialCoord(center.q + dq, center.r + dr))
    return results
```

The loop bounds deserve explanation. We're iterating over a hexagonal area, which is a cube in cube-coordinate space. The constraint `x + y + z = 0` becomes `dq + dr + ds = 0` where ds = -dq - dr. The inner loop uses `max(-radius, -dq - radius)` and `min(radius, -dq + radius)` to stay within the hexagon.

The number of hexes at range exactly N is `6 * N` for N > 0, and 1 for N = 0. The total hexes within radius R (inclusive) is `3 * R * (R + 1) + 1`. For a radius of 10, that's 331 hexes. For radius 100, it's 30,301 hexes.

## Ring Queries

Finding the ring at a specific distance—useful for attack ranges that are annulus-shaped—requires a different approach:

```python
def hex_ring(center, radius):
    """Return the hexes at exactly radius distance from center"""
    if radius == 0:
        return [center]

    results = []
    # Start at the north-east corner of the ring
    hex = AxialCoord(center.q, center.r - radius)

    # Walk around the six edges of the ring
    directions = [(1,0), (1,-1), (0,-1), (-1,0), (-1,1), (0,1)]

    for direction in directions:
        for _ in range(radius):
            results.append(hex)
            hex = AxialCoord(hex.q + direction[0], hex.r + direction[1])

    return results
```

The ring algorithm walks along each of the six edges of the hexagon at the given radius. Each edge has exactly `radius` hexes, so the total is `6 * radius` hexes. This is efficient—O(radius) instead of O(radius²) for the full range query.

## Line of Sight and Field of View

For line-of-sight on hex grids, the standard approach is Bresenham's line algorithm adapted to hex coordinates:

```python
def hex_line(start, end):
    """Bresenham-style line in hex coordinates"""
    distance = start.distance_to(end)
    results = []

    # Linear interpolation in cube coordinates
    for i in range(distance + 1):
        t = 1.0 / distance * i if distance > 0 else 0
        # Round-cube: interpolate and round to nearest hex
        cube = CubeCoord(
            round(lerp(start.cube_x, end.cube_x, t)),
            round(lerp(start.cube_y, end.cube_y, t)),
            round(lerp(start.cube_z, end.cube_z, t)),
        )
        results.append(cube_to_axial(cube))

    return results

def lerp(a, b, t):
    return a + (b - a) * t
```

The rounding step is critical because linear interpolation of cube coordinates can produce points that don't satisfy `x + y + z = 0`. The round-cube function snaps back to the nearest valid hex:

```python
def round_cube(x, y, z):
    """Round floating-point coordinates to the nearest valid cube coordinate"""
    rx, ry, rz = round(x), round(y), round(z)
    dx, dy, dz = abs(rx - x), abs(ry - y), abs(rz - z)

    # If the rounding violated the constraint x + y + z = 0,
    # adjust the coordinate with the largest rounding error
    if dx > dy and dx > dz:
        rx = -ry - rz
    elif dy > dz:
        ry = -rx - rz
    else:
        rz = -rx - ry

    return CubeCoord(rx, ry, rz)
```

For field-of-view, the recursive shadowcasting algorithm adapts naturally to hex grids. The key change from square grids is that there are 6 directional octants instead of 8:

```python
def hex_fov(origin, max_range, is_blocking):
    """Compute field of view using recursive shadowcasting"""
    visibility = {origin: True}

    # Six octants for hex grid
    octants = [(+1, +1), (+1, 0), (0, -1), (-1, -1), (-1, 0), (0, +1)]

    for octant in octants:
        cast_light(origin, 1, 1.0, 0.0, max_range, is_blocking, visibility, octant)

    return visibility

def cast_light(origin, depth, start_slope, end_slope, max_range,
               is_blocking, visibility, octant):
    if start_slope < end_slope:
        return

    for row in range(depth, max_range + 1):
        blocked = False
        for col in range(-row, 0):
            # Map (row, col) to hex coordinate based on octant
            hex_pos = transform_octant(origin, row, col, octant)
            visibility[hex_pos] = True

            if blocked:
                start_slope = ...  # Adjust slope for shadow boundary
            if is_blocking(hex_pos):
                blocked = True
                # Recurse with adjusted slopes
                cast_light(origin, row + 1, ..., ..., max_range,
                          is_blocking, visibility, octant)
```

The full shadowcasting implementation is about 80 lines and I won't reproduce it here, but the core insight is that hex grids have the same angular structure as square grids—just with different octant boundaries.

## Performance Optimization

For games with many moving units, computing ranges and paths for every unit every frame is expensive. Here are the optimizations I've used in production:

**Precomputed distance tables.** For static maps, precompute all-pairs distances once during level load:

```python
def precompute_distances(hex_list):
    """Precompute distance between every pair of hexes"""
    n = len(hex_list)
    distances = [[0] * n for _ in range(n)]
    for i in range(n):
        for j in range(i + 1, n):
            d = hex_list[i].distance_to(hex_list[j])
            distances[i][j] = d
            distances[j][i] = d
    return distances
```

This is O(n²) in memory, so it only works for maps with < 10,000 hexes. For a 100x100 hex map (10,000 hexes), that's 100 million integers—about 400MB. Too much. Use it only for small tactical maps.

**Spatial hashing.** Partition the map into grid cells and only compute distances for units in adjacent cells. Even though hex grids are themselves a spatial partition, hierarchical spatial hashing reduces the search space for range queries.

**Movement range via BFS bound by Manhattan.** When computing reachable hexes for a unit with movement points, use a priority-ordered BFS that processes hexes in distance order. You can bound the BFS to only process hexes within the maximum possible movement range:

```python
def reachable_hexes(start, movement_points, cost_function):
    """BFS to find all hexes reachable with given movement points"""
    frontier = [(0, start)]
    costs = {start: 0}
    reachable = set()

    while frontier:
        current_cost, current = heapq.heappop(frontier)
        if current_cost > movement_points:
            continue
        reachable.add(current)

        for neighbor in current.neighbors():
            new_cost = current_cost + cost_function(current, neighbor)
            if new_cost <= movement_points and \
               (neighbor not in costs or new_cost < costs[neighbor]):
                costs[neighbor] = new_cost
                heapq.heappush(frontier, (new_cost, neighbor))

    return reachable
```

The beauty of hex math is that it transforms a seemingly complex problem into elegant geometry. Master these formulas and your grid-based systems become both correct and fast. The difference between a naive implementation and an optimized one can be 100x in query time—which is the difference between a game that works and a game that ships.

## Pathfinding on Hex Grids

A* pathfinding on hex grids is a direct adaptation of standard A*, with the hex distance as the heuristic. The critical detail is that the heuristic must be admissible (never overestimate the true cost), and hex distance is both admissible and consistent, making it ideal.

```python
import heapq

def a_star_hex(start, goal, passable_func):
    """A* pathfinding on a hex grid"""
    open_set = [(0, start)]
    came_from = {}
    g_score = {start: 0}
    f_score = {start: start.distance_to(goal)}

    while open_set:
        _, current = heapq.heappop(open_set)

        if current == goal:
            # Reconstruct path
            path = []
            while current in came_from:
                path.append(current)
                current = came_from[current]
            path.append(start)
            return path[::-1]

        for neighbor in current.neighbors():
            if not passable_func(neighbor):
                continue

            # Movement cost: 1 for flat terrain, could vary by terrain type
            # For hex grids, distance between adjacent hexes is always 1
            tentative_g = g_score[current] + 1

            if tentative_g < g_score.get(neighbor, float('inf')):
                came_from[neighbor] = current
                g_score[neighbor] = tentative_g
                f_score[neighbor] = tentative_g + neighbor.distance_to(goal)
                heapq.heappush(open_set, (f_score[neighbor], neighbor))

    return None  # No path found
```

**Terrain costs** extend naturally. Instead of a flat movement cost of 1, you assign each hex a movement cost based on terrain type:

```python
def movement_cost(hex, terrain_map):
    """Return movement cost for a hex based on terrain"""
    terrain = terrain_map.get(hex)
    costs = {
        'road': 0.5,
        'grass': 1.0,
        'forest': 2.0,
        'swamp': 3.0,
        'water': float('inf'),  # Impassable without swimming/flying
        'mountain': float('inf'),  # Impassable without climbing
    }
    return costs.get(terrain, 1.0)
```

The hexagonal A* performs well on tactical maps (typically 32x32 to 128x128 hexes). The heuristic guides the search efficiently toward the goal, and the open set rarely exceeds a few hundred entries for maps under 10,000 hexes.

**Hierarchical pathfinding** is necessary for large world maps (1000x1000+ hexes). The approach divides the map into sectors (e.g., 32x32 hex blocks), precomputes paths between sector entry/exit points, and runs A* at the sector level first, then refines at the hex level.

```python
class HierarchicalHexPathfinder:
    def __init__(self, hex_map, sector_size=32):
        self.hex_map = hex_map
        self.sector_size = sector_size
        self.sector_graph = self._build_sector_graph()

    def find_path(self, start, goal):
        # Step 1: Find the sector-level path
        start_sector = self._sector_of(start)
        goal_sector = self._sector_of(goal)

        if start_sector == goal_sector:
            # Same sector: direct A* is fine
            return a_star_hex(start, goal, self.is_passable)

        sector_path = self._a_star_sectors(start_sector, goal_sector)

        # Step 2: Path through intermediate sectors
        # Find entry/exit hexes for each sector transition
        full_path = []
        for i in range(len(sector_path) - 1):
            sector = sector_path[i]
            next_sector = sector_path[i + 1]
            entry = self._sector_entry_point(sector, next_sector)
            exit = self._sector_exit_point(sector, next_sector)
            local_path = a_star_hex(entry, exit, lambda h: self.is_passable(h) and self._sector_of(h) == sector)
            full_path.extend(local_path)

        return full_path
```

## Coordinate System Showdown: Which to Use

After implementing hex grids in three different engines (Unity custom, libGDX, and a JavaScript canvas game), here's my final recommendation:

| System | Storage | Distance Calc | Adjacency | Pixel Conversion | Recommendation |
|--------|---------|---------------|-----------|-----------------|----------------|
| Offset | Compact | Complex | Conditional | Simple | Map editors, data files |
| Cube | Redundant (3 values) | Trivial | Simple | Moderate | Math-heavy computations |
| Axial | Compact | Simple | Simple | Complex | **Default choice** |

**Axial coordinates are the default** for any new project. They're compact (two ints), the math is fast, and conversion to/from cube and offset is straightforward. Use cube coordinates internally for distance and line-of-sight computations, convert to axial for storage, and convert to offset only when interfacing with data from map editors.

```python
# Conversion utility class
class HexCoord:
    """Unified hex coordinate system with auto-conversion"""
    @staticmethod
    def axial_to_cube(q, r):
        return (q, -q - r, r)

    @staticmethod
    def cube_to_axial(x, y, z):
        return (x, z)

    @staticmethod
    def offset_to_axial(x, y, is_odd_row=True):
        q = x - (y - (1 if is_odd_row else 0)) // 2
        return (q, y)

    @staticmethod
    def axial_to_offset(q, r, is_odd_row=True):
        x = q + (r - (1 if is_odd_row else 0)) // 2
        return (x, r)
```

## Debugging Hex Grids

Hex grids are notoriously hard to debug because the coordinate systems don't match how the eye perceives the grid. A misplaced hex might look right but compute wrong distances. I've learned to always render the coordinates as text labels on each hex during development:

```java
// Render hex coordinates as labels (Unity example)
void OnDrawGizmos() {
    foreach (var hex in grid.hexes) {
        Vector3 pos = hex.WorldPosition;
        // Draw coordinate label
        UnityEditor.Handles.Label(pos, $"({hex.Q}, {hex.R})");

        // Draw distance from a test hex
        float dist = hex.DistanceTo(testHex);
        UnityEditor.Handles.Label(pos + Vector3.down * 0.3f, $"d={dist}");
    }
}
```

Common bugs I've encountered:
- **Row parity mismatch**: The offset direction for odd vs even rows is wrong, causing the grid to have diagonal movement in one direction only.
- **Cube constraint violation**: After rounding cube coordinates, the x+y+z=0 constraint is broken. Always verify after rounding.
- **Pixel-to-hex rounding errors**: Converting screen coordinates back to hex coordinates using the wrong inverse formula. Always test by round-tripping: pixel → hex → pixel should return to the same location.
- **Ring direction order**: The six direction vectors must be in consistent order (clockwise or counterclockwise) for ring iteration to work correctly.

I maintain a test suite for every hex grid implementation that validates: (1) every hex has exactly 6 neighbors, (2) distance is symmetric, (3) the constraint holds for all coordinates, and (4) pixel-to-hex round-trips are within tolerance.

```python
# Test suite for hex grid implementation
def test_hex_grid(grid):
    # Test: every hex has exactly 6 neighbors
    for hex in grid.all_hexes():
        neighbors = hex.neighbors()
        assert len(neighbors) == 6, f"{hex} has {len(neighbors)} neighbors"
        # All neighbors should be distinct
        assert len(set(neighbors)) == 6, f"{hex} has duplicate neighbors"

    # Test: distance is symmetric
    for a in grid.all_hexes()[:10]:
        for b in grid.all_hexes()[:10]:
            assert a.distance_to(b) == b.distance_to(a), f"Asymmetric distance: {a}->{b}"

    # Test: cube constraint holds
    for hex in grid.all_hexes():
        if hasattr(hex, 'x') and hasattr(hex, 'y') and hasattr(hex, 'z'):
            assert hex.x + hex.y + hex.z == 0, f"Constraint violation: {hex}"

    # Test: range query produces correct count
    for radius in range(1, 10):
        center = grid.hex_at(0, 0)
        in_range = center.hexes_in_range(radius)
        expected = 3 * radius * (radius + 1) + 1
        assert len(in_range) == expected, f"Range {radius}: got {len(in_range)}, expected {expected}"

    print("All tests passed!")
```

## Production Tips

After shipping hex-based games to real users, here's practical advice that doesn't make it into the tutorials:

- **Coalesce unit movements.** When 20 units all need to pathfind simultaneously, queue them and process 5 per frame. The CPU budget for pathfinding is ~2ms per frame at 60fps. A* for a single unit takes 0.1-0.5ms on a 128x128 map.
- **Cache path results.** Units often path to the same destination (a resource node, an enemy formation). Cache the path and only recalculate when obstacles change.
- **Use Manhattan bounds for range queries.** Before running a full hex-in-range query, calculate the hex's axial bounds and filter with simple integer comparisons. This eliminates 60% of hexes from the search space immediately.
- **Prefer lookup tables for small maps.** For tactical maps (< 1000 hexes), precompute and cache all distances in a 2D array. The memory cost is negligible and the runtime is O(1).

The beauty—and frustration—of hex math is that it's simple once you understand the geometry, but unforgiving when you get it wrong. A single sign error in a direction vector can produce a grid that looks right but computes wrong distances for every unit on the map. Test your implementation rigorously, render the coordinates during development, and trust the formulas over your visual intuition.

Master these formulas and your grid-based systems become both correct and fast. The difference between a naive implementation and an optimized one can be 100x in query time—which is the difference between a game that works and a game that ships.
