# Multi-Objective Logistic Optimization

Single-objective optimization minimizes one metric (cost, time, distance). Multi-objective optimization trades off multiple conflicting metrics simultaneously — minimizing both cost AND time, when faster routes are more expensive.

## The Problem

A delivery fleet needs to balance:

- **Cost**: Fuel, driver wages, vehicle wear
- **Time**: Delivery windows, customer satisfaction
- **Emissions**: Carbon footprint, regulatory compliance
- **Utilization**: Truck fill rate, driver hours

These objectives are conflicting. Minimizing cost (consolidate loads, run fewer trucks) increases delivery time. Minimizing time (more trucks, direct routes) increases cost and emissions.

## Pareto Front

Instead of a single optimal solution, multi-objective optimization finds a set of Pareto-optimal solutions — solutions where improving one objective worsens at least one other:

```python
class ParetoFront:
    def __init__(self):
        self.solutions = []

    def add(self, solution):
        # Dominance check
        dominated = False
        self.solutions = [
            s for s in self.solutions
            if not self._dominates(solution, s)
        ]
        if not any(self._dominates(s, solution) for s in self.solutions):
            self.solutions.append(solution)

    def _dominates(self, a, b):
        """Returns True if a dominates b (a better or equal in all objectives,
        strictly better in at least one)"""
        better_in_any = False
        worse_in_any = False
        for oa, ob in zip(a.objectives, b.objectives):
            if oa < ob:  # Lower is better
                better_in_any = True
            elif oa > ob:
                worse_in_any = True
        return better_in_any and not worse_in_any
```

## NSGA-II Algorithm

We use NSGA-II (Non-dominated Sorting Genetic Algorithm II) for route optimization:

```python
def nsga2(population_size, generations, objectives, constraints):
    population = initialize_population(population_size)
    for gen in range(generations):
        # Non-dominated sorting
        fronts = fast_non_dominated_sort(population)
        # Crowding distance for diversity
        for front in fronts:
            crowding_distance(front, objectives)
        # Selection
        parents = tournament_selection(population, 2)
        # Crossover and mutation
        offspring = crossover_and_mutate(parents, constraints)
        # Combine and trim
        population = environmental_selection(
            population + offspring, population_size
        )
    return pareto_front(population)
```

We use NSGA-II because: it handles mixed discrete/continuous variables (route choices are discrete, speed choices are continuous), it maintains solution diversity (crowding distance prevents clumping), and it converges reliably for up to 5 objectives. Beyond 5 objectives, we switch to MOEA/D (decomposition-based) which handles high-dimensional objective spaces better.

## Application to Fleet Routing

```python
problem = RouteProblem(
    num_stops=50,
    num_vehicles=5,
    depot=(0, 0),
    time_windows={
        "stop_10": (8*60, 10*60),  # 8:00-10:00 AM
        "stop_25": (9*60, 11*60),
    },
    vehicle_costs={
        "diesel": {"per_km": 0.8, "per_hour": 25},
        "electric": {"per_km": 0.2, "per_hour": 20},
    },
    objectives=["cost", "time", "emissions"],
)

solver = NSGA2Solver(population=200, generations=500)
pareto = solver.solve(problem)

# Print the trade-off surface
for solution in pareto.solutions[:10]:
    print(f"Cost: ${solution.cost:.2f}, Time: {solution.time:.1f}h, "
          f"Emissions: {solution.emissions:.1f}kg CO2")
```

Output:
```
Cost: $1,234, Time: 8.2h, Emissions: 245kg CO2
Cost: $1,450, Time: 7.1h, Emissions: 210kg CO2
Cost: $1,670, Time: 6.5h, Emissions: 180kg CO2
...
```

The Pareto front shows the trade-off. Paying 17% more ($1,234 → $1,450) saves 1.1 hours and 35kg CO2. Paying 35% more saves 1.7 hours and 65kg CO2. The dispatcher picks the solution that aligns with business priorities — typically the "knee" point where improvements diminish.

## Interactive Decision Making

We expose the Pareto front in an interactive dashboard where dispatchers can explore trade-offs:

```python
def show_interactive(problem, pareto):
    """Returns an interactive slider for dispatcher to explore"""
    # Dispatcher drags slider: "cost vs time preference"
    weight = dispatcher.slider_value  # 0.0 = prefer cost, 1.0 = prefer time

    # Find solution closest to preference
    best = min(pareto.solutions, key=lambda s:
        weight * s.time + (1 - weight) * s.cost)

    show_map(best.routes)
    show_metrics(best.objectives)
```

The dispatcher adjusts a single slider that controls the weight between objectives. The route map updates in real-time. This interactive exploration reveals solutions a solver would never find with fixed weights — dispatchers discover novel routes that exploit local knowledge the model doesn't capture (road conditions, driver preferences, customer relationships). We then feed these human-discovered routes back as initial solutions for the next optimization run.