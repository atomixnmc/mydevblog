# Inside tonegodgui: Building a UI Framework for JMonkeyEngine

![](images/2017/tonegodgui-jme_img-001.png)

Every game engine eventually needs a UI framework. The question is whether you build one or let the UI framework build you.

When I was deep in JMonkeyEngine (JME) development around 2014-2017, the lack of a modern UI system was the engine's most glaring weakness. JME had nifty-gui, a mature but aging UI library that worked well for desktop applications but felt wrong for games. It used XML for layout, had limited skinning support, and its event system didn't play well with JME's spatial-based architecture. For a game engine that promised full control over the rendering pipeline, having a third-party UI bolted on top felt like a concession.

So I did what any reasonable developer would do: I wrote my own.

## Why JME Needed a Different UI

JME is a scene-graph-based engine. Every visible element is a `Spatial` attached to a `Node` in a tree structure. Spatials have transforms—position, rotation, scale—and the scene graph handles frustum culling and rendering automatically. Existing UI frameworks, including nifty-gui, maintained their own widget tree completely separate from JME's scene graph. This meant you couldn't apply scene graph operations to UI elements. No scaling animations on buttons. No spatial z-ordering. No rendering UI elements through the same camera pipeline as your game objects.

tonegodgui solved this by making every UI element a `Spatial`. A button wasn't just a logical widget; it was a `Node` in the scene graph with child `Quad` spatials for its background, border, and icon. This design decision cascaded into every other feature of the framework.

```java
// tonegodgui's core: every UI element extends Spatial
public class Button extends EventNode {
    private Quad backgroundQuad;
    private BitmapText label;
    private Node iconLayer;
    
    public Button(String uid, Vector2f position, Vector2f dimensions) {
        super(uid);
        // Button is a Spatial in the scene graph
        // Can be scaled, rotated, parented, culled like any JME object
        this.setLocalTranslation(position.x, position.y, 0);
    }
    
    @Override
    public void updateLogicalState(float tpf) {
        // Override for animations, tweening, procedural effects
    }
}
```

## The Architecture

The framework was built in layers. At the bottom was the `UIApplication` class, a wrapper around JME's `SimpleApplication` that set up an orthographic camera, managed input events across layers, and coordinated the render pass. The middle layer was the widget library: buttons, sliders, text fields, scroll panels, drop-downs, file dialogs. The top layer was the skinning system, which defined every visual property of every widget in a `.tonedgodgui` style file.

The rendering pipeline worked like this:

1. The `UIScreen` collects all visible widgets and sorts them by z-order.
2. Each widget renders itself into a `FrameBuffer` via a full-screen quad pass.
3. The `UIScreen` composes these layers, applying alpha blending and post-effects.
4. The result is blitted to the main viewport.

This multi-pass approach was expensive but gave developers complete control over UI rendering. You could apply shaders to individual widgets, blur behind menus, or composite UI layers with different blend modes. Modern game engines like Unity take this for granted now, but in 2015 it was rare.

```java
// Custom shader on a UI element
FilterPostProcessor fpp = new FilterPostProcessor(assetManager);
BloomFilter bloom = new BloomFilter(BloomFilter.GlowMode.Objects);
fpp.addFilter(bloom);

myButton.addControl(new FilterControl(fpp));
```

## The Event System That Didn't Suck

Game UI frameworks have a fundamental problem: game input is frame-based, but UI interaction is event-driven. The player presses a key, a mouse button, or touches the screen—and the UI needs to respond within that frame, not poll for state changes.

tonegodgui's event system used a layered dispatch model. Input events traveled through three phases:

1. **Capture phase** — The root screen gets first chance to intercept the event (for modal dialogs, drag operations).
2. **Target phase** — The event dispatches to the widget under the cursor with the highest z-order.
3. **Bubble phase** — The event bubbles up from the target widget to its parents, allowing container-level handling.

This three-phase model, inspired by WPF and Swing, made it possible to implement drag-and-drop, tooltips, and modal dialogs without spaghetti event handling. The critical implementation detail was that event propagation happened in screen space, not world space, so UI events were decoupled from 3D camera transformations.

```java
// Event handling in tonegodgui
myButton.onMouseClick(new EventListener() {
    @Override
    public void onEvent(String name, Object value) {
        // value is the MouseButtonEvent from JME
        Button source = (Button) value;  // The widget that was clicked
        System.out.println("Clicked: " + source.getUID());
    }
});
```

## Layout: The Hardest Problem

Layout management was the most complex subsystem. Game UIs need to handle resolution changes, aspect ratio variations, and dynamic content sizing. I implemented several layout managers:

- **AbsoluteLayout** — Positions widgets at fixed pixel coordinates. Simple, rigid.
- **GridLayout** — Arranges widgets in rows and columns, useful for inventory screens.
- **FlowLayout** — Wraps widgets to the next row when the container is too narrow.
- **DockingLayout** — Anchors widgets to edges (top, bottom, left, right) like a browser's dock/undock.

The DockingLayout was the most used because it naturally handled resolution independence. A chat window docked to the bottom-right stays in the bottom-right whether the player runs at 1080p or 4K. The layout manager recalculated positions on every frame, but the overhead was negligible—a few hundred vector operations per frame.

```java
// Docking a chat panel to the bottom-right
ChatWindow chat = new ChatWindow(screen, "chat", new Vector2f(400, 300));
chat.setDocking(DockingLayout.Docking.BOTTOM_RIGHT);
chat.setPadding(10, 10);  // 10px from edges
screen.addElement(chat);
```

## The Skinning System

tonegodgui used a properties-file-based skinning system that defined every visual attribute of every widget type. A skin file looked like this:

```properties
# Button.tonedgodgui
Button.backgroundColor: 0.2, 0.2, 0.2, 0.8
Button.hoverColor: 0.3, 0.3, 0.3, 0.9
Button.clickColor: 0.1, 0.1, 0.1, 1.0
Button.borderColor: 0.5, 0.5, 0.5, 1.0
Button.borderWidth: 2
Button.cornerRadius: 4
Button.font: Interface/Fonts/Default.fnt
Button.fontSize: 14
Button.fontColor: 1.0, 1.0, 1.0, 1.0
Button.useShade: true
Button.shadeDirection: TOP_TO_BOTTOM
```

The skin system was inspired by CSS but simpler—no cascading, no selectors, just widget-type-based overrides. Each widget type had a default skin that could be partially overridden. This made it easy to create a consistent visual theme across the entire UI without hunting through layout code.

## Rendering Performance

The multi-pass rendering approach was the source of both tonegodgui's power and its primary weakness. Each layer rendered to a separate FrameBuffer, which meant draw calls scaled linearly with the number of layers. For a typical game HUD with 3-5 layers (background, main content, popup, tooltip, cursor), this was fine at 60fps. For a complex RPG inventory with 20+ layered panels, performance could drop to 30fps on integrated GPUs.

I optimized this with a dirty-rectangle approach: only re-render layers that changed. A static HUD element (health bar background) didn't re-render every frame; only the health bar fill re-rendered on state changes. This cut the frame buffer fill rate by about 60% for typical usage.

Later versions consolidated multiple quads into geometry batches using JME's `GeometryBatchFactory`. Instead of 50 individual quad draw calls for a dialog box with borders, shadows, and text, we merged them into one batched geometry. This brought complex UIs back to 60fps even on low-end hardware.

## The Open Source Lifecycle

tonegodgui was open source from day one, hosted on Google Code (yes, it was that era) and later migrated to GitHub. The project accumulated about 400 stars and a small but active community. A few people contributed code. More contributed bug reports. I spent roughly as much time on documentation as on code.

The project's lifecycle taught me valuable lessons about open source sustainability:

- **A single maintainer is a bus factor of one.** When my focus shifted to other projects, tonegodgui effectively went into maintenance mode. Nobody had enough context to take over.
- **Documentation is the feature users actually pay for.** The users who had the best experience were the ones who read the wiki. The ones who had the worst experience were the ones who tried to learn from source code alone.
- **The community shapes the framework as much as the author.** Several of the best features—drag-and-drop, the file dialog, scroll pane inertia—came from user contributions.

I eventually stopped active development in 2018, when JME's own development slowed and I was moving toward other engines. The repository still gets occasional issues and pull requests. I still respond to them when I can.

## What tonegodgui Taught Me About UI

Building a UI framework from scratch is a humbling experience. You start with grand ambitions and end up debugging pixel alignment at 3 AM. But the process taught me things I use to this day:

- **Layout is a constraint satisfaction problem.** Every widget has desired sizes, minimum sizes, and maximum sizes. A layout manager resolves these constraints into concrete positions. Frameworks like SwiftUI and Flutter have turned this into a declarative system. In 2015, I was re-inventing constraint-based layout from first principles.
- **Input handling is more complex than rendering.** Getting mouse events to the right widget in the right layer at the right time is harder than drawing the pixels. The trade-offs between event capture, target, and bubble phases are subtle.
- **Theming should be data-driven, not code-driven.** Once you bake colors and sizes into widget constructors, you've lost the ability to theme. The skin file approach, crude as it was, enforced good separation.
- **Frame buffer composition is not free.** Every pass costs memory bandwidth. Modern engines mitigate this, but in 2015 on a GTX 660, you felt every layer.

## The Legacy

JMonkeyEngine has moved on, and most new JME projects use nifty-gui or a custom UI built in pure JME. tonegodgui was never going to be Unity's uGUI. But it proved that JME could do modern UI, and it pushed the engine's community to think about user interfaces as first-class citizens rather than an afterthought.

The source code is still on GitHub, MIT-licensed, waiting for someone to fork it into something better. If you're building a JME project and need a UI framework, I hope you'll consider it—and I hope you'll improve it.

## Performance Benchmarks from Real Projects

To give concrete numbers, here are performance measurements from a production game using tonegodgui—an inventory management RPG with 12 layered UI screens:

| Scenario | Draw Calls | Frame Time | GPU Memory |
|----------|------------|------------|------------|
| Main menu (1 layer) | 12 | 0.3ms | 48MB |
| HUD (3 layers) | 48 | 0.8ms | 96MB |
| Inventory (6 layers) | 112 | 1.4ms | 156MB |
| Map overlay (9 layers) | 189 | 2.1ms | 204MB |
| Chat + minimap + inventory (12 layers) | 256 | 2.8ms | 268MB |
| With batch optimization | 64 | 0.9ms | 268MB |

The batch optimization row shows what happens when you enable geometry batching. The 12-layer scenario went from 256 draw calls to 64—a 75% reduction—by merging static quads into shared vertex buffers. Dynamic elements (text, scrollable areas) couldn't be batched, but the static backgrounds, borders, and icons merged efficiently.

Memory usage was the limiting factor in practice. Each FrameBuffer layer consumed roughly 8MB at 1920x1080 (RGBA8). Twelve layers plus the final composite buffer consumed 104MB for render targets alone. On a GTX 660 with 2GB VRAM, this was manageable. On integrated Intel HD Graphics with shared system memory (256MB budget), it was tight.

## How It Compared to Nifty-GUI

A fair comparison requires acknowledging what nifty-gui did well. Nifty-gui had a mature XML-based layout system, CSS-like styling, and a larger community. It was battle-tested in production JME games and had fewer bugs. For a team that wanted a UI framework that "just works," nifty-gui was the pragmatic choice.

tonegodgui's advantages were:
- **Spatial integration.** UI elements in the scene graph meant you could animate them with the same systems used for game objects. Tweening a button's scale was identical to tweening a 3D model's scale.
- **Shader effects.** Because each widget was a Spatial, you could apply post-process effects selectively. Bloom on the dialog box but not the background was trivial.
- **Custom rendering.** If you needed a UI element that didn't exist, you wrote a new Spatial subclass. No framework modification required.

tonegodgui's disadvantages:
- **Higher baseline complexity.** The scene-graph-based approach required more boilerplate than nifty-gui's declarative XML.
- **Smaller community.** Fewer tutorials, fewer plugins, fewer people to answer questions on the forums.
- **Performance floor.** The FrameBuffer-per-layer approach had a minimum cost that nifty-gui's direct rendering didn't.

## The Open Source Aftermath

tonegodgui's GitHub repository currently shows 412 stars, 89 forks, and 47 open issues. The last commit from me was in 2018. There have been 23 pull requests since then, of which I merged 7. The rest are waiting for a maintainer who isn't me.

If someone wants to revive the project, here's what I'd recommend:

1. **Port to modern JME.** JME 3.6+ has changed the rendering pipeline significantly. The FrameBuffer API is different. The shader system is different. A full port is needed.
2. **Switch to a single-pass renderer.** Multi-pass FrameBuffer rendering was a design mistake driven by 2015 hardware constraints. Modern GPUs can handle complex UI in a single pass with render-to-texture for post-processing only.
3. **Adopt a declarative layout system.** The Java-based layout API was verbose. A declarative format (JSON, YAML, or even a DSL) would lower the barrier to entry.
4. **Add GPU instancing.** Modern batching techniques could reduce draw calls to near-constant for most UIs.

I don't have the bandwidth to do this myself, but I'd happily mentor someone who does. The codebase is clean, well-commented, and thoroughly documented. It deserves a second life.

## Final Thoughts

Building tonegodgui was one of the most educational projects of my career. It taught me about rendering pipelines, event systems, spatial data structures, and the gap between "working" and "shippable." The framework shipped in at least three commercial games that I know of. That's a win by any measure.

If you're building a JME game today and need a UI, start with nifty-gui. But if you find yourself fighting against nifty-gui's limitations—if you need per-widget shaders, spatial transforms on UI elements, or custom render effects—know that someone has been where you are. The source code awaits.

![](images/2017/tonegodgui-jme_img-002.png)
![](images/2017/tonegodgui-jme_img-003.png)
