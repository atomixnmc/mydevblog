# Bullet Physics in JMonkeyEngine 3

JMonkeyEngine 3 (jME3) integrates Bullet Physics through its `jme3-bullet` extension, bringing real-time rigid body dynamics to Java game development. Bullet is battle-tested—used in AAA games, film VFX, and robotics simulations—and jME3 wraps it with a clean Java API.

**The physics space** is the root of all simulation. Create a `BulletPhysicsSpace` with a broadphase algorithm (axis-sweep for most games) and configure gravity. Rigid bodies (`PhysicsRigidBody`) register with the space and automatically respond to collisions. The collision shape library covers primitives (box, sphere, capsule, cylinder), compound shapes, and mesh-based concave shapes for terrain and level geometry.

**Character control** uses `PhysicsCharacter` for player avatars. Unlike a full rigid body, the character has a fixed orientation, continuous collision detection to prevent tunneling at high speeds, and kinematic walking that doesn't slide on slopes. Setting step height, fall speed, and jump parameters controls feel without manual force calculations.

**Ghost objects** (`PhysicsGhostObject`) detect overlaps without physical response—perfect for trigger zones, pickup detection, and proximity alarms. They register collision events without affecting the simulated bodies. This separates gameplay logic (what happens when something enters a zone) from physics simulation (how things bounce and slide).

**Performance tuning** matters for complex scenes. Bullet's broadphase culls distant collision pairs, but the narrow phase is O(n²) for overlapping objects. Use compound shapes instead of mesh shapes for complex objects (a car as boxes and cylinders, not a detailed mesh). The `setCcdMotionThreshold` and `setCcdSweptSphereRadius` enable continuous collision detection to prevent fast-moving objects passing through thin walls.

**Debug visualization** is built in: `BulletPhysicsAppState` renders wireframe collision shapes overlaid on the scene, showing exactly what the physics engine sees versus what the player sees. This is invaluable for diagnosing ghost collisions, incorrect shape positioning, or scaling mismatches between visual meshes and physics shapes.

jME3's Bullet integration handles the hard parts of physics simulation—broadphase culling, constraint solving, and collision detection—so developers can focus on gameplay mechanics rather than implementing Verlet integration from scratch.
