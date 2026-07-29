# Hex Grid Geometry: The Foundation for Tile-Based Games

Hex grids appear in strategy games from Civilisation to BattleTech for one reason: hexagons tile the plane with equal-distance neighbours. Unlike square grids where diagonal distance complicates movement, each hex has six neighbours at a uniform distance. Getting the coordinate system right upfront saves massive refactoring later.

The most practical system for game development is **axial coordinates** `(q, r)`. Think of them as cube coordinates projected onto a plane: `q = x`, `r = z`, and the third axis `s = -q - r` is derived but useful for symmetry. Movement in axial space uses clean vector arithmetic:

```js
// Cube coordinate neighbours for flat-topped hexes
const CUBE_DIRECTIONS = [
  { q: 1, r: 0, s: -1 }, { q: 1, r: -1, s: 0 }, { q: 0, r: -1, s: 1 },
  { q: -1, r: 0, s: 1 }, { q: -1, r: 1, s: 0 }, { q: 0, r: 1, s: -1 }
];

function hexNeighbor(hex, direction) {
  const d = CUBE_DIRECTIONS[direction];
  return { q: hex.q + d.q, r: hex.r + d.r };
}

function hexDistance(a, b) {
  return (Math.abs(a.q - b.q) + Math.abs(a.r - b.r)
        + Math.abs(-a.q - a.r + b.q + b.r)) / 2;
}
```

The two hex orientations—**pointy-topped** and **flat-topped**—determine your layout. Pointy-topped hexes have vertical columns; flat-topped have horizontal rows. The conversion from axial `(q, r)` to pixel centre coordinates differs for each:

```js
// Flat-topped hex to pixel
function hexToPixel(q, r, size) {
  const x = size * (3 / 2 * q);
  const y = size * (Math.sqrt(3) / 2 * q + Math.sqrt(3) * r);
  return { x, y };
}
```

**Offset coordinates** (even-r, odd-r) are easier for rectangular maps stored in a 2D array. Convert to axial for logic, offset for rendering. The column parity determines the vertical offset: even columns have hexes shifted up, odd columns shifted down.

Key formula to keep handy: hex width = `2 * size` (pointy-top) or `sqrt(3) * size` (flat-top). Hex height = `sqrt(3) * size` (pointy-top) or `2 * size` (flat-top). With these, your hex atlas routines practically write themselves.
