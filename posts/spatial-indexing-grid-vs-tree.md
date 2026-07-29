# Grid vs Tree Spatial Indexing

Spatial indexing structures fall into two broad families: grid-based (uniform grids, spatial hashing) and tree-based (quadtrees, R-Trees, KD-Trees). Each has strengths and weaknesses that make it suitable for different workloads.

A uniform grid divides space into fixed-size cells. Each cell stores a list of objects that overlap it. Queries check cells that intersect the query region. The grid is simple and cache-friendly — cell lookup is O(1). Grid performance depends on cell size relative to object size. Too coarse: many objects per cell, slow queries. Too fine: many empty cells, memory waste.

Spatial hashing improves on grids by using a hash map keyed by cell coordinates. Instead of allocating a dense array (wasteful for sparse distributions), it only stores occupied cells. This makes spatial hashing ideal for dynamic scenes where objects move frequently. The hash is typically `(x / cellSize) + (y / cellSize) * largePrime`.

Tree-based structures adapt to data distribution. The quadtree recursively subdivides space, creating deeper subdivisions where more objects exist. A quadtree query is O(log n + k) where k is the result count. The trade-off: tree construction adds overhead, and moving objects requires restructuring.

R-Trees group nearby objects into bounding boxes, then group bounding boxes hierarchically. They handle non-point objects naturally. The R*-Tree variant minimizes box overlap for better query performance. Bulk-loading (sorting by Hilbert curve or STR packing) creates better trees than incremental insertion.

For static geometry (collision maps, terrain), grids are fast and memory-efficient. For dynamic objects with heterogeneous sizes (game entities, physics bodies), spatial hashing balances simplicity with performance. For range queries with complex data distributions (GIS, point clouds), quadtrees or R-Trees deliver consistent performance.

Hybrid approaches are common: a coarse grid for broad phase, with tree structures within each cell for fine phase. This combines the memory efficiency of grids with the adaptability of trees.
