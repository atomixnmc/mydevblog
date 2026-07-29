# Unity MMORPG Backend: Node.js in a Distributed World

MMO servers are just distributed systems in disguise, and distributed systems have a way of making you feel very stupid at 3 AM.

Building a Unity MMO on Node.js wasn't the obvious choice. Everyone said "use Erlang" or "use C++" or "use whatever WoW used." But we had a team that knew JavaScript, and I had a hunch that Node's event loop could handle the I/O patterns of an MMO better than people gave it credit for.

The core pattern was zone sharding. The game world was divided into hexagonal regions, each assigned to a Node.js process. When a player crossed a zone boundary, the server handed off the connection state to the neighboring shard through Redis:

```javascript
// Zone handoff protocol
async function handoffPlayer(playerId, fromZone, toZone, state) {
  await redis.hset(`zone:${toZone}:players`, playerId, JSON.stringify(state));
  await redis.hdel(`zone:${fromZone}:players`, playerId);
  await redis.publish(`zone:${toZone}:updates`, JSON.stringify({
    type: 'player_enter',
    playerId,
    state
  }));
  // Tell old zone to flush
  await redis.publish(`zone:${fromZone}:updates`, JSON.stringify({
    type: 'player_exit',
    playerId
  }));
}
```

Physics arbitration was the hard part. We couldn't run Unity's PhysX on the server—too expensive and too opaque. Instead, we built a simplified physics server using `cannon-es` that ran at 10Hz while the Unity client ran at 60Hz. The server was the authority; the client was a liar that corrected itself.

```javascript
// Server-side physics arbitration
class PhysicsServer {
  constructor() {
    this.world = new CANNON.World();
    this.world.gravity.set(0, -9.82, 0);
    this.broadcasts = [];
  }

  tick(delta) {
    this.world.step(1 / 10, delta, 3);
    this.broadcasts = this.world.bodies.map(body => ({
      id: body.id,
      position: body.position.toArray(),
      quaternion: body.quaternion.toArray(),
      velocity: body.velocity.toArray()
    }));
  }
}
```

State synchronization used a priority system. Players within 50 meters got full state updates every 100ms. Players between 50-200 meters got compressed updates every 500ms. Beyond that, we sent position only. This cut bandwidth by 80% compared to naive broadcasting.

The Node cluster ran behind an Nginx reverse proxy with sticky sessions based on zone ID. Redis stored the zone-to-server mapping, updated dynamically as we scaled instances up and down. It wasn't elegant, but it handled 2,000 concurrent players across 12 server instances on $400/month of Linode VPSes.

Distributed systems are hard. But they don't need to be complicated.
