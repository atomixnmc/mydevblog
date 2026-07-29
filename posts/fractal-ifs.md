# Iterated Function Systems: Building Fractals with Affine Transforms

Iterated Function Systems (IFS) are the hidden engine behind much of the fractal art you've seen—from fern leaves to tree branches to abstract flame patterns. The concept is elegant: start with any point in the plane, repeatedly apply one of several affine transformations chosen at random, and watch a fractal emerge from chaos.

The classic example is Barnsley's fern. Four transforms define the structure: stem (stays in place, narrows), lower leaflets (tilt left, shrink), upper leaflets (tilt right, shrink), and the main frond (narrows and moves up). Each transform has a probability weight—the stem gets 1%, the leaflets get 85%, and the frond gets 7% each.

```python
import random, math

def barnsley_fern(n_points=50000):
    x = y = 0.0
    points = []
    for _ in range(n_points):
        points.append((x, y))
        r = random.random()
        if r < 0.01:           # Stem
            x, y = 0, 0.16 * y
        elif r < 0.86:         # Small leaflets
            x, y = (0.85 * x + 0.04 * y,
                    -0.04 * x + 0.85 * y + 1.6)
        elif r < 0.93:         # Left leaflet
            x, y = (0.2 * x - 0.26 * y,
                    0.23 * x + 0.22 * y + 1.6)
        else:                  # Right leaflet
            x, y = (-0.15 * x + 0.28 * y,
                    0.26 * x + 0.24 * y + 0.44)
    return points
```

The **chaos game** algorithm (above) converges to the fractal's attractor—the set of points that the IFS maps to itself. The more points you plot, the finer the detail. At 50,000 points you see the fern structure; at 500,000, the tiny self-similar leaflets become visible.

The affine transforms are stored as 2×2 matrices with translation vectors:

```
[ a  b ] [x] + [e]
[ c  d ] [y]   [f]
```

The coefficients `a` through `f` control rotation, scaling, shearing, and translation. Complex fractals from the `flam3` ecosystem use hundreds of transforms with non-linear variations (sinusoidal, spherical, swirl) blended per-point.

Every IFS fractal is a compact representation of infinite complexity. The 24 coefficients of Barnsley's fern encode a structure that would take megabytes as geometry—but renders from 100 bytes of transform data.
