# From Games to Interactive Media: The SGMedia Pivot

We had built for gamers. The market wanted storytellers.

By 2017, the game outsourcing market in Vietnam had gotten brutally competitive. Studios in Hanoi were undercutting us by 40%. Client acquisition costs were rising. And the YouTube revenue that had been our safety net was gone. SGMedia needed to become something else, or it needed to die.

The pivot to interactive media wasn't strategic brilliance—it was survival. A former client asked if we could build an interactive brand experience for a Vietnamese beverage company. Think "digital billboard meets mobile game meets loyalty program." We said yes without knowing how to do it, which is basically the founding story of every agency.

The technical shifts were jarring:

- **Unity WebGL** replaced standalone builds. Clients wanted browser-accessible experiences, not installable executables.
- **Node.js API servers** became customer-facing dashboards instead of game backends. Same skills, different audience.
- **Asset pipelines** had to handle branding guidelines, not just game art. We learned more about color spaces and font licensing than any game dev should know.

```javascript
// Interactive brand experience template
app.get('/api/experience/:brandId/config', async (req, res) => {
  const config = await mongo.collection('experiences').findOne({
    brandId: req.params.brandId,
    active: true,
    startDate: { $lte: new Date() },
    endDate: { $gte: new Date() }
  });

  if (!config) return res.status(404).json({ error: 'No active experience' });

  res.json({
    theme: config.theme,      // Colors, fonts, branding
    interactions: config.flow, // User journey definition
    rewards: config.rewards,   // Prize mechanics
    analytics: config.tracking // Event schema
  });
});
```

The culture shock was real. Game developers are used to building for themselves—we make what we'd want to play. Interactive media meant building for marketing directors who had very specific opinions about button sizes and animation curves. The feedback loops were longer, the stakeholders were more numerous, and "it feels fun" was no longer an acceptable design justification.

But the margins were better. Interactive brand experiences commanded $15,000-40,000 per project with 50%+ margins. The work was less creatively fulfilling, but it paid for the server bills that kept our multiplayer experiments running.

The pivot taught me something valuable: your skills are more portable than you think. A game developer who understands engagement loops, real-time rendering, and networked state is incredibly valuable outside games. You just have to frame it differently.

SGMedia survived because we stopped building what we wanted and started building what the market would pay for. It's not romantic. It's not the indie dream. But it kept the lights on for two more years.
