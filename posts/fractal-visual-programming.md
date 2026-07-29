# Visual Programming for Fractals

Fractal generation lends itself beautifully to visual programming. The iterative, composable nature of fractals maps well to node-based systems where users connect operators visually rather than writing code. Tools like NodeBox, TouchDesigner, and custom web-based patchers let artists explore fractals without programming.

I built my first visual fractal patcher in 2016 as an Electron app. The motivation was selfish: I was tired of recompiling C++ every time I wanted to tweak the color palette. The node graph turned what was a 5-minute edit-compile-run cycle into a 100ms live update. That speed difference changed how I explored fractals—instead of planning renders carefully, I started experimenting wildly.

## Why Fractals Map to Visual Programming

Fractal algorithms have a natural graph structure that mirrors visual node systems. Each computation is a pure function: inputs flow in, outputs flow out, and the pipeline is a directed acyclic graph. The Mandelbrot iteration `z → z² + c` is a cycle, but in a visual patcher, you can break it into explicit nodes:

```
[Complex Input] → [Square] → [Add C] → [Escape Check] → [Output]
```

Each of these nodes has clear inputs and outputs. A visual programmer can inspect intermediate values at any point in the pipeline. When iterating on a color mapping, you can wire a debug viewer to the "iteration count" output and see exactly what data your coloring algorithm receives.

The composability is the killer feature. Want to apply a log scale before the color gradient? Wire a `Math.Log` node between "iteration count" and "color ramp." Want to blend two fractals with a mask? Wire a `Mix` node with a noise texture as the blend factor. These operations require no code changes, no recompilation, no syntax errors—just dragging wires.

## Anatomy of a Visual Fractal Patcher

A typical visual fractal patcher has several categories of nodes:

**Input Mapping Nodes** convert screen coordinates to complex coordinates. The `ComplexPlane` node takes mouse position, zoom level, and pan offset, and outputs complex numbers. This node is the entry point for any fractal pipeline.

```javascript
// Pseudocode for a ComplexPlane visual node
class ComplexPlaneNode extends VisualNode {
    inputs = ['mouseX', 'mouseY', 'zoom', 'panX', 'panY'];
    outputs = ['c_real', 'c_imag'];

    evaluate(inputs) {
        const width = this.context.width;
        const height = this.context.height;
        const aspect = width / height;

        const c_real = (inputs.mouseX / width - 0.5) * 4.0 / inputs.zoom + inputs.panX;
        const c_imag = (inputs.mouseY / height - 0.5) * 4.0 / inputs.zoom * aspect + inputs.panY;

        return { c_real, c_imag };
    }
}
```

**Iteration Nodes** handle the core fractal computation. The `MandelbrotIterate` node, `JuliaIterate` node, `BurningShip` node, etc. These nodes take an initial z value and the fractal parameter, and output escape time, final z value, and orbit trajectory.

**Coloring Nodes** transform iteration data into colors. The `EscapeTime` node maps iteration count to color index. The `NormalizedIteration` node applies smooth coloring. The `DistanceEstimator` node produces analytic distance estimates for anti-aliasing. The `ColorRamp` node maps a scalar input to a color gradient.

**Post-Processing Nodes** apply effects after the initial render: tone mapping, bloom, histogram equalization, anti-aliasing. These are standard image processing operations, identical to what you'd find in Photoshop or Blender's compositor.

## The Loop Problem

Fractal algorithms are inherently iterative. Each iteration depends on the previous. In a visual programming context, this creates a challenge: how do you represent a loop as a node graph?

The solution is the **Loop Node**. A Loop Node contains a sub-patch—a mini node graph that represents the loop body. The Loop Node has inputs for the initial state and the maximum iteration count, and outputs for the final state and the escape flag.

```javascript
// Loop node containing a sub-patch
class LoopNode extends VisualNode {
    inputs = ['z_real_in', 'z_imag_in', 'c_real', 'c_imag', 'maxIterations'];
    outputs = ['z_real_out', 'z_imag_out', 'iterationCount', 'escaped'];

    // Contains a sub-patch with:
    // [z_real, z_imag] → [Square] → [Add C] → [Escape Check] → [outputs]
    subpatch = new Subpatch();

    evaluate(inputs) {
        let z_real = inputs.z_real_in;
        let z_imag = inputs.z_imag_in;
        let iter = 0;

        while (iter < inputs.maxIterations) {
            // Evaluate the sub-patch body once
            const body_inputs = { z_real, z_imag, c_real: inputs.c_real, c_imag: inputs.c_imag };
            const body_outputs = this.subpatch.evaluate(body_inputs);

            z_real = body_outputs.z_real_out;
            z_imag = body_outputs.z_imag_out;

            if (body_outputs.escaped) {
                return { z_real_out: z_real, z_imag_out: z_imag, iterationCount: iter, escaped: true };
            }
            iter++;
        }

        return { z_real_out: z_real, z_imag_out: z_imag, iterationCount: iter, escaped: false };
    }
}
```

The hierarchical approach keeps the visual graph manageable. The top-level graph shows the high-level pipeline; double-clicking the Loop Node reveals the iteration body. This nesting maps well to how developers think about the iteration, without overwhelming the user with visual complexity.

## Compiling to the GPU

Real-time preview is the defining feature of a good visual patcher. Users adjust parameters and see the result update immediately, without hitting "render." This requires GPU acceleration.

My patcher compiled the visual graph into GLSL fragment shaders. The compilation process was a topological sort of the node graph followed by code generation:

```javascript
// Graph-to-GLSL compiler (simplified)
class GLSLCompiler {
    compile(nodeGraph) {
        const sorted = this.topologicalSort(nodeGraph);
        let code = `
            #version 430
            uniform vec2 u_center;
            uniform float u_zoom;
            uniform float u_time;
            layout(local_size_x=16, local_size_y=16) in;
            layout(rgba32f, binding=0) writeonly uniform image2D u_output;

            void main() {
                ivec2 pixel = ivec2(gl_GlobalInvocationID.xy);
                vec2 coord = vec2(pixel) / vec2(imageSize(u_output));
        `;

        // Generate code for each node
        const varMap = {};
        for (const node of sorted) {
            const [vars, nodeCode] = this.compileNode(node, varMap);
            Object.assign(varMap, vars);
            code += nodeCode;
        }

        code += `
                vec4 color = vec4(${varMap[this.findOutputNode(sorted)]}, 1.0);
                imageStore(u_output, pixel, color);
            }
        `;
        return code;
    }
}
```

A simple Mandelbrot graph compiles to a single shader with inline iteration. More complex graphs with multiple fractal layers, blending, and post-processing merge into multi-pass render pipelines. Each pass writes to a framebuffer, and subsequent passes read from previous framebuffers as textures.

The multi-pass approach naturally supports operations that can't be done in a single shader pass:
- **Bloom**: Render bright regions to a smaller buffer, blur, and composite.
- **Supersampling**: Render at 2x resolution, then downsample.
- **Depth of field**: Render multiple passes with different focal planes.

## Real-World Performance

The performance bottleneck in visual fractal patchers is always the compilation step. Each parameter change invalidates the shader and requires recompilation. GLSL compilation takes 50-200ms on modern GPUs, which is too slow for interactive tweaking.

I solved this with a technique called **parameter pushing**. Instead of recompiling the shader when a parameter changes, I pass the parameter as a uniform:

```glsl
// Before: hardcoded zoom
// After: uniform-driven zoom
uniform float u_zoom;
uniform vec2 u_center;

vec2 map_pixel(ivec2 pixel, vec2 resolution) {
    return (vec2(pixel) / resolution - 0.5) * 4.0 / u_zoom + u_center;
}
```

With uniform-based parameters, only structural changes (adding/removing nodes, rewiring connections) trigger a recompile. Parameter value changes update in microseconds via glUniform calls. This makes parameter exploration feel instant.

```javascript
// Direct uniform update - no recompilation
function updateZoom(newZoom) {
    const location = gl.getUniformLocation(program, 'u_zoom');
    gl.uniform1f(location, newZoom);
    render();
}
```

## Beyond Single Fractals

The most interesting visual patches combine multiple fractals. My patcher supported:

- **Layer blending**: Two fractals rendered separately, blended with alpha compositing, screen blending, or additive blending.
- **Domain coloring**: Apply complex functions between the coordinate mapping and the fractal iteration. For example, applying a conformal map to the complex plane before the Mandelbrot iteration produces twisted, distorted versions of the classic fractal.
- **Iteration-dependent blending**: Use iteration count as a blend factor between two color schemes. Low iterations show one palette; high iterations blend to another.
- **Orbit trap rendering**: Instead of coloring by escape time, color by proximity to geometric shapes (circles, lines, crosshairs) in the orbit path.

```glsl
// Orbit trap coloring in GLSL
vec3 orbit_trap(vec2 z, vec2 c, int maxIter) {
    vec3 color = vec3(0.0);
    float minDist = 1e10;

    for (int i = 0; i < maxIter; i++) {
        z = vec2(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y) + c;

        // Distance to a circle at origin with radius 0.5
        float dist = abs(length(z) - 0.5);
        minDist = min(minDist, dist);
    }

    // Color by minimum orbit distance
    return vec3(smoothstep(0.0, 0.1, minDist));
}
```

## The Democratization Effect

The democratization of fractal exploration through visual programming has produced stunning art. It removes the syntax barrier while preserving the mathematical depth. The best visual patchers don't simplify the math—they make the math visible as structure.

I've seen artists create works with visual patchers that rival anything produced by hand-coded shaders. The difference is iteration speed. A visual patcher lets an artist try 50 color schemes in the time it takes a programmer to try 5. That exploration bandwidth translates directly to better output.

The tools have limitations, of course. Complex algorithmic optimizations (early bailout, perturbation theory for deep zooms) are hard to express in a general-purpose node graph. For those, you still need hand-written code. But for the 90% of fractal exploration that's about compositing, coloring, and post-processing, visual programming makes the process faster and more creative.

## Building Your Own

If you want to build a visual fractal patcher today, the tech stack has never been more accessible:

- **WebGPU** (replacing WebGL) provides compute shaders in the browser, enabling GPU-accelerated fractal renders without native code.
- **Graph libraries** like Rete.js, NodeEditor, or custom React flow libraries provide the UI scaffolding for node-based editing.
- **Shader compilation** libraries like glslify or custom GLSL generators handle the graph-to-shader pipeline.

My old Electron patcher still works, though Electron's memory footprint makes it impractical for large renders. I'm rebuilding it as a web app using WebGPU and React Flow. The core architecture—topological sort, uniform-based parameterization, multi-pass rendering—is the same, but the reach is wider when it runs in a browser.

The goal is the same as it was in 2016: make fractal exploration so fast that the interface disappears, and all that's left is the math.

## User Interface Considerations

Designing the node editor UI itself was a significant challenge. The technical problem (compiling graphs to shaders) was hard, but the UX problem—how to make a node graph intuitive for artists—was harder.

**Node placement and routing.** Automatic layout algorithms (force-directed, hierarchical) produced ugly, overlapping graphs. Manual node placement was better but required the user to manage visual organization. I settled on a hybrid: nodes auto-snap to a grid, wires route through orthogonal paths, and the user can collapse/expand node groups to manage complexity.

**Live previews.** Every node can optionally show a thumbnail preview of its output. A `ColorRamp` node shows the gradient. A `ComplexPlane` node shows the coordinate mapping. A `Blend` node shows the composited result. These thumbnails update at low resolution (256x256) during interaction and full resolution when the user releases the mouse. The cost: each thumbnail requires a mini shader evaluation, but on modern GPUs you can render 20+ thumbnails per frame without noticeable overhead.

**Parameter editing.** Numeric parameters support direct input, sliders, and drag-to-adjust. Color parameters show a color picker on click. The key UX insight: every parameter change should produce immediate visual feedback. No button presses, no "apply" buttons, no dialog confirmations. The mental model is a synthesizer patch bay, not a Windows settings dialog.

```javascript
// Parameter binding with live preview
class ParameterBinder {
    constructor(node, paramName, config) {
        this.node = node;
        this.paramName = paramName;
        this.value = config.default;
        this.min = config.min || 0;
        this.max = config.max || 1;
        this.step = config.step || 0.01;

        // Create UI element
        this.slider = document.createElement('input');
        this.slider.type = 'range';
        this.slider.min = this.min;
        this.slider.max = this.max;
        this.slider.step = this.step;
        this.slider.value = this.value;

        // On change: update node parameter AND trigger re-render
        this.slider.addEventListener('input', () => {
            this.value = parseFloat(this.slider.value);
            this.node.setParameter(this.paramName, this.value);
            this.node.graph.requestRender();  // Schedule re-render
        });
    }
}
```

## Error Handling in Visual Programs

Visual programming is not immune to errors—it just makes them look different. Instead of syntax errors, users get wiring errors: incompatible types, unconnected inputs, cyclic graphs.

**Type checking** is performed as wires are connected, not at render time. Each output port has a type (float, vec2, vec3, texture, etc.) and the UI prevents connecting incompatible types. The wire turns red when hovering over an incompatible target port. This catches 90% of errors before they reach the shader compiler.

**Unconnected inputs** get default values. A text label shows "using default" next to unconnected input ports, with the default value displayed. When the shader compiles, unconnected inputs become constants, avoiding dynamic branching.

**Cyclic graph detection** is critical. A cycle in the node graph would produce an infinite loop during shader compilation. The system checks for cycles after every wiring change using topological sort (Kahn's algorithm). If a cycle is detected, the wire snaps back to the source port with an animation and an error popup: "Cycle detected!".

```javascript
// Cycle detection after every wire change
class GraphValidator {
    static hasCycles(nodes, edges) {
        // Kahn's algorithm for topological sort
        const inDegree = new Map();
        const adjacency = new Map();

        for (const node of nodes) {
            inDegree.set(node.id, 0);
            adjacency.set(node.id, []);
        }

        for (const edge of edges) {
            adjacency.get(edge.source).push(edge.target);
            inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
        }

        const queue = nodes.filter(n => inDegree.get(n.id) === 0).map(n => n.id);
        let visited = 0;

        while (queue.length > 0) {
            const nodeId = queue.shift();
            visited++;
            for (const neighbor of (adjacency.get(nodeId) || [])) {
                inDegree.set(neighbor, inDegree.get(neighbor) - 1);
                if (inDegree.get(neighbor) === 0) {
                    queue.push(neighbor);
                }
            }
        }

        return visited !== nodes.length;
    }
}
```

## Export and Integration

A visual patcher is useless if it can't export its output. My patcher supported multiple export targets:

- **GLSL shader code.** The compiled shader can be copied directly into any GLSL-compatible application. Artists would export the shader and drop it into Unity, Unreal, or TouchDesigner.
- **Image sequences.** For animation export, the patcher renders each frame to disk as PNG, with optional EXR output for high dynamic range.
- **Live video output.** Via Syphon (macOS) or Spout (Windows), the patcher streams real-time output to other applications. This was used by VJs for live performance.
- **Interactive web embed.** The patcher could export an HTML file containing the compiled WebGL shader and a simple control panel for the paramters. This was popular for sharing works on social media.

The export pipeline is a second compilation step: the node graph is compiled to the target format, not just to the internal renderer. For GLSL export, this is straightforward—you're just writing the compiled code to a file. For the web embed, the patcher generates a complete HTML file with embedded slider controls for each parameter.

## Reflections on a Decade of Visual Programming

I started building visual programming tools in 2016 because I was frustrated with the iteration speed of traditional fractal exploration. Looking back, the project taught me more about developer experience than any other work I've done.

Visual programming is not inherently better than textual programming. It's different. It excels at exploratory creativity where the user wants to iterate rapidly through many possibilities. It struggles with algorithmic complexity where precise control over execution order and data flow is required.

The best systems—NodeBox, TouchDesigner, Grasshopper—don't try to replace text-based programming. They complement it. Complex algorithms are written as custom nodes in Python or C++. The visual graph orchestrates them, controls the data flow, and provides the interface for parameter exploration.

That's the model my patcher followed, and it's the model I'd use if I rebuilt it today. The graph is the interface. The math is the implementation. The artist doesn't need to care about the boundary between them.

The goal is the same as it was in 2016: make fractal exploration so fast that the interface disappears, and all that's left is the math.
