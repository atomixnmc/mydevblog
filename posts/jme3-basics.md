# Your First 3D Scene with JME3

jMonkeyEngine 3 is a Java 3D engine that hits a sweet spot: powerful enough for indie games and research visualisation, but approachable enough that you can have a spinning teapot on screen in about 40 lines. The engine is built around a scene-graph architecture with spatials, controls, and the `SimpleApplication` base class.

Here's the minimal setup to get a coloured cube rotating under a directional light:

```java
public class FirstScene extends SimpleApplication {
    public static void main(String[] args) {
        FirstScene app = new FirstScene();
        app.start();
    }

    @Override
    public void simpleInitApp() {
        // A box with solid colour
        Box box = new Box(1, 1, 1);
        Geometry geom = new Geometry("Cube", box);
        Material mat = new Material(assetManager,
            "Common/MatDefs/Light/Lighting.j3md");
        mat.setColor("Diffuse", ColorRGBA.Cyan);
        mat.setColor("Ambient", ColorRGBA.DarkGray);
        geom.setMaterial(mat);
        rootNode.attachChild(geom);

        // Spin it
        RotateControl rc = new RotateControl();
        geom.addControl(rc);
    }
}
```

The `SimpleApplication` gives you a `rootNode`, `cam`, `flyCam` (first-person camera), and `assetManager` for free. In `simpleInitApp`, you build your scene graph—spatials are attached to parent nodes, and transforms cascade down. Controls, like the custom `RotateControl`, attach behaviour to spatials via the `controlUpdate` loop.

JME3 uses a **spatial-listener** pattern: extend `AbstractControl` and override `controlUpdate(float tpf)` to run logic each frame. The engine processes physics (via JBullet or native Bullet), audio, and rendering in separate threads, but your game code runs single-threaded on the main update loop.

Start with the JME3 SDK or a Maven/Gradle setup from `jmonkeyengine.org`. The tutorials cover everything from terrain to networked multiplayer.
