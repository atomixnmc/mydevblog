# Node.js + Unity: Building Real-Time Multiplayer Architecture

The player count hit 500 and the server started smoking.

Not figuratively. I could smell the ozone from the DC's AC unit as the Node.js process climbed past 2GB of RAM. We had designed for 200 concurrent users. The game went semi-viral on a Vietnamese gaming forum, and suddenly our single-threaded signaling server was handling 5,000 WebSocket messages per second.

Here's what the final architecture looked like after we stopped the fires:

```javascript
// WebSocket mesh with Redis pub/sub
const WebSocket = require('ws');
const redis = require('redis');

const pub = redis.createClient();
const sub = redis.createClient();
const wss = new WebSocket.Server({ port: 8080 });

sub.subscribe('game:updates');
sub.on('message', (channel, message) => {
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
});

wss.on('connection', (ws, req) => {
  ws.on('message', (data) => {
    pub.publish('game:updates', data);
  });
});
```

The Unity side consumed these messages through a dedicated networking layer that ran on a separate thread via Unity's job system. Each player entity had a state buffer that interpolated between the last two server snapshots, smoothing out the 50-100ms latency that WebSocket introduces over geographic distances.

```
┌─────────────┐     WebSocket      ┌──────────────┐
│  Unity Client│ ─────────────────> │  Node.js GW   │
│  (Mesh)      │ <───────────────── │  (Cluster)    │
└─────────────┘                    └──────┬───────┘
                                          │
                                     Redis Pub/Sub
                                          │
                              ┌───────────┴───────────┐
                              │  Node.js Game Server   │
                              │  (Zone Shard)          │
                              └───────────────────────┘
```

The Redis pub/sub layer was the backbone. Each game zone had its own Redis channel, so we could horizontally scale the Node.js game servers without clients reconnecting. When a player moved between zones, the signaling layer transparently subscribed them to the new channel.

The biggest lesson? Node.js can handle thousands of concurrent connections if you keep the event loop clear. No synchronous crypto, no blocking DB calls on the hot path, and for the love of everything, no `JSON.parse` on every single message without a try-catch.

We eventually replaced the naive WebSocket mesh with a proper binary protocol using msgpack, cutting bandwidth by 60%. That's a story for another post.
