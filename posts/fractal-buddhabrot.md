# Buddhabrot Rendering

The Buddhabrot is a variation of the Mandelbrot set that produces ethereal, meditative images resembling meditating figures. Unlike the standard Mandelbrot visualization, which colors points based on escape speed, the Buddhabrot records the trajectories of escaping points.

I first encountered the Buddhabrot in 2008 on a fractal forum, rendered at 800x600 with maybe a million samples. Even at that low resolution, the image was breathtaking—a smoky, luminous form emerging from pure math. Twelve years later, I was writing GPU compute shaders to render it at 8K with 100 billion samples. The math hasn't changed. The hardware has.

## The Algorithm: Trajectory, Not Escape Time

The standard Mandelbrot render evaluates z₀ = 0, then iterates zₙ₊₁ = zₙ² + c for each pixel c. If |z| exceeds the bailout radius (typically 2), the pixel escapes, and the color is determined by how many iterations it took. Points that never escape belong to the Mandelbrot set.

The Buddhabrot does something fundamentally different. For each starting point c, if it escapes, we record every point along its orbit path—not just whether it escaped. Each point on the orbit increments a counter at the corresponding screen position. After millions of samples, these accumulated counts form a probability density map showing where escaping trajectories travel.

```glsl
// GLSL fragment shader for Buddhabrot samples (simplified)
#version 430

layout(local_size_x = 64, local_size_y = 1, local_size_z = 1) in;

layout(std430, binding = 0) buffer Histogram {
    uint histogram[];
};

uniform vec2 center;
uniform float zoom;
uniform int maxIterations;
uniform int totalSamples;

void main() {
    uint sampleIndex = gl_GlobalInvocationID.x;
    if (sampleIndex >= totalSamples) return;

    // Generate random c value in the complex plane
    uint seed = sampleIndex * 2654435761u;
    float x = (float(rand(&seed)) - 0.5) * 4.0 / zoom + center.x;
    float y = (float(rand(&seed)) - 0.5) * 4.0 / zoom + center.y;

    float zx = 0.0, zy = 0.0;
    int iter = 0;

    // Iterate the Mandelbrot function
    while (zx * zx + zy * zy < 4.0 && iter < maxIterations) {
        float temp = zx * zx - zy * zy + x;
        zy = 2.0 * zx * zy + y;
        zx = temp;

        // Record every point along the orbit
        // Map complex coordinates to pixel coordinates
        uint px = uint((zx - center.x + 2.0) * zoom * (width / 4.0));
        uint py = uint((zy - center.y + 2.0) * zoom * (height / 4.0));

        if (px < width && py < height) {
            atomicAdd(histogram[py * width + px], 1);
        }
        iter++;
    }
}
```

The critical difference from standard Mandelbrot: every iteration of the inner loop potentially increments the histogram, not just the final escape decision. This means the computational cost scales with `samples × average_escape_iterations`.

## The Sampling Challenge

Rendering a high-quality Buddhabrot is computationally expensive. A typical 4K render (3840x2160) has roughly 8.3 million pixels. Each pixel needs thousands of samples to converge to a smooth density. A 100-billion-sample render is not unusual for a high-quality image.

The distribution of samples across the complex plane is critical. Points near the Mandelbrot set boundary take many iterations to escape, producing long orbit paths that contribute many hits. Points far from the set escape quickly and contribute few hits. This creates an inherent sampling inefficiency: most compute time goes to the most detailed regions (which is good), but random sampling wastes many samples on regions that contribute little.

```python
# Sampling strategy comparison
import random, math

class BuddhabrotSampler:
    def uniform_sampling(self, width, height, bounds):
        """Standard approach: uniform random samples"""
        return [
            complex(
                random.uniform(bounds[0], bounds[1]),
                random.uniform(bounds[2], bounds[3])
            )
            for _ in range(self.samples_per_pass)
        ]

    def stratified_sampling(self, width, height, bounds):
        """Stratified: grid-based jittered samples"""
        grid_size = int(math.sqrt(self.samples_per_pass))
        samples = []
        for i in range(grid_size):
            for j in range(grid_size):
                x = bounds[0] + (i + random.random()) / grid_size * (bounds[1] - bounds[0])
                y = bounds[2] + (j + random.random()) / grid_size * (bounds[3] - bounds[2])
                samples.append(complex(x, y))
        return samples

    def importance_sampling(self, histogram, bounds):
        """Adaptive: concentrate samples on high-activity regions"""
        # Find regions with high histogram variance
        # Sample more densely there
        pass
```

## Optimization Techniques

After rendering hundreds of Buddhabrot images, I've settled on a pipeline that balances quality and render time:

**Stratified sampling** divides the sampling region into a grid and jitters samples within each cell. This reduces variance significantly compared to pure random sampling for the same sample count. The improvement is roughly equivalent to 2-4x more samples.

**Early rejection** identifies points that clearly belong to the Mandelbrot set interior (cardioid and bulb checking) and skips them. The Mandelbrot set has a known mathematical structure: the main cardioid is defined by `|c| ≤ 0.5` and the period-2 bulb by `|c + 1| ≤ 0.25`. Quick bounds checks reject about 20% of samples before any iteration.

```python
def early_reject(c):
    """Quick rejection of points in known Mandelbrot set regions"""
    x, y = c.real, c.imag

    # Main cardioid check
    q = (x - 0.25) ** 2 + y ** 2
    if q * (q + (x - 0.25)) <= 0.25 * y ** 2:
        return True  # In the set, skip

    # Period-2 bulb check
    if (x + 1) ** 2 + y ** 2 <= 0.0625:
        return True  # In the set, skip

    return False
```

**Iteration binning** splits the histogram into iteration bands. Low-iteration orbits (10-100) contribute to a global glow effect. Medium-iteration orbits (100-1000) reveal the main structure. High-iteration orbits (1000+) produce fine detail. By maintaining separate histograms and blending them with different transfer functions, you get images with both deep detail and smooth atmosphere.

## GPU Implementation Details

Modern Buddhabrot rendering demands GPU compute. My implementation uses OpenCL (for cross-platform compatibility) with the following architecture:

- **Work-group size**: 64 or 128 threads per group. This balances occupancy with register pressure.
- **Per-thread histogram**: Each thread accumulates hits in a local histogram stored in LDS (local data share). At the end of the pass, thread-local histograms are merged via atomic operations.
- **Double buffering**: While one kernel pass accumulates, the previous pass's histogram is processed by the CPU for display.

```opencl
// OpenCL kernel with local histogram
__kernel void buddhabrot_pass(
    __global uint* global_hist,
    const int width,
    const int height,
    const float2 center,
    const float zoom,
    const int max_iter,
    const int samples_per_thread
) {
    // Local histogram in LDS
    __local uint local_hist[LOCAL_HIST_SIZE];

    int gid = get_global_id(0);
    uint rng_state = gid * 1103515245u + 12345u;

    for (int s = 0; s < samples_per_thread; s++) {
        // Generate random c
        float cx = (rng_state / (float)UINT_MAX - 0.5f) * 4.0f / zoom + center.x;
        float cy = ((rng_state * 12345u) / (float)UINT_MAX - 0.5f) * 4.0f / zoom + center.y;
        rng_state = rng_state * 1103515245u + 12345u;

        float zx = 0.0f, zy = 0.0f;
        for (int i = 0; i < max_iter; i++) {
            float zx2 = zx * zx, zy2 = zy * zy;
            if (zx2 + zy2 > 4.0f) break;

            float temp = zx2 - zy2 + cx;
            zy = 2.0f * zx * zy + cy;
            zx = temp;

            // Record trajectory point
            int px = (int)((zx - center.x + 2.0f / zoom) * width * zoom / 4.0f);
            int py = (int)((zy - center.y + 2.0f / zoom) * height * zoom / 4.0f);
            if (px >= 0 && px < width && py >= 0 && py < height) {
                atomic_inc(&local_hist[py * width + px]);
            }
        }
    }

    // Merge local histogram to global
    barrier(CLK_LOCAL_MEM_FENCE);
    int lid = get_local_id(0);
    int total_local = get_local_size(0);
    for (int i = lid; i < width * height; i += total_local) {
        if (local_hist[i] > 0) {
            atomic_add(&global_hist[i], local_hist[i]);
        }
    }
}
```

The bottleneck is always the atomic operations on the histogram. Every thread wants to increment shared counters simultaneously. My approach of using LDS-local histograms with infrequent merges to global memory reduces atomic contention by approximately 10x.

## Color Mapping

The raw histogram is a grayscale density map. The artistic work is in the color mapping. I use a logarithmic transfer function to compress the dynamic range:

```python
def color_map(histogram, iterations):
    """Convert density histogram to color image"""
    # Log compression for dynamic range
    log_hist = np.log1p(histogram)

    # Normalize to 0-1
    log_hist = (log_hist - log_hist.min()) / (log_hist.max() - log_hist.min())

    # Apply color gradient
    # I use a multi-stop gradient: black -> blue -> teal -> gold -> white
    colors = np.zeros((*log_hist.shape, 3))
    for i in range(3):
        colors[:, :, i] = np.interp(log_hist, gradient_positions, gradient_colors[:, i])

    # Apply gamma correction
    colors = np.power(colors, 1.0 / 2.2)

    # Tonemap (filmic)
    colors = colors * (1.0 + colors / 2.0) / (1.0 + colors)
    return (colors * 255).astype(np.uint8)
```

The most important parameter is the iteration band mapping. Low-iteration samples produce broad, diffuse structure. High-iteration samples produce sharp, detailed structure. By mapping low iterations to warm colors (orange/gold) and high iterations to cool colors (blue/purple), you get the classic Buddhabrot look with depth and atmosphere.

## Results and Observations

After thousands of renders across multiple resolutions, here's what I've learned:

- **100M-1B samples**: Produces a noisy but recognizable image at 1080p. Fine for preview.
- **10B-50B samples**: Good quality at 4K. The main structure is clean; fine details have some noise.
- **100B+ samples**: Exhibition quality at 4K-8K. Smooth gradients, deep shadow detail, no visible noise.

The render time on an RTX 4090 for a 100B-sample 4K image is approximately 6-8 hours. On an A100, about 3-4 hours. This is not a casual hobby; it's a compute-intensive art form.

## Beyond the Standard Buddhabrot

Variations extend the concept:

- **Nebulabrot** separates the histogram into three color channels based on iteration depth.
- **Hybrid renders** combine Buddhabrot trajectories with escape-time coloring for psychedelic effects.
- **Deep zoom Buddhabrot** renders regions deep in the Mandelbrot set boundary, where trajectories form intricate, recursive patterns.

The result—a glowing, smoke-like fractal—rewards the patience. The Buddhabrot teaches that sometimes beauty emerges not from the points that stay, but from the paths of those that fly away. Every trajectory that escapes paints a line through the complex plane, and when you accumulate enough of them, the lines form the shape of enlightenment.

## The Nebulabrot Variant

The Nebulabrot is a color variant of the Buddhabrot that produces even more striking images. Instead of accumulating all trajectory hits into a single grayscale histogram, the Nebulabrot separates hits by iteration depth into three color channels:

- **Red channel**: hits from low-iteration orbits (10-100 iterations)
- **Green channel**: hits from mid-iteration orbits (100-1,000 iterations)
- **Blue channel**: hits from high-iteration orbits (1,000+ iterations)

Each channel is rendered as a separate Buddhabrot pass with different iteration limits. The three histograms are then composited as RGB channels, producing vivid color separation based on orbital depth.

```python
# Nebulabrot: separate histograms by iteration band
def render_nebulabrot(width, height, total_samples, max_iter):
    # Three histograms for three color bands
    hist_r = np.zeros((height, width), dtype=np.uint64)
    hist_g = np.zeros((height, width), dtype=np.uint64)
    hist_b = np.zeros((height, width), dtype=np.uint64)

    for sample in range(total_samples):
        c = random_complex()
        z = 0 + 0j
        trajectory = []

        for i in range(max_iter):
            z = z * z + c
            if abs(z) > 2.0:
                # Escaped! Record trajectory in the appropriate band
                for j, point in enumerate(trajectory):
                    px, py = complex_to_pixel(point, width, height)
                    if 0 <= px < width and 0 <= py < height:
                        if i < 100:
                            hist_r[py, px] += 1
                        elif i < 1000:
                            hist_g[py, px] += 1
                        else:
                            hist_b[py, px] += 1
                break
            trajectory.append(z)

    # Log-compress each channel independently
    img = np.zeros((height, width, 3))
    for idx, hist in enumerate([hist_r, hist_g, hist_b]):
        log_hist = np.log1p(hist)
        img[:, :, idx] = log_hist / log_hist.max() if log_hist.max() > 0 else 0

    return img
```

The Nebulabrot produces images where the outer glow is red, the intermediate structure is green, and the deep inner detail is blue—or any color mapping you choose. The visual depth is dramatically better than single-channel Buddhabrot because the eye interprets the color separation as three-dimensional structure.

## Deep Zoom Buddhabrot: The Hardest Challenge

Rendering a Buddhabrot deep zoom—magnifying a tiny region near the Mandelbrot set boundary—is the computational equivalent of climbing Everest. The challenges compound:

**Exponential sample requirements.** At zoom level 10¹⁰ (10 billion power), the visible region is so small that random sampling is exponentially wasteful. Almost all random points escape immediately or never escape, contributing nothing to the visible region. You need importance sampling that concentrates firepower:

```python
def adaptive_zoom_buddhabrot(center, zoom_level, base_samples):
    """Adaptive sampling for deep zoom Buddhabrot"""
    # First pass: sparse sampling to find interesting regions
    coarse_samples = conduct_sampling(center, zoom_level, count=base_samples // 100)
    density_map = build_density_map(coarse_samples)

    # Second pass: concentrate samples in high-density regions
    regions = partition_high_density(density_map, num_regions=16)
    per_region_samples = []
    for region in regions:
        budget = int((region.density / total_density) * base_samples)
        # Compute perturbation coordinates for this region
        perturb = compute_regional_perturbation(region, center)
        samples = conduct_sampling(
            perturb.center,
            perturb.zoom * perturb.sub_zoom,
            count=budget
        )
        per_region_samples.append(samples)

    return composite_regions(per_region_samples)
```

**Numerical precision issues.** At zoom levels beyond 10¹⁴, double-precision floating point can't represent the coordinates accurately. You need arbitrary-precision arithmetic or perturbation theory. Perturbation theory computes the orbit relative to a reference orbit using the derivative, which stays computable in double precision even as the absolute coordinates lose precision.

**Iteration count explosion.** Deep Mandelbrot regions can require millions of iterations for points to escape. A single sample may take 10 seconds on a GPU. Multiply by billions of samples, and a single deep zoom render can take weeks.

The current world record for deep Mandelbrot zoom is around 10⁶⁰⁰ (10^600 power), rendered using perturbation theory with 128-bit precision. No one has attempted a Buddhabrot at that depth—the compute cost would be astronomical.

## The Artistic Workflow

In practice, rendering a Buddhabrot isn't a single button press. My workflow for a final image involves:

1. **Region selection.** Render a quick low-sample preview (10M samples, 1024x1024) with a broad parameter sweep. Find the composition.
2. **Iteration tuning.** Adjust the iteration bands to balance glow vs. detail. This is the most artistic decision.
3. **Final render.** Submit the full computation (100B+ samples, 4K resolution) to a GPU cluster. This runs for 6-12 hours.
4. **Post-processing.** Tone-map the raw histogram, apply color gradients, perform denoising if needed.
5. **Compositing.** For Nebulabrot, composite the three bands and apply final color grading.

The waiting is the hardest part. You can't preview a 100B-sample render at 90% completion and adjust the parameters. You commit to the full compute and hope the composition works. The first time I saw a finished 8K Nebulabrot render populate on screen, 14 hours after hitting "render," I understood why photographers shoot medium format film. The deliberateness forces better decisions.

## Computational Art as a Medium

The Buddhabrot occupies a unique space in computational art. It's not procedurally generated—you can't seed it with a random number and get something beautiful. It's not hand-crafted—there's no way to directly edit the output pixels. It's a collaboration between the artist (who chooses the region, iteration bands, and color mapping) and the mathematics (which determines the structure).

I've rendered hundreds of Buddhabrots. Maybe 20 are good. Five are great. One or two are genuinely beautiful. The hit rate is low, but when the math aligns with the artistic vision, the result is unlike anything else.

Every trajectory that escapes paints a line through the complex plane, and when you accumulate enough of them, the lines form the shape of enlightenment.
