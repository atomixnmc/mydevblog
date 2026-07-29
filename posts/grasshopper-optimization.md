# Grasshopper Optimization Algorithm

The Grasshopper Optimization Algorithm (GOA) is a nature-inspired metaheuristic for solving continuous optimization problems. It models the swarming behavior of grasshoppers, where individuals interact through social forces, gravitational pull, and wind advection.

In the algorithm, each grasshopper represents a candidate solution in the search space. The position update formula combines three forces. The social interaction force is the most important — it models attraction and repulsion between individuals. When grasshoppers are far apart, they attract each other. When too close, they repel. This creates a natural balance between exploration (searching new regions) and exploitation (refining known good regions).

The mathematical model defines a social force function `s(r) = f * e^(-r/l) - e^(-r)` where `f` is attraction strength, `l` is attraction length scale, and `r` is distance between grasshoppers. The function produces strong repulsion at very short distances, weak attraction at medium distances, and zero force beyond a threshold.

The gravitational force pulls all grasshoppers toward the global best solution found so far. The wind advection adds random drift, preventing premature convergence. A crucial parameter is the decreasing comfort zone — as iterations progress, the repulsion range shrinks, causing the swarm to converge.

GOA has shown strong performance on benchmark functions compared to Particle Swarm Optimization and Genetic Algorithms, particularly for multimodal problems with many local optima. Its main weakness is computational cost — the pairwise social force calculation is O(n²), which limits swarm size.

Applications include feature selection, neural network training, and engineering design optimization. The algorithm's balance of exploration and exploitation makes it suitable for problems where the search landscape is rough and deceptive.
