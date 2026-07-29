# Menger Sponge 3D Fractal

The Menger sponge is a 3D generalization of the Sierpinski carpet, one of the most recognizable 3D fractals. It's a fractal curve with infinite surface area but zero volume, constructed through recursive subtraction of cube-shaped voids.

Construction starts with a solid cube divided into 27 subcubes (3×3×3 grid). Remove the center cube of each face and the center cube of the entire block — 7 cubes removed, 20 remain. Repeat the process on each remaining cube. After infinite iterations, the Menger sponge emerges.

Level 1 has 20 cubes. Level 2 has 400 cubes. Level 3 has 8,000 cubes. The count follows 20ⁿ where n is the iteration depth. The fractal dimension is log(20)/log(3) ≈ 2.727 — it's more than a surface but less than a volume.

Rendering the Menger sponge efficiently requires special techniques. Naively storing all cubes as individual meshes becomes impractical beyond level 3. Ray marching in a fragment shader is the standard approach. The distance function for a Menger sponge is computed by iteratively subtracting the void regions from an initial box SDF:

```glsl
float mengerSDF(vec3 p) {
    float d = boxSDF(p, vec3(1.0));
    for (int i = 0; i < 4; i++) {
        vec3 a = mod(p * 3.0, 2.0) - 1.0;
        d = max(d, -boxSDF(a, vec3(1.0/3.0)));
        p *= 3.0;
    }
    return d;
}
```

This SDF approach renders any iteration depth smoothly — the limiting factor is GPU computation time, not memory. Marching steps increase exponentially with iteration depth, so optimization is critical.

Applications extend beyond art. The Menger sponge's self-similar structure inspires antenna designs (fractal antennas achieve multi-band resonance), heat sink geometry, and acoustic dampening panels. The mathematics of the sponge connects to Cantor sets, cellular automata, and iterated function systems.
