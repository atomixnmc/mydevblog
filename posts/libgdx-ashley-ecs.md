# Ashley ECS in libGDX

Ashley is a lightweight Entity-Component System framework for libGDX. It provides a clean, performant way to organize game logic by separating data (components) from behavior (systems), with entities as simple container IDs.

An Entity in Ashley is just an integer ID with a bag of components. Components are plain data classes — no logic, just fields:

```java
public class PositionComponent implements Component {
    public float x, y;
}
public class VelocityComponent implements Component {
    public float vx, vy;
}
```

Systems process entities that match a component family. A movement system declares it needs `PositionComponent` and `VelocityComponent`:

```java
public class MovementSystem extends EntitySystem {
    private Family family = Family.all(
        PositionComponent.class,
        VelocityComponent.class
    ).get();

    public void update(float deltaTime) {
        for (Entity e : getEngine().getEntitiesFor(family)) {
            PositionComponent pos = e.get(PositionComponent.class);
            VelocityComponent vel = e.get(VelocityComponent.class);
            pos.x += vel.vx * deltaTime;
            pos.y += vel.vy * deltaTime;
        }
    }
}
```

Ashley uses `ImmutableArray` for family iteration — no allocation during gameplay. System priority determines update order. Higher priority systems run first. The engine manages entity and system lifecycle.

Entity composition replaces deep inheritance hierarchies. Instead of `Player extends Character extends Entity`, you create a player entity with `Position`, `Renderable`, `Health`, `PlayerInput` components. Adding wings just means adding a `FlightComponent`. This makes game entities flexible and composable without brittle class hierarchies.

Performance characteristics: Ashley stores component data in flat arrays per type. Entity iteration over a family is O(n) where n is the number of matching entities — no hash lookups per entity. Component addition/removal uses pooled containers to avoid garbage collection.

Ashley integrates with libGDX's lifecycle. Create the engine in `create()`, add entities and systems during initialization, and call `engine.update(delta)` in `render()`. This pattern keeps game logic clean and cache-friendly.
