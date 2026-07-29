# GLSL Shaders in JME3

JME3's default materials handle most rendering needs, but custom GLSL shaders unlock effects that canned materials can't touch—toon shading, water reflections, heat distortion, and procedural texturing. JME3 uses its own material definition system (.j3md files) that map to vertex and fragment shaders.

A JME3 material definition declares the shader files, input parameters, and render states. Here's a minimal custom toon shader:

```glsl
// Toon.vert - Vertex shader
uniform mat4 g_WorldViewProjectionMatrix;
uniform mat4 g_WorldMatrix;
uniform vec3 g_CameraPosition;

attribute vec3 inPosition;
attribute vec3 inNormal;
varying vec3 normal;
varying vec3 viewDir;

void main() {
    vec4 worldPos = g_WorldMatrix * vec4(inPosition, 1.0);
    normal = normalize((g_WorldMatrix * vec4(inNormal, 0.0)).xyz);
    viewDir = normalize(g_CameraPosition - worldPos.xyz);
    gl_Position = g_WorldViewProjectionMatrix * vec4(inPosition, 1.0);
}
```

```glsl
// Toon.frag - Fragment shader with cel-shaded lighting
uniform vec4 g_LightColor;
uniform vec4 g_AmbientColor;
uniform vec3 g_LightDirection;

varying vec3 normal;
varying vec3 viewDir;

void main() {
    vec3 N = normalize(normal);
    vec3 L = normalize(g_LightDirection);
    float intensity = dot(N, L);
    // Quantise intensity into 3 levels for toon effect
    if (intensity > 0.7) intensity = 1.0;
    else if (intensity > 0.3) intensity = 0.5;
    else intensity = 0.2;
    vec4 color = g_AmbientColor + g_LightColor * intensity;

    // Rim lighting
    float rim = 1.0 - max(0.0, dot(N, normalize(viewDir)));
    color += vec4(0.3, 0.3, 0.6, 1.0) * pow(rim, 2.0);
    gl_FragColor = color;
}
```

The `.j3md` definition binds it together:

```
MaterialDef Custom/Toon {
    MaterialParameters {
        Vector4 LightColor
        Vector4 AmbientColor
        Vector3 LightDirection
    }
    Technique {
        VertexShader GLSL100: Shaders/Toon.vert
        FragmentShader GLSL100: Shaders/Toon.frag
        WorldParameters {
            WorldViewProjectionMatrix
            WorldMatrix
            CameraPosition
        }
    }
}
```

JME3 provides predefined world parameters (`g_WorldMatrix`, `g_ViewProjectionMatrix`, `g_LightDirection`) and material parameters that you set in Java:

```java
Material mat = new Material(assetManager, "MatDefs/Custom/Toon.j3md");
mat.setColor("LightColor", ColorRGBA.White);
mat.setColor("AmbientColor", new ColorRGBA(0.1f, 0.1f, 0.2f, 1.0f));
mat.setVector3("LightDirection", new Vector3(0, -1, 1).normalizeLocal());
geometry.setMaterial(mat);
```

**Performance tips**: Minimise varyings (interpolated values between vertex and fragment shaders) to reduce bandwidth. Use `#ifdef` branches for conditional features (specular, normal mapping) to handle less powerful hardware. Profile with `JMEStatsAppState` to track shader switches—they're expensive.

For post-processing effects, JME3's `FilterPostProcessor` applies full-screen shader passes. Bloom, depth-of-field, and SSAO filters ship with the engine and serve as excellent reference implementations for custom filters.
