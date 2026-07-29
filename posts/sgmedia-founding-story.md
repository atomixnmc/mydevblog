# SGMedia: The Founding Story

The year was 2013. I was sitting in a Saigon coffee shop with condensation running down the glass and a cracked MacBook Air in front of me. Vietnam's tech scene was still raw—a few co-working spaces, a handful of meetups, and a YouTube gaming ecosystem that was exploding faster than anyone could predict.

I had been tinkering with Unity since version 3.5, building prototype after prototype that never saw the light of day. But something felt different this time. The Google Display Network was paying real money for gaming content, and Vietnam had the engineering talent at a fraction of Silicon Valley rates. The math made sense on paper.

SGMedia wasn't a grand vision. It started as a two-person operation in a borrowed office above a pho shop in District 3. My co-founder handled business dev while I wrote Unity build scripts and Node.js backends. Our first real project was a Unity Web Player game—remember those?—that synced player data through a Node.js REST API hosted on a $20 DigitalOcean droplet. It was janky, but it worked.

```javascript
// The first API endpoint that paid the bills
app.post('/api/game/save', async (req, res) => {
  const { userId, gameState } = req.body;
  await redis.set(`game:${userId}`, JSON.stringify(gameState));
  res.json({ saved: true });
});
```

We built game outsourcing pipelines for international studios, ran YouTube gaming channels with millions of views, and experimented with multiplayer architectures that nobody in Vietnam was talking about yet. The studio grew to 12 people at its peak, with engineers across Ho Chi Minh City and Da Nang.

You can still find remnants of that early work at [sgmhn.com](https://sgmhn.com)—a domain that's somehow survived a decade of hosting bills, DNS migrations, and my terrible sysadmin habits. That site holds the fossil record of every experiment that didn't kill the company.

The coffee shop is long gone, but the lessons from those early Saigon days still shape how I think about building things: start small, charge money early, and never trust a single $20 droplet to handle production traffic.
