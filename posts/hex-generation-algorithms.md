# Procedural Hex Generation

Procedurally generating hexagonal maps requires algorithms that place terrain biomes, elevation, and features across a hex grid. The process combines noise functions, graph algorithms, and game design rules to create interesting, playable maps.

The first step is generating elevation using fractal noise sampled at hex centers. For each hex in the grid, evaluate `fbm(x, y)` to get a height value. Thresholds classify terrain: deep water, shallow water, beach, grassland, forest, mountain, and snow. The thresholds should create plausible geography — mountains near the center of landmasses, oceans on the edges.

Rainfall is the second layer. Wind patterns combined with elevation determine precipitation. Mountains create rain shadows — one side gets heavy rain (forests, rivers), the other side stays dry (deserts, plains). Simulate this by tracking prevailing wind direction and reducing moisture as air rises over elevation.

Hex features add detail. Rivers flow from high elevation to sea level along the steepest descent path. Start river seeds at high-elevation hexes and follow the gradient, merging rivers when they're adjacent. Rivers add tactical significance to maps — crossing points become chokepoints.

Biomes emerge from elevation and rainfall combinations. High elevation + low rainfall = desert. High elevation + high rainfall = forest. Medium elevation + moderate rainfall = plains. Moderate elevation + high rainfall = swamp. Each biome can have sub-types with different gameplay properties: movement cost, visibility, resource yield.

Procedural generation quality depends on parameter tuning. The noise seed controls landmass shape. Frequency controls continent size (lower frequency = larger continents). Octave count controls detail level. Persistence controls roughness.

Validation ensures playability: all players have access to similar resources, starting positions are balanced, and the map has no impassable barriers that block progression. These rules transform noise into game-ready maps.
