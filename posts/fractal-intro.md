# Fractals in Code: Exploring the Mandelbrot and Julia Sets

Fractals are where mathematics meets visual art. The Mandelbrot set is the most famous: a deceptively simple iteration that produces infinite complexity. The formula is `z = z² + c`, where both `z` and `c` are complex numbers. Whether a point escapes to infinity or stays bounded determines its colour.

The core loop is tiny, but the output is endless:

```c
int mandelbrot(double cx, double cy, int maxIter) {
    double zx = 0.0, zy = 0.0;
    int iter = 0;
    while (zx * zx + zy * zy < 4.0 && iter < maxIter) {
        double xtemp = zx * zx - zy * zy + cx;
        zy = 2.0 * zx * zy + cy;
        zx = xtemp;
        iter++;
    }
    return iter;
}
```

For each pixel in the image, map `(x, y)` to the complex plane—typically `cx` from -2.5 to 1.5, `cy` from -1.5 to 1.5—and run the iteration. The number of iterations before `|z| > 2` (the bailout threshold) maps to a colour gradient. Points inside the set (never escaping) stay black.

**Julia sets** are the Mandelbrot's cousin. The difference is subtle but important: for Mandelbrot, `c` varies per pixel and `z` starts at 0. For Julia, `c` is fixed and `z` varies per pixel. Each point in the Mandelbrot plane has a corresponding Julia set. The Julia set is connected when `c` is inside the Mandelbrot set; disconnected (Cantor dust) when outside.

Optimisations that matter:
- **Perturbation theory** for deep zooms (beyond 1e6 magnification). Instead of computing full precision for each pixel, compute a reference orbit at high precision and derive nearby pixels with low-precision deltas.
- **Distance estimation** for smooth colouring. Replace the discrete iteration count with a continuous value using the derivative of `z`.
- **Boundary tracing** to accelerate rendering. Only iterate points near the set boundary; skip solid interior areas.

Writing a Mandelbrot renderer is a rite of passage. Start with 256 iterations, add a smooth colour palette, and you'll see why people spend years exploring one equation.
