# Visual Programming for Fractals

Fractal generation lends itself beautifully to visual programming. The iterative, composable nature of fractals maps well to node-based systems where users connect operators visually rather than writing code. Tools like NodeBox, TouchDesigner, and custom web-based patchers let artists explore fractals without programming.

A typical visual fractal patcher has nodes for input mapping (complex plane coordinates), iteration logic (z = z² + c), coloring algorithms (escape time, normalized iteration count, distance estimation), and post-processing (anti-aliasing, tone mapping). Users wire nodes together on a canvas. Each node represents a pure function — inputs in, outputs out.

The challenge is that fractal algorithms are inherently sequential. Each iteration depends on the previous. Visual patchers handle this by treating iteration as a loop node with configurable max iterations. The loop node contains sub-patches for the body function. This hierarchical approach keeps the visual graph manageable.

Real-time preview is critical. Users adjust parameters — zoom level, bailout radius, color palette — and see the result update immediately. Implementations use WebGL fragment shaders under the hood, compiling the user's visual graph into GLSL code. A simple Mandelbrot graph compiles to a single shader. More complex graphs with multiple fractal layers merge into multi-pass render pipelines.

The democratization of fractal exploration through visual programming has produced stunning art. It removes the syntax barrier while preserving the mathematical depth. The best visual patchers don't simplify the math — they make the math visible as structure.
