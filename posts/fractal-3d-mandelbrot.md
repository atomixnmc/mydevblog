# 3D Mandelbrot and Mandelbulb

The Mandelbulb is a 3D analogue of the Mandelbrot set, discovered in 2009 by Daniel White and Paul Nylander. While the true 3D Mandelbrot (a quaternion-based set) exists mathematically, it produces uninteresting shapes — the Mandelbulb uses a different power formula that yields the stunning bulbous structures we recognize.

The breakthrough formula raises a 3D point to a power using spherical coordinates. Given a point `(x, y, z)`, convert to spherical `(r, θ, φ)`. Raise the radius to power `n`, multiply angles by `n`, then convert back to Cartesian:

```glsl
void mandelbulb(inout vec3 z, int power) {
    float r = length(z);
    float theta = acos(z.z / r) * power;
    float phi = atan(z.y, z.x) * power;
    z = pow(r, power) * vec3(
        sin(theta) * cos(phi),
        sin(theta) * sin(phi),
        cos(theta)
    );
}
```

The iteration checks if `r` exceeds the bailout threshold. If it does, the point is outside the set. The coloring follows escape-time algorithms adapted to 3D.

Rendering the Mandelbulb requires ray marching with distance estimation. The distance estimator for the Mandelbulb uses the derivative of the iteration function. This gives a conservative estimate of the distance to the nearest surface, allowing efficient sphere tracing through empty space.

The power parameter `n` dramatically changes the shape. Power 2 creates the classic bulb with 2-fold symmetry. Power 8 creates intricate 8-fold spiraling structures. Each power value produces a unique variant with different symmetries and detail distributions.

Performance optimization techniques include: dynamic step sizing based on iteration depth, bounding sphere checks, and adaptive sampling (more samples near complex regions). GPU implementations in GLSL or CUDA achieve real-time navigation of power-8 Mandelbulbs at 1080p.

The Mandelbulb remains the most popular 3D fractal for artistic exploration. Its organic, coral-like structures are endlessly varied and visually stunning.
