# Field of View on Hex Grids

Field of view (FOV) on hexagonal grids is essential for tactical games where units should only see what's in line of sight. The geometry of hex grids requires a different approach than square-grid FOV algorithms.

The most common approach for hex FOV is recursive shadowcasting, adapted from square grids. The algorithm divides the viewing area into six 60-degree octants (corresponding to the six hex directions). For each octant, it casts rays from the origin outward, tracking which angles are blocked by obstacles.

In cube coordinates, the ray direction for each octant is one of the six primary directions: `(1, -1, 0)`, `(1, 0, -1)`, `(0, 1, -1)`, `(-1, 1, 0)`, `(-1, 0, 1)`, `(0, -1, 1)`. Each step moves one hex in the direction and one hex perpendicular, creating proper shadow boundaries.

The key insight: on a hex grid, each hex occupies a range of angles from the viewer. The algorithm maintains a list of shadow intervals (start angle, end angle). For each hex, if its entire angular span falls within any shadow interval, it's blocked. If partially visible, it's partially visible. This gives smooth, realistic FOV.

Precision mode uses fractional angles for sub-hex shadow casting. This prevents the "keyhole" effect where thin gaps between obstacles are fully visible. Instead, a hex is visible only to the extent that its angle range is unshadowed.

Performance is excellent — O(n) where n is the number of hexes in the maximum view radius. The recursive form visits each hex at most once. For roguelikes and turn-based tactics with view radii of 10-30 hexes, this runs in microseconds.

The OpenRogue community has refined hex FOV extensively, with implementations in C++, Python, and JavaScript available as reference.
