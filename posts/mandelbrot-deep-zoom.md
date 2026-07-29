# Deep Mandelbrot Zoom: Beyond Double Precision

Exploring the Mandelbrot set at high magnification (1e10 and beyond) reveals the set's infinite intricacy—but also reveals the limits of 64-bit floating point. At zoom levels past 1e13, `double` precision runs out, pixels become blocky, and the fractal degenerates into uncoloured bands or false patterns. The solution is perturbation theory.

**The problem**: Standard Mandelbrot iteration uses 64-bit doubles. The complex plane coordinate `c` for a pixel at zoom 1e15 is something like `(0.2500012345678901, 0.0000000000000001)`. Adding these tiny values to `z²` loses precision. After a few iterations, `z` becomes meaningless.

**Perturbation theory** solves this by computing one high-precision reference orbit, then deriving nearby pixels using low-precision deltas. The reference orbit is computed with high precision (arbitrary-precision integers or `MPFR`). Pixel rays are computed with normal doubles as perturbations relative to the reference.

```c
// Perturbation iteration: reference at high precision
// For each pixel, compute delta = z_pixel - z_reference
// Iterate using small deltas
void perturbed_iteration(double dcx, double dcy,
    double zrx[], double zry[], int max_iter, int* output) {
    double dx = 0, dy = 0;
    for (int n = 0; n < max_iter; n++) {
        // z² + c in delta form
        double dx2 = 2 * zrx[n] * dx - 2 * zry[n] * dy + dx*dx - dy*dy + dcx;
        double dy2 = 2 * zrx[n] * dy + 2 * zry[n] * dx + 2*dx*dy + dcy;
        dx = dx2; dy = dy2;
        if (dx*dx + dy*dy > 1e16) { // |z|² bailout
            output[n] = 0; // escaped
            return;
        }
    }
}
```

Beyond perturbation, **series approximation** skips iterations entirely for pixels that move predictably. The pixel's orbit is approximated by a truncated Taylor series of the reference orbit for the first few dozen iterations, then falls back to perturbation iteration. This speeds up deep zooms by 100–1000×.

**Practical pipeline**: Use a C library like Kalles Fraktaler or write your own using GMP/MPFR for the reference (100–200 bits of precision) and native doubles for pixel computation. The reference runs once per image; each pixel is ~50 iterations of cheap double arithmetic instead of 10000+ iterations of expensive big-number arithmetic.

A well-optimised deep zoom renderer can explore 1e50+ regions in minutes per frame rather than days. The Mandelbrot set doesn't end—it becomes arbitrarily intricate at every scale.
