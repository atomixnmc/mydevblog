# Tiled Maps in libGDX

libGDX provides robust support for Tile Maps through its Tiled integration. The `com.badlogic.gdx.maps.tiled` package lets you load `.tmx` files created with the Tiled map editor and render them efficiently for 2D games.

Loading a map is straightforward:

```java
TiledMap map = new TiledMapLoader().load("map.tmx");
OrthogonalTiledMapRenderer renderer =
    new OrthogonalTiledMapRenderer(map);
```

The map contains layers (tile layers, object layers, image layers), tilesets, and custom properties. Each tile layer holds a grid of cell references. The renderer batches tiles by texture, minimizing draw calls. For large maps, libGDX supports frustum culling automatically — only visible tiles are rendered.

Object layers let you place collision boxes, spawn points, triggers, and other game entities directly in the map editor. Combined with the map's custom property system (key-value pairs on tiles, layers, or the map itself), this creates a data-driven level design pipeline. You can define which tiles are walkable, which trigger damage, and which scrollers appear behind the player.

LibGDX supports orthogonal, isometric, and hexagonal tile maps. Isometric maps use staggered coordinates and require an isometric renderer. The hexagonal map support handles both pointy-top and flat-top orientations.

Performance tips: use texture atlases for tilesets to minimize texture binds. Avoid mixing too many tilesets on one layer. For scrolling parallax backgrounds, render map layers at different camera scales. The layer system makes this trivial — just adjust each layer's opacity or offset before rendering.

Tiled maps integrate with libGDX's Box2D physics, AI pathfinding, and particle systems through the extensible map property system.
