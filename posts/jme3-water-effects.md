# Water Simulation in JME3

jMonkeyEngine's water effects are implemented through a combination of vertex displacement, reflection mapping, and Fresnel shading. The built-in `WaterFilter` provides realistic ocean and lake surfaces with configurable wave parameters.

The core technique is Gerstner wave simulation. Unlike simple sine waves, Gerstner waves produce sharper crests and flatter troughs by shifting vertices horizontally as well as vertically. This creates the characteristic peaked shape of ocean waves. Multiple Gerstner waves at different frequencies and directions are summed to create complex, non-repeating surfaces.

JME3 implements wave displacement in vertex shaders for performance. The shader evaluates the wave function for each vertex, computing both height and horizontal displacement. For close-up water, higher vertex density captures wave detail. For distant water, a tessellation shader increases subdivision dynamically.

Reflection rendering captures the scene from below the water surface, rendering to a texture that's sampled during the water pass. The reflection is distorted using the wave normals and screen-space coordinates, creating the illusion of rippling reflections. Refraction renders the underwater scene, distorted by the wavy surface.

The Fresnel effect determines the reflection-to-refraction ratio based on viewing angle. At shallow angles, water reflects more. Straight down, you see through it. The Fresnel calculation uses the dot product of the view direction with the surface normal.

Performance optimization uses LOD (level of detail) — a grid of quads with decreasing density toward the horizon. The water tile follows the camera, extending to the far clip plane. Combined with the horizon fade, this creates the illusion of infinite ocean without rendering the entire surface.

JME3's `WaterFilter` also supports foam generation, wave chop, and deep/shallow color gradients for tropical water effects.
