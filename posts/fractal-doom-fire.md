# Doom Fire as Cellular Automaton

The iconic fire effect from Doom (1993) is a textbook cellular automaton. It demonstrates how complex, organic-looking behavior emerges from simple local rules applied to a grid of cells. The technique is elegant, performant, and surprisingly easy to implement.

The fire is represented as a 2D array of pixels, each storing a heat value from 0 (cold/black) to 35 (hot/white). The automaton updates each frame. The rule is simple: for each pixel, its new heat value is the average of the pixel below it and its left/right neighbors, subtracted by a small random decay.

In pseudocode:

```
new_heat[x][y] = (heat[x][y+1] + heat[x-1][y+1] + heat[x+1][y+1]) / 3 - rand(0, 3)
```

The bottom row is seeded with maximum heat values. As the algorithm propagates upward, heat dissipates and spreads horizontally, creating the billowing flame shape. The random decay produces the turbulent flickering that makes fire look real.

Color mapping turns heat values into fire colors. A palette of 36 entries maps heat levels to colors: 0 = black, 1-5 = dark red, 6-15 = bright red/orange, 16-25 = yellow, 26-35 = white. This palette was stored as a lookup table in Doom's assets, with each entry being an 8-bit RGB value.

Performance on 90s hardware: each frame processes 320×200 = 64,000 cells with simple integer operations. No multiplication, no division (bit shifts replace them). Modern implementations run this in WebGL fragment shaders, processing millions of cells at 60 FPS.

The Doom fire cellular automaton is a perfect teaching tool. It's visually impressive, computationally trivial, and demonstrates the core concepts of cellular automata, state transitions, and emergence in a single screen of code.
