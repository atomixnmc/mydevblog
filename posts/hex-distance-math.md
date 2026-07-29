# Hex Distance and Range Math

Hexagonal grids are a staple of strategy games, but the math for distance and range differs from Cartesian grids. Understanding hex coordinate systems is essential for implementing movement ranges, attack radii, and field-of-view on hex maps.

There are three primary coordinate systems for hex grids: offset coordinates (like square grids but staggered), cube coordinates (3-axis with constraint `x + y + z = 0`), and axial coordinates (two axes derived from cube). Cube coordinates make distance calculations trivial: the distance between two hexes is half the Manhattan distance, computed as `(|dx| + |dy| + |dz|) / 2`. Axial coordinates use two axes (q, r) and the distance formula becomes `(|dq| + |dr| + |dq + dr|) / 2`.

For range queries — finding all hexes within a given radius — you iterate over a cube-coordinate cube and apply the constraint. The ring at distance `N` contains exactly `6 * N` hexes. For line-of-sight and field-of-view, algorithms like recursive shadowcasting adapt naturally to hex grids once you define the six directional vectors.

Performance matters when computing ranges for many units. Precomputing hex-to-hex distances in a lookup table works for static maps. For dynamic calculations, cube coordinates keep the math cheap — just integer addition and division by two.

The beauty of hex math is that it transforms a seemingly complex problem into elegant geometry. Master these formulas and your grid-based systems become both correct and fast.
