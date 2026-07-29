# Entity-Component-System Architecture in libGDX with Artemis

As a libGDX project grows beyond a few enemy types, the class hierarchy problem emerges: `Goblin extends Enemy extends Character extends Entity` becomes brittle. A fire spell that damages both enemies and exploding barrels needs a shared parent that makes no logical sense. ECS (Entity-Component-System) solves this by composing behaviour from data components rather than inheriting it.

**Artemis-odb** is the most mature ECS framework for Java/libGDX. Entities are just IDs. Components are plain data bags. Systems iterate over entities that match a component signature and operate on them each frame.

```java
// Components - pure data
public class PositionComponent extends Component {
    public float x, y;
}

public class VelocityComponent extends Component {
    public float vx, vy;
}

public class HealthComponent extends Component {
    public int hp;
}

// System - operates on entities with Position + Velocity
public class MovementSystem extends IteratingSystem {
    public MovementSystem() {
        super(Aspect.all(PositionComponent.class, VelocityComponent.class));
    }

    @Override
    protected void process(int entityId) {
        PositionComponent pos = world.getMapper(PositionComponent.class).get(entityId);
        VelocityComponent vel = world.getMapper(VelocityComponent.class).get(entityId);
        pos.x += vel.vx * world.delta;
        pos.y += vel.vy * world.delta;
    }
}
```

**Why ECS changes your architecture:**

- **Composition over inheritance**. A fire trap has `Position`, `Sprite`, `DamageOnContact`, and `ExpiresAfter`. No shared base class needed.
- **Data locality**. Systems iterate over packed component arrays, not scattered objects. Cache misses drop, performance increases. Artemis-odb stores components in dense arrays, not hash maps.
- **Cross-cutting systems**. A `RenderSystem` that draws any entity with `Position` + `Sprite` components works for players, enemies, items, and particles. One system, many entity types.

```java
// Setup the world
World world = new World(new WorldConfigurationBuilder()
    .with(new MovementSystem(), new CombatSystem(), new RenderSystem())
    .build());

// Create an entity with components
int player = world.create();
world.getMapper(PositionComponent.class).create(player).set(0, 0);
world.getMapper(VelocityComponent.class).create(player).set(50, 0);
world.getMapper(SpriteComponent.class).create(player).set(texture);

// Each frame
world.setDelta(dt);
world.process();
```

The trade-off: ECS is more boilerplate upfront. A simple `Goblin` class with 3 methods is faster to write than a component, a system, and world setup. But at 15+ entity types, the inheritance tangles begin, and ECS's upfront cost pays back in flexibility.

Artemis-odb includes a **weaver** (annotation processor) that optimises component access at compile time. Use `@PooledWeaver` on components for object pooling and `@Profile` on systems for performance tracing.
