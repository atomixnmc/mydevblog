# L-Systems: Growing Fractals with Grammar

L-Systems (Lindenmayer Systems) are a formal grammar where symbols represent drawing commands and production rules replace symbols iteratively. Originally developed to model plant growth, they generate everything from seaweed to Gothic cathedral arches to snowflakes. The core idea: simple rules, repeated, create organic complexity.

An L-system has three parts: an **axiom** (starting string), **production rules** (mapping symbols to replacement strings), and an **interpretation** (mapping symbols to turtle-graphics commands). Run the grammar for N iterations, then walk the resulting string and draw.

```python
def lsystem(axiom, rules, iterations):
    current = axiom
    for _ in range(iterations):
        current = ''.join(rules.get(c, c) for c in current)
    return current

# Classic tree: 'F' = draw forward, '+' = turn right, '-' = turn left, '[' push, ']' pop
axiom = "F"
rules = {"F": "FF+[+F-F-F]-[-F+F+F]"}
result = lsystem(axiom, rules, 4)
# Result: "FF+[+FF-FF-FF]-[-FF+FF+FF]FF+[+FF-FF-FF]-[-FF+FF+FF]..."
```

The turtle interpreter is where the magic lives. Each character maps to a drawing action. Branching uses a stack: `[` saves the current position and angle; `]` restores them. This creates sub-branches that grow and terminate, producing the characteristic branching patterns of trees and ferns.

```python
def draw_lsystem(instructions, angle=25, length=10):
    stack = []
    pos, heading = (0, 0), 90  # Start at origin, facing up
    lines = []
    for c in instructions:
        if c == 'F':
            rad = math.radians(heading)
            new_pos = (pos[0] + length * math.cos(rad),
                      pos[1] + length * math.sin(rad))
            lines.append((pos, new_pos))
            pos = new_pos
        elif c == '+':
            heading += angle
        elif c == '-':
            heading -= angle
        elif c == '[':
            stack.append((pos, heading))
        elif c == ']':
            pos, heading = stack.pop()
    return lines
```

Beyond plants, L-systems generate dragon curves, Sierpinski triangles, and Koch snowflakes by changing the axiom and rules. 3D L-systems add pitch/roll/yawn commands and scale parameters per iteration (turtle shrinks slightly each branch generation for natural tapering).

The limit is iteration depth. Each iteration multiplies the string length. Rule `F -> FF+[+F]` on iteration 10 is 10,000+ characters; iteration 15 is over 3 million. Draw performance degrades fast—use vertex buffers or geometry instancing for high-iteration renders.
