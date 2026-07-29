# Vehicle Routing Problem Algorithms

The Vehicle Routing Problem (VRP) asks: given a fleet of vehicles, a depot, and a set of customer locations, find the optimal set of routes minimizing total distance or cost. Despite its simple formulation, VRP is NP-hard, and real-world logistics add constraints—time windows, capacity limits, driver hours, and traffic.

**Exact algorithms** solve VRP optimally using branch-and-cut or branch-and-price. These methods formulate VRP as an integer linear program, adding valid inequalities (subtour elimination, capacity constraints) to tighten the linear relaxation. Tools like Google OR-Tools' CP-SAT and Gurobi can solve instances with up to ~100 customers optimally. Beyond that, the exponential state space makes exact methods impractical.

**Clarke-Wright savings algorithm** is the classic construction heuristic. It starts with each customer served by a separate route, then computes savings for merging pairs: s_ij = d_i0 + d_0j - d_ij. Merges with the highest savings are applied iteratively, respecting vehicle capacity. The algorithm is O(n² log n) and produces reasonable solutions for medium-sized instances, serving as a warm-start for metaheuristics.

**Large Neighborhood Search (LNS)** is the state of the art for large-scale VRP. LNS repeatedly destroys part of a solution (removing 20-40% of customers) and repairs it using a greedy or dynamic programming insertion heuristic. The randomness in the destroy operator enables escape from local optima. Adaptive LNS learns which destroy/repair operators perform best during search, converging faster on problem-specific structures.

**Google OR-Tools' routing library** implements a hybrid approach combining LNS with constraint programming. It handles time windows, capacity, pickup-and-delivery, and multiple depots. The solver uses local search with metaheuristics (guided local search, simulated annealing, tabu search) to escape local minima. OR-Tools regularly wins VRP competitions, balancing solution quality with practical runtime.

**For practitioners**: start with OR-Tools for standard VRP variants, implement Clarke-Wright for quick estimates or warm starts, and consider specialized algorithms (dynamic programming for small TSP, exact methods for academic benchmarks) only when the standard tools don't suffice.
