# Fractal Flames: The Algorithm Behind Apophysis

Fractal flames, popularised by the Apophysis and Chaotica renderers, extend IFS fractals with non-linear variations, colour gradients, and log-density filtering. The result is the distinctive "flame" aesthetic—swirling organic shapes with smooth colour transitions. The algorithm is three innovations layered on basic IFS.

**Innovation 1: Non-linear variations.** Instead of applying only affine transforms, each transform applies a function from a library of variations—sinusoidal, spherical, swirl, heart, bubble—to warp the point after the affine step:

```c
typedef struct { float a, b, c, d, e, f; int varIndex; float weight; } XForm;

void applyXForm(XForm *xf, float *x, float *y) {
    // Affine transform
    float nx = xf->a * (*x) + xf->b * (*y) + xf->e;
    float ny = xf->c * (*x) + xf->d * (*y) + xf->f;

    // Apply variation
    switch (xf->varIndex) {
        case 0: // Linear (identity)
            *x = nx; *y = ny; break;
        case 1: // Sinusoidal
            *x = sin(nx); *y = sin(ny); break;
        case 2: // Spherical
            float r2 = nx*nx + ny*ny + 1e-10;
            *x = nx / r2; *y = ny / r2; break;
        case 3: // Swirl
            float r = nx*nx + ny*ny;
            *x = nx * sin(r) - ny * cos(r);
            *y = nx * cos(r) + ny * sin(r); break;
        case 4: // Horseshoe
            float r = 1.0 / sqrt(nx*nx + ny*ny + 1e-10);
            *x = (nx - ny) * (nx + ny) * r;
            *y = 2 * nx * ny * r; break;
    }
}
```

**Innovation 2: Colour mapping**. Each transform specifies a colour coordinate (0–1). As points land on the image, they accumulate with their colour coordinate. The log-density buffer normalises the accumulation: instead of `pixel[x][y] += 1`, use `pixel[x][y] += (1 - pixel[x][y]) * (1 - alpha)` for smooth blending. After all points are rendered, apply a log scale to the density buffer and map through a gradient palette.

**Innovation 3: Filtering and post-processing**. Raw point accumulation produces a noisy image at low sample counts. Apply a **spatial filter** (Gaussian blur or a sharpening pass) and a **gamma curve** to adjust brightness distribution:

```
final_color = palette(log(density[x][y]) * gamma, colour_coord)
```

The render loop runs millions of iterations. A high-quality flame might use 10 million points per frame, accumulating into a buffer, then applying filtering as a post-process.

Implementing flame fractals from scratch teaches you about Monte Carlo accumulation, colour spaces, and the relationship between ergodicity and visual density. The Apophysis source code (free, open) is an excellent reference for the variations catalogue—over 100 variations, each producing distinct visual character.
