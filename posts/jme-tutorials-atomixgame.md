# Writing the JMonkeyEngine Tutorials at AtomixGame


![](images/2019/jme-tutorials-atomixgame_img-001.png)

![](images/2019/jme-tutorials-atomixgame_img-002.png)

![](images/2019/jme-tutorials-atomixgame_img-003.png)

I wrote the first tutorial at 3 AM, fueled by instant coffee and the stubborn belief that someone, somewhere, would find it useful.

The JMonkeyEngine (JME) community in 2011 was small but passionate. The engine had been around for years, quietly evolving as an open-source Java 3D engine while Unity and Unreal dominated the commercial landscape. Documentation was sparse. The official wiki had the basics—how to set up a project, how to load a model, how to handle input—but there was a canyon between "hello world" and "I have a working game." I was trying to cross that canyon myself, and I was failing. Every answer I found required three more questions I couldn't ask anyone.

This is the story of how frustration became a tutorial series, and how that series became one of the most referenced resources in the JME community.

## The Gap That Needed Filling

JME had the fundamentals in place. The engine architecture was solid: a scene-graph-based spatial hierarchy, a spatial audio system, a physics engine integration (jBullet), and a material system that was ahead of its time. What it didn't have was cohesive tutorials that taught you how to build an actual game from scratch.

The existing tutorials fell into two categories. The first was API documentation: "Spatial.attachChild() attaches a child to this spatial." Technically correct, pedagogically useless. The second was "advanced" tutorials that assumed you already knew how to do everything: "Now we integrate our custom shadow mapping solution with deferred rendering." If you didn't already understand deferred rendering, you were lost before you started.

I wanted a third category: step-by-step tutorials that built a complete, playable game while explaining why each decision was made. Not just "call this method" but "we call this method because we're using a brick wall texture and the specular map would make it look wet, so we disable specular." The rationale matters more than the call.

## The First Tutorial: "Creating a Simple 3D Game"

The first tutorial I published was called "Creating a Simple 3D Game with JMonkeyEngine." It walked through building a basic first-person exploration scene: a player character that could move and look around, a room with walls and a floor, a few objects to interact with, and simple lighting. The tutorial was roughly 3,000 words with code snippets, screenshots, and plenty of commentary about why I made specific choices.

The response was immediate and overwhelming. Within a week, the tutorial had 2,000 views. Within a month, it was the top result on Google for "JMonkeyEngine tutorial." I received emails from people in a dozen countries saying the tutorial was the first time they actually understood how to use the engine.

That first tutorial taught me something important: the community was starving for practical, applied knowledge. API documentation tells you what a function does. A tutorial tells you when to use it, why to use it, and what happens if you use it wrong. Both are necessary, but only tutorials teach judgment.

## The Series Grows

Over the next three years, I wrote 14 major tutorials covering the full spectrum of JME development. The physics tutorial taught jBullet integration by building a marble run simulation. The audio tutorial built a spatial audio system for a horror game environment. The networking tutorial implemented client-server communication for a multiplayer prototype. The animation tutorial covered skeletal animation, blending, and state machines.

Each tutorial followed the same structure: state the goal, build the minimal system that achieves that goal, then extend it with the features you'd actually want in a production game. The "minimal viable" approach was deliberate. JME's API surface is large, and it's easy to overwhelm new developers by showing them the full solution. Starting with the 20-line version and growing to 200 lines is more educational than dumping 200 lines and explaining it.

The most technically challenging tutorial was the shader programming guide. JME uses a GLSL-based material system that's powerful but poorly documented. I spent three weeks learning the shader pipeline well enough to teach it, then another two weeks writing the tutorial that covered vertex shaders, fragment shaders, uniform passing, and multi-pass rendering. That tutorial is still referenced in JME forums today, five years after I wrote it.

## The HyperGraph Connection

The JME tutorials were my first serious experience building developer-facing educational content, and they shaped how I approach documentation for the HyperGraph project. Both require the same philosophy: explain the concept, show the code, then explain why the code works. The pattern applies whether you're teaching a game engine or a graph database.

The technical infrastructure for the tutorials was ad-hoc. I wrote them in raw HTML with embedded images hosted on the AtomixGame server. The code snippets were manually validated—I ran every snippet through a JME project to confirm it compiled and produced the expected results. This was important because nothing destroys a tutorial's credibility faster than a code snippet with a bug.

## The Metrics Nobody Talks About

Writing tutorials is not glamorous. The average tutorial took 40-60 hours to research, write, illustrate, and validate. That's a week of full-time work for 3,000-5,000 words of content. The compensation was zero dollars. The tutorials were and remain free, hosted on a server I paid for out of pocket.

The compensation that matters is different. The JME tutorials built my reputation in the game development community. When I later started writing about AI and HyperGraph, I had an existing audience that trusted me because of the tutorials. When I needed beta testers for early HyperGraph prototypes, I reached out to JME community members who had used my tutorials. Several of them became long-term collaborators.

The tutorials also taught me to write for a non-technical audience. Game developers come from diverse backgrounds—computer science, art, design, music—and a good tutorial works for all of them. I learned to avoid assumptions ("you obviously know what a quaternion is") and to explain concepts with analogies ("a spatial is like a container that can hold other containers, and when you move the parent container, all its children move with it").

## The Technical Challenges of JME

Writing the tutorials forced me to understand JME at a deeper level than I would have reached by just using it. The scene graph threading model required careful explanation: JME's update loop runs on a dedicated thread, and all scene graph modifications must happen on that thread. Violating this rule produces crashes that are intermittent and unreproducible. I encountered this bug during the tutorial writing process itself, spent three days tracking it down, and wrote an entire section about thread safety.

The asset pipeline was another deep rabbit hole. JME loads models through a system of loaders and asset managers. Understanding how the asset manager resolves paths, how loaders interact with different file formats (OBJ vs. FBX vs. glTF), and how the texture loading pipeline works was essential for writing tutorials where asset loading was a core activity.

Each of these deep dives became a tutorial in itself. The thread safety tutorial is one of the most-viewed on the site because it addresses a pain point that every JME developer encounters but that the official documentation glosses over.

## Maintaining the Tutorials

Open-source documentation rots. JME's API changed between versions 3.0 and 3.1, breaking several of my tutorials. The physics backend switched from jBullet to a native Bullet binding, requiring a complete rewrite of the physics tutorial. The material system gained new features that made my shader examples obsolete.

I maintained the tutorials actively for four years, updating them for each JME release. After that, the maintenance burden exceeded my available time. I made the tutorials open-source on GitHub, accepted pull requests from community contributors, and let the content evolve organically. Some tutorials have been updated by 10+ different contributors. The source repository has 47 stars and a steady trickle of PRs.

The maintenance lesson applies directly to HyperGraph documentation. I'm building the HyperGraph docs as version-controlled markdown from day one, with automated testing of code examples and a clear contribution path. The open-source maintenance model works when the content is valuable enough that users want to contribute. The JME tutorials proved that model works for technical documentation.

## What I'd Do Differently

If I were starting the tutorial series today, I'd make three changes. First, I'd include video content alongside the written tutorials. The written format works well for reference material, but video is better for showing visual concepts like scene graph transformations and particle effects. Second, I'd build an interactive code playground where readers could modify and run code snippets directly in the browser. Tools like CodeSandbox and RunKit didn't exist when I started, and they'd dramatically reduce the friction between reading and trying.

Third, I'd plan the tutorial series as a curriculum rather than individual posts. The tutorials were written in order of what I happened to learn next, not what a student should learn next. A proper curriculum would have dependencies between tutorials, learning objectives for each module, and a clear progression from beginner to advanced.

Despite the imperfections, I'm proud of the JME tutorials. They helped hundreds of developers build their first 3D games, they established my voice as a technical writer, and they proved that deep, practical content is valuable even for a small community. I'd tell my 3 AM self to keep going. The readers were out there. They just needed someone to write what you needed to read.
