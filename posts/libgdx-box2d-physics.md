# Box2D Physics in libGDX: Getting Started

Integrating Box2D physics into a libGDX game is one of the biggest jumps in quality your project can make. Suddenly objects bounce, stack, and collide believably without hand-rolled collision math. libGDX bundles Box2D as a core extension—no extra JARs needed.

The mental model: a **world** holds all physics bodies. Bodies have **fixtures** (shapes with material properties) attached via **fixture definitions**. Each frame, you step the world by a fixed timestep, then sync the physics transforms to your visual sprites.

```java
World world = new World(new Vector2(0, -9.8f), true); // gravity, allowSleep

BodyDef bodyDef = new BodyDef();
bodyDef.type = BodyDef.BodyType.DynamicBody;
bodyDef.position.set(100, 200);

Body body = world.createBody(bodyDef);
PolygonShape shape = new PolygonShape();
shape.setAsBox(16, 16);

FixtureDef fixtureDef = new FixtureDef();
fixtureDef.shape = shape;
fixtureDef.density = 1.0f;
fixtureDef.friction = 0.3f;
fixtureDef.restitution = 0.5f;
body.createFixture(fixtureDef);
shape.dispose();

// In render():
world.step(1 / 60f, 6, 2); // timestep, velocity iterations, position iterations
Vector2 pos = body.getPosition();
sprite.setPosition(pos.x - sprite.getWidth() / 2,
                   pos.y - sprite.getHeight() / 2);
sprite.setRotation((float) Math.toDegrees(body.getAngle()));
```

Key concepts that tripped me up initially:

- **Units**: Box2D works best in MKS (metres-kilograms-seconds). libGDX uses pixels. Choose a scale factor—I use 32 pixels per metre (`PPM`). Divide positions by PPM when setting Box2D coordinates; multiply when syncing back.
- **Stepping**: Always use a fixed timestep (1/60). Variable timesteps destroy determinism and cause simulation instability. Accumulate the delta and step in fixed increments.
- **Sleeping**: Bodies at rest go to sleep automatically. Toggle `world.setAutoClearForces(false)` if you get mysterious stoppages.
- **Collision filtering**: Use `categoryBits`, `maskBits`, and `groupIndex` on `Filter` objects to control which layers collide (player vs enemy vs terrain).

libGDX's Box2D debug renderer (`Box2DDebugRenderer`) is invaluable. It draws wireframes showing bodies, joints, and contact points. Toggle it with a key and leave it on during development—catching a misaligned fixture before it reaches QA saves hours.
