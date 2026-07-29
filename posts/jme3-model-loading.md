# 3D Model Loading in JME3

Any 3D engine's usefulness is measured by how easily it loads external assets. JME3 handles this through the `AssetManager`—a centralised resource loader that abstracts away file formats, streaming, and caching. Getting a textured model into your scene takes surprisingly few lines.

JME3 supports multiple formats natively: **OBJ** (simple, text-based), **FBX** (Autodesk), **glTF** (the emerging standard), and its own **J3O** (optimised, compiled format). For production, use glTF for interchange and J3O for final builds—J3O loads faster because it's a serialised scene graph, not a parsed text file.

```java
public class ModelLoader extends SimpleApplication {
    @Override
    public void simpleInitApp() {
        // Load a glTF model with animations
        Spatial model = assetManager.loadModel("Models/character/character.gltf");

        // Position and scale
        model.setLocalScale(0.5f);
        model.setLocalTranslation(0, 0, -10);

        // Apply lighting material so it responds to scene lights
        Material mat = new Material(assetManager,
            "Common/MatDefs/Light/Lighting.j3md");
        model.setMaterial(mat);

        // Find and play an animation if it exists
        AnimControl control = model.getControl(AnimControl.class);
        if (control != null) {
            AnimChannel channel = control.createChannel();
            channel.setAnim("walk");
        }

        rootNode.attachChild(model);
    }
}
```

The `assetManager.loadModel()` call does a lot: it reads the file, parses the geometry, loads textures from referenced paths, builds materials, and returns a `Spatial` node (possibly a `Node` with multiple children, each containing meshes). If your model doesn't appear, check three things: the texture paths are relative to the model file, the model is within the camera's view frustum, and you've attached it to `rootNode`.

For animated models, `AnimControl` manages channels—each channel can play an animation blended atop others. Combine a "run" animation on the legs with an "aim" animation on the upper body using separate channels on the same control.

Optimisation tip: convert final assets to J3O format:

```java
assetManager.loadAsset("Models/character/character.j3o");
```

The J3O format uses JME's binary serialisation and strips unused data. Loading time drops from seconds to milliseconds for complex scenes.
