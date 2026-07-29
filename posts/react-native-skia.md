# React Native Skia: GPU-Accelerated Graphics

Shopify's React Native Skia brings the Skia graphics library—the same rendering engine behind Chrome, Android, and Flutter—to React Native. It provides GPU-accelerated 2D graphics API that runs on the UI thread, enabling performant custom drawing, animations, and visual effects.

**The Canvas component** is the entry point. `<Canvas>` renders a Skia surface that can be drawn on using declarative drawing primitives: `<Circle>`, `<Rect>`, `<Path>`, `<Text>`, and `<Image>`. These components are not React Native views—they're Skia draw commands compiled into a display list and rendered by the GPU. This means thousands of drawing operations at 60fps without creating native views, which would tank performance in standard React Native.

**Declarative drawing** combines the React model with imperative graphics. Skia shapes are components with props: `<Circle cx={100} cy={100} r={50} color="red" />`. Animations drive prop changes through `useSharedValue` from Reanimated or `useValue` from Skia's own animation system. The `<Group>` component applies transforms (rotation, scale, translation) and clip regions to all children, mirroring SVG group semantics.

**Shaders and effects** give Skia its power. Skia supports fragment shaders written in GLSL (the SkSL dialect). `<Shader>` components compile shader code that runs on the GPU for each pixel. Effects like `<BlurMask>`, `<Shadow>`, `<ColorMatrix>`, and `<DisplacementMap>` apply post-processing to drawn content. These effects would be expensive or impossible with standard React Native components.

**Text rendering** handles complex typography including rich text with mixed styles, text on paths, and emoji. The `useFont` hook loads custom fonts from assets. Text layout supports Unicode bidi, line breaking, and justification matching native platform rendering.

**Integration patterns**: Skia canvases can overlay standard React Native views using `<Canvas>` as a sibling or parent. Touch handlers (PanGestureHandler, TapGestureHandler) work on Skia canvases through absolute coordinate mapping. For performance-critical overlays (filters, particle effects, custom charts), Skia is dramatically faster than SVG or WebGL alternatives.

The tradeoff is that Skia drawing is not accessible by default—screen readers can't interpret canvas content. For decorative visuals, this is fine; for data visualizations, provide accessibility labels or native fallback views with the same information.
