# Fractal Noise for Terrain

Fractal noise is the foundation of procedural terrain generation. By layering multiple octaves of noise (typically Perlin, Simplex, or Value noise) at different frequencies and amplitudes, you create realistic, non-repeating landscapes that exhibit detail at all scales.

The technique is called fractional Brownian motion (fBm). The formula is simple:

```
height(x, y) = Σ (amplitude_i * noise(frequency_i * x, frequency_i * y))
```

Each octave doubles the frequency and halves the amplitude. The first octave defines the large-scale terrain features (mountains, valleys). Higher octaves add increasingly fine detail (ridges, rocks, gravel). The sum produces a self-similar signal — zooming in reveals similar complexity at smaller scales.

The `lacunarity` parameter controls how much frequency increases per octave (typically 2.0). The `gain` (or persistence) controls amplitude decay (typically 0.5). Adjusting these parameters changes the terrain character. High lacunarity creates jagged, spikey terrain. High gain produces rough terrain with dominant high-frequency detail.

Domain warping layers noise on noise. Instead of directly sampling `noise(x, y)`, you warp the coordinates through another noise field: `noise(x + noise(x, y), y + noise(x, y) * 0.5)`. This creates organic, flowing patterns that avoid the axis-aligned artifacts of basic fBm. Multiple warping iterations produce increasingly surreal landscapes.

Ridged noise is a variant that produces sharp valleys and smooth plateaus. Take the absolute value of the noise signal and invert it: `1 - abs(noise(x, y))`. This creates the characteristic ridge lines seen in mountain ranges. Combining fBm with ridged noise at different octaves gives realistic canyon and mountain landscapes.

Terrain coloring typically maps elevation to bands: water (blue), sand (beige), grass (green), rock (gray), snow (white). Adding slope-based blending prevents banding artifacts at elevation boundaries.

Performance considerations: 8 octaves of 2D Perlin noise requires 16 lookups per sample. For real-time terrain, GPU Compute shaders evaluate noise in parallel, generating heightmaps at interactive rates.
