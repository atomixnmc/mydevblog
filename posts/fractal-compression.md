# Fractal Compression: Self-Similarity as Compression

Fractal image compression exploits self-similarity within images to achieve high compression ratios. The core insight: many natural images contain patterns that repeat at different scales and orientations—a tree branch looks like a smaller tree, a coastline contains bays-within-bays.

**The mathematical foundation** is the Partitioned Iterated Function System (PIFS). The image is divided into non-overlapping range blocks (typically 4×4 or 8×8 pixels). A separate set of domain blocks (typically 8×8 or 16×16, overlapping) serve as the "vocabulary" for encoding. For each range block, the encoder finds a domain block that, after a spatial transformation (scale, rotate, reflect) and intensity adjustment (brightness, contrast), closely approximates the range block. The transformation coefficients plus the domain block location form the compressed representation.

**Encoding complexity** is the practical weakness. For an N×N image with R range blocks and D domain blocks, brute-force search compares each range against each domain at each transformation. R × D × T comparisons (T = 8 transformations) makes encoding slow—minutes to hours for a large image. Optimization techniques include: spatial classification (group blocks by texture type to reduce search space), quadtree decomposition (large blocks for smooth regions, small blocks for detail), and nearest-neighbor search in feature space.

**Decoding is fast** and resolution-independent. Start with any initial image (even a blank canvas), apply the stored transformations iteratively. Each iteration replaces each range block with the transformed and intensity-adjusted content of its matched domain block. After ~8-10 iterations, the image converges to a fixed point that approximates the original. Decoding scales linearly with resolution—higher resolution simply applies the same transformations at larger scales.

**Compression ratios**: Fractal compression typically achieves 10:1 to 50:1 for lossy compression with acceptable visual quality. At equivalent bitrates, fractal compression produces fewer blocking artifacts than JPEG, but the encoding time makes it impractical for real-time applications. Wavelet-based methods (JPEG 2000) generally offer better rate-distortion performance at lower computational cost.

**Modern relevance**: Fractal concepts survive in modern compression through neural methods. Diffusion models implicitly learn self-similarity priors. Patch-based rendering and texture synthesis use fractal-like reuse of image regions. The intellectual legacy—that images can be compactly represented through self-referential transformations—informs learned compression research even if direct fractal encoding is no longer competitive.

For archival of very large images where encoding can be slow but decoding must be fast and resolution-independent, fractal compression still holds niche advantages.
