# R\*-Tree Spatial Indexing

The R\*-Tree is a balanced tree data structure for spatial indexing, designed for efficient querying of multidimensional data. It improves on the original R-Tree by using a sophisticated insertion strategy that minimizes overlap between bounding boxes, which directly impacts query performance.

The core idea: each node in the tree has a bounding rectangle that encloses all its children. The tree is balanced — all leaf nodes are at the same depth. Queries traverse the tree by testing intersection with each node's bounding box, only descending into children whose boxes intersect the query region.

R\*-Tree's key innovation is the reinsertion strategy. When a node overflows, instead of immediately splitting it, the algorithm removes a percentage of entries (typically 30%) and reinserts them. This often finds a better arrangement than splitting alone. If reinsertion still causes overflow, the node splits using a criteria that minimizes overlap and maximizes compactness.

The split algorithm evaluates multiple distributions along each dimension. It calculates the cost of each split based on bounding box area, margin, and overlap. The dimension with the lowest overall cost wins. This multi-criteria optimization produces tighter bounding boxes than the original R-Tree.

Performance characteristics: R\*-Tree suits point data, rectangles, and arbitrary polygons through bounding box approximation. Nearest-neighbor searches use a priority queue, checking the most promising branches first. Range queries benefit from the reduced overlap — fewer false-positive branches to explore.

Applications include geospatial databases (PostGIS uses it), game engine spatial queries, collision detection, and any system that needs fast lookup of objects in 2D or 3D space. The R\*-Tree achieves good query performance at the cost of slightly more expensive insertions compared to simpler spatial structures.
