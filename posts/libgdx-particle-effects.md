# Particle Effects in libGDX

Particle systems turn static scenes into living worlds. libGDX's particle system, based on the `ParticleEffect` and `ParticleEmitter` classes, supports additive blending, colour interpolation, motion over time, and scaling—all configured through a GUI editor or programmatically.

The workflow typically involves the **libGDX Particle Editor** (a standalone app bundled with the tools). You define emitters visually: spawn rate, lifetime, velocity, gravity, colours, rotation, and size—each as curves over the particle's lifetime. The editor saves `.p` and `.png` files in a `particles/` directory.

```java
public class ParticleDemo implements ApplicationListener {
    private ParticleEffect fireEffect;
    private SpriteBatch batch;

    @Override
    public void create() {
        batch = new SpriteBatch();
        fireEffect = new ParticleEffect();
        fireEffect.load(Gdx.files.internal("particles/fire.p"),
                        Gdx.files.internal("particles"));
        fireEffect.setPosition(Gdx.graphics.getWidth() / 2f, 100);
        fireEffect.start();
    }

    @Override
    public void render() {
        float dt = Gdx.graphics.getDeltaTime();
        fireEffect.update(dt); // Advances particle ages

        batch.begin();
        fireEffect.draw(batch);
        batch.end();

        // Always allow completion, then restart for looping
        if (fireEffect.isComplete()) {
            fireEffect.reset();
        }
    }
}
```

**Architecture**: `ParticleEffect` contains multiple `ParticleEmitter` objects. Each emitter draws particles independently with its own configuration. A campfire might have a flame emitter (yellow-orange, fast, rising) and a smoke emitter (grey, slow, drifting sideways).

Key properties that make particles look good:

- **Additive blending**: Enable with `batch.setBlendFunction(GL20.GL_SRC_ALPHA, GL20.GL_ONE)`. Makes overlapping particles glow. Switch back to normal blending for opaque particle overlays.
- **Attached emitters**: Position fire particles relative to a moving player sprite by calling `fireEffect.setPosition(playerX, playerY)` each frame before draw.
- **Premultiplied alpha**: If your particle atlas uses premultiplied alpha, configure the `ParticleEffect` with `ParticleEffect.load(Gdx.files, Gdx.files, true)`.
- **Billboarding**: libGDX's 3D particle system (`ParticleMesh`) renders particles as camera-facing quads in 3D space.

Performance-wise, keep particle counts per effect under 200 for mobile and 500 for desktop. The `ParticleEffectPool` class provides object pooling to avoid GC pressure during heavy particle spawning.
