# Vehicle Routing Problem Algorithms: From Theory to Production

The Vehicle Routing Problem (VRP) asks: given a fleet of vehicles, a depot, and a set of customer locations, find the optimal set of routes minimizing total distance or cost. Despite its simple formulation, VRP is NP-hard, and real-world logistics add constraints — time windows, capacity limits, driver hours, and traffic. I've worked on VRP for a last-mile delivery company managing 500+ trucks across a metropolitan area. The gap between textbook VRP and production logistics is massive: real drivers have shift preferences, traffic varies by time of day, and some customers have loading dock constraints that make them inaccessible to certain truck sizes. Every additional constraint makes the problem harder and the solution more valuable.

## Problem Formulation

The basic Capacitated VRP (CVRP) is defined by a complete graph G = (V, E) where V includes the depot (vertex 0) and customers (1..n). Each customer i has demand d_i, each vehicle has capacity Q, and edge costs represent travel distances or times. The objective: find a set of routes, each starting and ending at the depot, such that each customer is visited exactly once, total demand on each route ≤ Q, and total cost is minimized.

```python
# Data structure for a VRP instance
from dataclasses import dataclass, field
from typing import List, Tuple
import numpy as np

@dataclass
class VRPInstance:
    n_customers: int
    n_vehicles: int
    vehicle_capacity: float
    demands: List[float]
    distance_matrix: np.ndarray  # (n_customers+1) × (n_customers+1)
    time_windows: List[Tuple[float, float]] = field(default_factory=list)  # (start, end) per customer

    def __post_init__(self):
        assert len(self.demands) == self.n_customers
        assert self.distance_matrix.shape == (self.n_customers + 1, self.n_customers + 1)

    def route_cost(self, route: List[int]) -> float:
        """Compute total distance of a route (list of customer indices)."""
        cost = self.distance_matrix[0, route[0]]  # depot → first customer
        for i in range(len(route) - 1):
            cost += self.distance_matrix[route[i], route[i+1]]
        cost += self.distance_matrix[route[-1], 0]  # last customer → depot
        return cost

    def is_feasible(self, route: List[int]) -> bool:
        """Check capacity and time window constraints."""
        total_demand = sum(self.demands[c] for c in route)
        if total_demand > self.vehicle_capacity:
            return False
        # Time window check (simplified)
        current_time = 0.0
        for c in route:
            start_tw, end_tw = self.time_windows[c]
            if current_time > end_tw:
                return False
            current_time = max(current_time, start_tw) + self.distance_matrix[c, c]  # service time
        return True
```

## Exact Algorithms: Branch-and-Cut

Exact algorithms solve VRP optimally using branch-and-cut or branch-and-price. These methods formulate VRP as an integer linear program, adding valid inequalities (subtour elimination, capacity constraints, comb inequalities) to tighten the linear relaxation. The subtour elimination constraints are the most important: they prevent solutions where a subset of customers is served by a route that doesn't connect to the depot. Tools like Google OR-Tools' CP-SAT and Gurobi can solve instances with up to ~100 customers optimally. Beyond that, the exponential state space makes exact methods impractical — the LP relaxation alone has ~2^n subtour constraints.

```python
# High-level OR-Tools CP-SAT formulation for small VRP
from ortools.sat.python import cp_model

def solve_vrp_exact(instance):
    model = cp_model.CpModel()
    n = instance.n_customers
    V = instance.n_vehicles

    # Variables: x[i][j][k] = 1 if vehicle k travels from i to j
    x = [[[model.NewBoolVar(f'x_{i}_{j}_{k}') for k in range(V)]
          for j in range(n+1)] for i in range(n+1)]

    # Each customer visited exactly once
    for i in range(1, n+1):
        model.Add(sum(x[i][j][k] for j in range(n+1) for k in range(V)) == 1)

    # Flow conservation (vehicles enter and leave each node)
    for k in range(V):
        for i in range(n+1):
            model.Add(sum(x[i][j][k] for j in range(n+1)) ==
                      sum(x[j][i][k] for j in range(n+1)))

    # Capacity constraints
    for k in range(V):
        model.Add(sum(instance.demands[i-1] * sum(x[i][j][k] for j in range(n+1))
                      for i in range(1, n+1)) <= instance.vehicle_capacity)

    # Minimize total distance
    model.Minimize(sum(instance.distance_matrix[i][j] * x[i][j][k]
                       for i in range(n+1) for j in range(n+1) for k in range(V)))

    solver = cp_model.CpSolver()
    solver.Solve(model)
    # ... extract routes from solution
```

## Clarke-Wright Savings Algorithm

The Clarke-Wright savings algorithm is the classic construction heuristic. It starts with each customer served by a separate route (depot → customer → depot), then computes savings for merging pairs: s_ij = d_i0 + d_0j - d_ij, where d_i0 is the distance from customer i to the depot. Merges with the highest savings are applied iteratively, respecting vehicle capacity and other constraints:

```python
def clarke_wright_savings(instance):
    n = instance.n_customers
    dist = instance.distance_matrix

    # Start with each customer on its own route
    routes = [[i] for i in range(1, n+1)]

    # Compute savings for all pairs
    savings = []
    for i in range(1, n+1):
        for j in range(i+1, n+1):
            s = dist[i][0] + dist[0][j] - dist[i][j]
            if s > 0:  # Only positive savings
                savings.append((s, i, j))

    # Sort by savings descending
    savings.sort(reverse=True, key=lambda x: x[0])

    # Merge routes
    for s, i, j in savings:
        route_i = find_route(routes, i)
        route_j = find_route(routes, j)
        if route_i is not route_j:
            merged = merge_routes(route_i, route_j, i, j)
            if merged is not None and instance.is_feasible(merged):
                routes.remove(route_i)
                routes.remove(route_j)
                routes.append(merged)

    return routes
```

The algorithm is O(n² log n) and produces reasonable solutions for medium-sized instances. I use it primarily as a warm-start for more powerful metaheuristics — even a rough Clarke-Wright solution gives LNS a better starting point than random initialization.

## Large Neighborhood Search (LNS)

Large Neighborhood Search is the state of the art for large-scale VRP. LNS repeatedly destroys part of a solution (removing 20-40% of customers) and repairs it using a greedy or dynamic programming insertion heuristic. The randomness in the destroy operator enables escape from local optima:

```python
import random

def large_neighborhood_search(instance, initial_routes, iterations=10000):
    best_routes = initial_routes
    best_cost = total_cost(initial_routes)
    current_routes = initial_routes

    for iteration in range(iterations):
        # Destroy: remove random customers
        removed = destroy_random(current_routes, remove_fraction=0.3)

        # Repair: reinsert with best-position heuristic
        repaired = repair_best_insertion(current_routes, removed, instance)

        # Accept if better, or with simulated annealing probability
        new_cost = total_cost(repaired)
        if new_cost < best_cost or random.random() < acceptance_prob(new_cost, best_cost, iteration):
            current_routes = repaired
            if new_cost < best_cost:
                best_routes = repaired
                best_cost = new_cost

    return best_routes
```

Adaptive LNS learns which destroy/repair operators perform best during search. Operators like "worst removal" (remove the most expensive customers), "route removal" (remove an entire route), and "cluster removal" (remove geographically close customers) have different strengths. The adaptive mechanism tracks each operator's performance and biases selection toward successful operators:

```python
# Operator selection with adaptive weights (simplified)
operator_weights = {op: 1.0 for op in operators}

def select_operator():
    total = sum(operator_weights.values())
    r = random.uniform(0, total)
    cumulative = 0
    for op, weight in operator_weights.items():
        cumulative += weight
        if r <= cumulative:
            return op
    return operators[-1]

def update_weights(operator, improvement):
    # Reward operators that find improvements
    score = 1 + improvement / max_improvement  # normalized [1, 2]
    operator_weights[operator] *= score
```

## OR-Tools Routing Library

Google OR-Tools' routing library implements a hybrid approach combining LNS with constraint programming. It handles time windows, capacity, pickup-and-delivery, and multiple depots. The solver uses local search with metaheuristics (guided local search, simulated annealing, tabu search) to escape local minima:

```python
from ortools.constraint_solver import routing_enums_pb2, pywrapcp

def solve_vrp_with_ortools(instance):
    # Create routing index manager
    manager = pywrapcp.RoutingIndexManager(
        instance.n_customers + 1, instance.n_vehicles, 0  # depot index
    )
    routing = pywrapcp.RoutingModel(manager)

    # Distance callback
    def distance_callback(from_idx, to_idx):
        return instance.distance_matrix[manager.IndexToNode(from_idx)][manager.IndexToNode(to_idx)]
    transit_callback_index = routing.RegisterTransitCallback(distance_callback)
    routing.SetArcCostEvaluatorOfAllVehicles(transit_callback_index)

    # Capacity constraint
    def demand_callback(from_idx):
        customer = manager.IndexToNode(from_idx)
        return instance.demands[customer-1] if customer > 0 else 0
    demand_callback_index = routing.RegisterUnaryTransitCallback(demand_callback)
    routing.AddDimensionWithVehicleCapacity(
        demand_callback_index,
        0,  # null capacity slack
        [instance.vehicle_capacity] * instance.n_vehicles,
        True,  # start cumul to zero
        'Capacity'
    )

    # Search parameters
    search_params = pywrapcp.DefaultRoutingSearchParameters()
    search_params.first_solution_strategy = (
        routing_enums_pb2.FirstSolutionStrategy.PARALLEL_CHEAPEST_INSERTION
    )
    search_params.local_search_metaheuristic = (
        routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH
    )
    search_params.time_limit.seconds = 30  # Production timeout

    solution = routing.SolveWithParameters(search_params)
    return extract_routes(routing, manager, solution)
```

OR-Tools regularly wins VRP competitions. Its strength is the combination of high-quality first solutions, extensive neighborhood operators (Or-opt, 2-opt*, cross-exchange, relocate), and metaheuristic frameworks that escape local optima efficiently.

## Practical Production Considerations

In production, VRP solvers face constraints that academic benchmarks don't capture. Driver break scheduling (mandatory 30-minute breaks every 5 hours), time-dependent travel speeds (rush hour), and stochastic service times (some deliveries take 5 minutes, others an hour) require extensions to the core algorithm. For our system, we used a two-phase approach: the solver produced a daily plan, and a real-time adjustment layer handled same-day disruptions (traffic, closed loading docks, driver sick calls).

## Real-World Case Study

For a 500-vehicle urban delivery fleet, OR-Tools with a 60-second solve timeout produced routes that reduced total driving distance by 18% compared to manual dispatching. The biggest gains came from geographic clustering that dispatchers missed — customers in the same building were often assigned to different trucks when done manually. The VRP solver naturally grouped them. The implementation took about two weeks for the core solver and another month for constraint modeling (driver preferences, vehicle compatibility with loading dock types, residential vs. commercial delivery time windows).

## For Practitioners

Start with OR-Tools for standard VRP variants — it's production-ready, handles most constraints, and has excellent documentation. Implement Clarke-Wright for quick estimates or as a warm-start metric. Consider specialized algorithms only when OR-Tools doesn't suffice: dynamic programming for small TSP (tours under 15 nodes), exact methods for academic benchmarks, and custom LNS when OR-Tools' crossover operators don't capture your problem structure. And always, always have a fallback — a solver that fails to find a feasible solution in the available time is worse than a simple heuristic that always produces a working (if suboptimal) plan.
