# Nifty GUI in JME3

jMonkeyEngine (JME3) lacks a built-in GUI system, but Nifty GUI fills that gap as a powerful screen-based UI framework. Nifty uses XML to define screen layouts and supports CSS-like styling, making it familiar to web developers entering game development.

Nifty GUI operates independently from JME3's rendering pipeline. It renders its own geometry on top of the 3D scene using a separate viewport. Setup requires initializing Nifty with JME3's `NiftyJmeDisplay`:

```java
NiftyJmeDisplay niftyDisplay = new NiftyJmeDisplay(
    assetManager, inputManager, audioRenderer, guiViewPort);
Nifty nifty = niftyDisplay.getNifty();
guiViewPort.addProcessor(niftyDisplay);
```

Screens are defined in XML. Each screen can contain panels, images, text fields, buttons, and list boxes. Controls support mouse, keyboard, and controller input. The controller logic goes in Java classes that implement `ScreenController`, bridging XML layouts with application code.

Nifty's layout model uses elements, layers, and effects. Elements are the basic units. Layers group elements vertically or horizontally. Effects provide animations — fade in/out, move, scale, rotate — that can be triggered on show, hide, hover, or click. This makes menu transitions feel polished with minimal effort.

For in-game HUDs, Nifty renders on the GUI viewport while the 3D scene runs beneath it. The two layers are completely independent, so the HUD doesn't interfere with game rendering performance.

The main trade-off is that Nifty isn't designed for real-time UI updates at 60 FPS. It excels for menus, inventory screens, and dialog boxes. For world-space UI (health bars over characters), you're better off rendering billboard sprites in the 3D scene itself.
