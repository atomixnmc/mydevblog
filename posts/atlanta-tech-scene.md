# Atlanta Tech: More Than Peaches and Peanuts

Atlanta has peaches, peanuts, and a surprisingly vibrant gamedev scene that nobody on the coast seems to know about.

After Santa Monica, Atlanta wasn't an obvious next move. The city wasn't on my radar as a tech destination. But a contract opportunity came up—a startup building an interactive museum installation using Unity—and the cost of living math was impossible to ignore. My Santa Monica rent for a 500sqft studio would cover a two-bedroom apartment in Midtown Atlanta with money left over.

What I found surprised me. Atlanta's game development community is small but legitimately talented. Georgia State University runs one of the country's top digital media programs. The Savannah College of Art and Design (SCAD) is a three-hour drive and produces graduates who go straight to Epic, Blizzard, and Rockstar. And local studios like Hi-Rez Studios (SMITE, Paladins) have been shipping commercial games for over a decade.

```
Atlanta Tech by the Numbers (2019):
Gamedev studios: 15+ active
Major employers: Microsoft (Azure), Google (Cloud), NCR
Co-working: Atlanta Tech Village (largest in Southeast)
Gamedev meetups: Monthly ATL Game Dev, weekly Godot sessions
Cost of living: 62% below Santa Monica
```

The startup I worked for was building a 40-foot interactive LED wall for a science museum. Think floor-to-ceiling touch interaction with real-time particle simulations driven by visitor behavior. Unity was the rendering engine, Node.js handled the backend state, and a custom C++ library managed the LED panel drivers.

```cpp
// LED panel driver interface
class LEDPanelController {
public:
    LEDPanelController(int width, int height)
        : m_width(width), m_height(height) {
        // Initialize pixel buffer
        m_buffer.resize(width * height * 3);
    }

    void PushFrame(const std::vector<uint8_t>& pixels) {
        // Received from Unity via WebSocket
        // Convert from Unity's color space to LED panel format
        for (size_t i = 0; i < pixels.size(); i += 4) {
            m_buffer[i/4 * 3]     = pixels[i];     // R
            m_buffer[i/4 * 3 + 1] = pixels[i + 1]; // G
            m_buffer[i/4 * 3 + 2] = pixels[i + 2]; // B
        }
        m_panel.Send(m_buffer.data(), m_buffer.size());
    }
};
```

The Atlanta scene taught me that you don't need to be in SF or LA to build meaningful interactive work. The clients are different—more museums, corporate installations, educational experiences—but the technical challenges are just as interesting. And the peaches really are better.

Atlanta's tech ecosystem is quietly becoming a legitimate contender. The airport is the busiest in the world, which means clients fly in easily. The time zone is friendly to both coasts. And the cost structure means you can bootstrap a studio on a fraction of what it takes elsewhere.

I still miss the ocean. But I don't miss the rent.
