# Buddhabrot Rendering

The Buddhabrot is a variation of the Mandelbrot set that produces ethereal, meditative images resembling meditating figures. Unlike the standard Mandelbrot visualization, which colors points based on escape speed, the Buddhabrot records the trajectories of escaping points.

The algorithm works by iterating the classic Mandelbrot function `z = z² + c`. For each starting point `c` that escapes, every point along its orbit path gets a "hit" recorded. After millions of samples, these accumulated hits form a probability density map. The resulting image shows the paths that escaping points travel through, revealing structure invisible in standard renders.

Rendering a high-quality Buddhabrot is computationally expensive. A typical 4K render may require billions of samples. Optimization techniques include stratified sampling (focusing on interesting regions), anti-aliasing via jittered subpixel samples, and early rejection of points that clearly belong to the Mandelbrot set interior. The number of iterations matters deeply: low-iteration renders show smooth outer glow, while high-iteration renders reveal fine inner detail.

Modern approaches use GPU compute shaders or OpenCL kernels. Each thread handles one sample point, accumulating hits into a shared histogram. Atomic operations on the histogram buffer are the bottleneck, so many implementations use thread-local histograms merged after rendering passes.

The result — a glowing, smoke-like fractal — rewards patience. The Buddhabrot teaches that sometimes beauty emerges not from the points that stay, but from the paths of those that fly away.
