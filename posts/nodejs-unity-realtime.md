# Node.js + Unity: Building Real-Time Multiplayer Architecture


![](images/2014/nodejs-unity-realtime_img-001.png)

![](images/2014/nodejs-unity-realtime_img-002.png)

![](images/2014/nodejs-unity-realtime_img-003.png)

The player count hit 500 and the server started smoking.

Not literally smoking—the CPU hit 98%, the event loop latency spiked to 400ms, and WebSocket connections started dropping faster than the reconnection logic could handle them. A multiplayer game server built on Node.js, serving a Unity WebGL client, was melting in production. Players were teleporting across the map. State updates arrived out of order. The chat system was broadcasting messages to the wrong rooms.

I was huddled over my development machine at 2 AM, watching server logs scroll past, trying to identify the bottleneck before the server collapsed entirely. This was the moment I learned that "real-time multiplayer" and "JavaScript event loop" have a complicated relationship.

## Why Node.js for Game Servers?

The conventional wisdom says you don't build game servers in Node.js. You use C++ with RakNet. You use C# with Netcode for GameObjects. You use Rust with the bevy engine's networking stack. You use anything with manual memory management, deterministic performance, and zero-GC latency. JavaScript, with its garbage collector, single-threaded event loop, and JIT compilation jitter, seems like the last language you'd choose for real-time multiplayer.

I chose it anyway for three reasons. First, the team's expertise was JavaScript-heavy. We had frontend engineers who knew the language deeply but didn't know C++. Converting them to systems programmers would take months. Second, Node.js's async I/O model is excellent for the non-game parts of a game server: HTTP APIs, database access, authentication, matchmaking. These operations are I/O-bound and benefit from Node.js's event-driven architecture. Third, the game was a strategy game, not a twitch shooter. The latency requirements were "under 100ms," not "under 16ms." The margin for slop was wider.

The bet was that Node.js could handle the orchestration, coordination, and state management layers, while the performance-critical simulation logic would be offloaded to a native module or separate service. It was a reasonable bet. It was almost wrong.

## The Architecture

The system I built had three components. The Unity client handled rendering, user input, and local state prediction. The Node.js server managed authoritative game state, room management, and message routing. A Redis instance handled session storage, leaderboard data, and pub/sub messaging between multiple Node.js server instances for horizontal scaling.

The communication layer was WebSockets via the `ws` library on the server side and Unity's `WebSocket` class (via the Native WebSocket package) on the client side. Each game tick (at 20 Hz, or every 50ms), the server computed the authoritative state and broadcasted it to all clients in the room. Clients predicted the next state locally between server updates and reconciled when server packets arrived.

The message format was a custom binary protocol built on top of MessagePack. Each message had a 4-byte header (message type, sequence number, flags) and a variable-length body encoded as MessagePack. The binary format reduced bandwidth by roughly 60% compared to JSON. For a 100-player game sending 20 state updates per second, that's the difference between 40KB/s and 16KB/s per player—and 40KB/s × 100 players × 8 bytes per bit = 32 Mbps, which was already pushing the server's network bandwidth.

## The 500-Player Wall

The server architecture handled 50 players easily. It handled 200 players with occasional hiccups. At 500 players, it collapsed. The root cause was the broadcast loop. For each game tick, the server iterated over all connected clients and sent a state update to each one. The broadcast loop was O(n) per tick, which is fine for small n but becomes O(n²) when you consider that each client also sends input packets, heartbeats, and chat messages that need processing.

The real problem was JavaScript memory allocation. Each state update message required creating a new Buffer object, encoding the MessagePack payload, and writing the header. At 500 players × 20 ticks/second, that's 10,000 Buffer allocations per second. The garbage collector would trigger every few seconds, pause the event loop for 50-100ms, and cause a cascade of dropped messages and reconnection attempts.

The fix was a pooled buffer system. Instead of allocating new Buffers for each message, I pre-allocated a pool of 1,024-byte buffers and recycled them after each tick. The memory allocation dropped from 10,000 allocations/second to roughly 50 (for messages that exceeded the pool size). GC pauses dropped from 50-100ms to under 5ms. The server handled 500 players with 30% CPU utilization after the fix.

## State Synchronization Strategies

The naive approach to state synchronization is "send everything every tick." This works for small games but breaks down as state complexity grows. A single player in a strategy game might have 50 state properties (position, health, resources, tech level, unit positions, building status). At 500 players, that's 25,000 properties to synchronize every tick.

I implemented delta compression: the server sends only the properties that changed since the last tick. The delta was computed by comparing the current state snapshot to the previous snapshot and encoding only the differences. For most game ticks, fewer than 10% of properties change. Delta compression reduced per-tick message size by 85-95%, depending on gameplay intensity.

The tradeoff is increased CPU cost on the server (computing deltas) and increased complexity on the client (applying deltas to the local state). The CPU cost was manageable—about 5% additional overhead. The client complexity was significant but necessary. The alternative—sending full state every tick—would have required moving to UDP with custom reliability layers and forward error correction, which was a larger engineering investment.

## Handling Disconnections and Reconnections

Players disconnect. Their internet drops, their laptop goes to sleep, or they tab out to check email. The naive approach is to remove disconnected players from the game state and treat reconnection as a new session. For a strategy game where players invest 30-60 minutes per match, this is unacceptable.

The reconnection system stored a snapshot of each player's state at 30-second intervals. When a player disconnected, the server kept their state for 5 minutes. If they reconnected within that window, the server sent the last snapshot plus all queued state updates that occurred during the disconnection. The client applied the snapshot and replayed the updates, reconstructing the player's state with minimal visual disruption.

The challenge was queued state updates. A 2-minute disconnection at 20 ticks/second generates 2,400 state updates. Sending them all on reconnection would overwhelm the client. The solution was to send only the latest snapshot plus a compressed delta list—a binary encoding of which properties changed in each tick since the snapshot. The client applied the snapshot and then fast-forwarded through the deltas in a single frame. The visual result was a "jump to current time" effect that was jarring but better than losing the game session.

## Scaling Beyond One Server

The single-server architecture hit a ceiling at roughly 1,000 players with the optimized buffer pooling and delta compression. Beyond that, the event loop itself was the bottleneck—even an idle Node.js event loop can only process so many callbacks per second.

Horizontal scaling required splitting the game world into "shards" (independent game instances) with a matchmaking service that routed players to the least-loaded shard. Each shard ran as a separate Node.js process, potentially on a separate machine. Redis pub/sub handled cross-shard communication for global features like chat, leaderboards, and friend notifications.

The shard boundary was the hardest architectural decision. What happens when players in different shards try to interact? For our strategy game, the answer was "they can't directly." All game interactions happened within a shard. Cross-shard features were limited to non-game systems (chat, friends list, global rankings). This was a deliberate design constraint that simplified the architecture enormously. If we had needed cross-shard gameplay, we would have needed a completely different architecture—probably an entity-component-system with spatial partitioning and interest management.

## Lessons for the HyperGraph Project

The Node.js + Unity multiplayer system was my first serious distributed systems project, and the lessons directly informed the HyperGraph architecture. The buffer pooling pattern became a core part of HyperGraph's memory management. The delta compression approach influenced HyperGraph's change-tracking system. The shard boundary design constraint—non-interacting partitions—shaped HyperGraph's approach to graph partitioning.

The most important lesson was about monitoring. The 500-player collapse was predictable if I had been watching the right metrics. GC pause duration, event loop latency, and memory allocation rate were the leading indicators. I wasn't monitoring them, so I didn't see the collapse coming. Every system I've built since HyperGraph has had comprehensive runtime monitoring from day one, with dashboards that show exactly those three metrics plus system-specific ones.

The Node.js + Unity architecture ultimately worked. The game shipped, ran for two years, and supported up to 800 concurrent players during peak hours. The Node.js server handled tens of millions of game ticks without a crash after the buffer pooling fix. The Unity client ran at 60 FPS on mid-range hardware. Players reported smooth gameplay and responsive controls. The system was held together with careful engineering, not magic—and that's the real lesson. Real-time multiplayer is hard regardless of the language. Node.js makes some parts easier and other parts harder. The winning strategy is to know which is which and design accordingly.
