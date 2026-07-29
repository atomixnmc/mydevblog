# Hex Map Rendering: From Coordinates to Screen

Rendering a hex map involves transforming logical hex coordinates into pixel positions and drawing the correct tile textures. The two core problems: picking the right tile vertex layout and efficiently culling off-screen hexes. Get these right, and your map renders at 60fps even at 10,000 tiles.

The vertex layout for a hex is a regular hexagon centred at the tile position. For a pointy-topped hex (pointing up), vertices are computed as:

```js
function hexVertices(centerX, centerY, size) {
  const vertices = [];
  for (let i = 0; i < 6; i++) {
    const angle = Math.PI / 180 * (60 * i - 30); // Pointy-top: rotate by -30°
    vertices.push({
      x: centerX + size * Math.cos(angle),
      y: centerY + size * Math.sin(angle)
    });
  }
  return vertices;
}
```

For flat-topped hexes, the angle formula drops the `-30` shift—the first vertex points right instead of up.

**Texture mapping** varies by approach. The simplest method uses a triangle fan from the hex centre—six triangles per hex. Texture coordinates map each triangle to a third of the tile atlas. This works but wastes GPU time on fully uniform-colour interiors. A more efficient approach uses geometry shaders or instanced rendering with a single hex mesh, transforming it with a model matrix per hex.

```js
// Instanced rendering pseudo-code
const hexMesh = createHexMesh(); // Single hex, size=1
const instances = [];

for each hex in visible hexes {
  const pos = hexToPixel(hex.q, hex.r, tileSize);
  instances.push({
    modelMatrix: mat4.translate(pos.x, pos.y),
    texCoordOffset: getTileUV(hex.terrainType), // Offset into texture atlas
  });
}

drawInstanced(hexMesh, instances);
```

**Visibility culling** is essential beyond 1000 hexes. Convert the camera frustum or viewport bounds back into hex coordinates and only iterate visible tiles:

```js
function visibleHexes(camera, mapRadius) {
  // Get viewport corners in world space, convert to hex coordinates
  const corners = camera.getFrustumCorners();
  const hexCorners = corners.map(p => pixelToHex(p.x, p.y));
  // Compute bounding hex range
  const minQ = Math.min(...hexCorners.map(h => h.q));
  const maxQ = Math.max(...hexCorners.map(h => h.q));
  const minR = Math.min(...hexCorners.map(h => h.r));
  const maxR = Math.max(...hexCorners.map(h => h.r));
  // Iterate the rectangular region
  for (let q = minQ; q <= maxQ; q++) {
    for (let r = minR; r <= maxR; r++) {
      if (isValidHex(q, r) && isInRadius(q, r, mapRadius)) {
        renderHex(q, r);
      }
    }
  }
}
```

A quad-tree or spatial hash grid further reduces iteration for sparse maps (e.g., fog of war or partially revealed terrain). For height maps, offset vertices on the y-axis using a noise function before rendering—this gives 3D terrain without changing the hex coordinate logic.

The rendering pipeline applies per-vertex colour blending for altitude tinting, edge highlighting for selection, and minimap generation. Once the coordinate-to-pixel bridge is solid, all these features layer on cleanly.
