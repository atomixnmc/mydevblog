# Causal Graphs: An Introduction

Causal graphs, also known as Directed Acyclic Graphs (DAGs) in causal inference, represent assumptions about cause-effect relationships between variables. They are the foundation of Judea Pearl's causal inference framework and provide a rigorous language for reasoning about interventions and counterfactuals.

I originally learned causal graphs to solve a practical problem: HyperGraph's knowledge graph needed to distinguish correlation from causation when analyzing entity relationships. Two entities might co-occur in documents frequently, but that doesn't mean one causes the other. Causal graphs gave us the formalism to make this distinction explicit.

## The Structure of a Causal Graph

In a causal graph, nodes represent variables. Directed edges represent direct causal relationships. A → B means A causes B. The fundamental rule: edges follow the flow of causation, not correlation.

A causal graph must be acyclic—no variable can cause itself through a chain. If A causes B and B causes C, you can't also have C cause A. This acyclicity constraint reflects the temporal nature of causation: causes precede effects. A causal loop would mean an effect precedes its own cause.

```python
# Representing a causal graph in code
class CausalGraph:
    def __init__(self):
        self.nodes = set()
        self.edges = {}    # parent -> [children]
        self.parents = {}  # child -> [parents]

    def add_edge(self, cause, effect):
        self.nodes.add(cause)
        self.nodes.add(effect)
        self.edges.setdefault(cause, []).append(effect)
        self.parents.setdefault(effect, []).append(cause)

    def is_dag(self):
        """Check acyclicity via topological sort"""
        visited = set()
        in_progress = set()

        def dfs(node):
            if node in in_progress:
                return False  # Cycle detected
            if node in visited:
                return True
            in_progress.add(node)
            for child in self.edges.get(node, []):
                if not dfs(child):
                    return False
            in_progress.remove(node)
            visited.add(node)
            return True

        for node in self.nodes:
            if node not in visited:
                if not dfs(node):
                    return False
        return True
```

## d-Separation: Reading Independence from Graphs

The key property of causal graphs: they encode conditional independence relationships through d-separation (d for directional). Two variables are d-separated if every path between them is "blocked" by the structure of the graph.

A path is blocked if it contains:
- A **chain** (A → B → C) where B is conditioned on.
- A **fork** (A ← B → C) where B is conditioned on.
- A **collider** (A → B ← C) where B is NOT conditioned on (and neither are its descendants).

```python
def is_d_separated(graph, X, Y, Z=set()):
    """Check if X and Y are d-separated given Z (conditioning set)"""
    # Algorithm: find all paths between X and Y
    # Check each path for blocking

    def is_path_blocked(path):
        """Check if a single path is blocked by Z"""
        for i in range(1, len(path) - 1):
            prev, node, next = path[i-1], path[i], path[i+1]

            is_chain = graph.has_edge(prev, node) and graph.has_edge(node, next)
            is_fork = graph.has_edge(node, prev) and graph.has_edge(node, next)
            is_collider = graph.has_edge(prev, node) and graph.has_edge(next, node)

            if is_chain or is_fork:
                if node in Z:
                    return True  # Blocked: conditioned on non-collider
            elif is_collider:
                if node not in Z and all(desc not in Z for desc in graph.descendants(node)):
                    pass  # Not blocked: collider not conditioned on
                else:
                    return True  # Blocked: collider conditioned on
        return False  # Path is open (unblocked)

    for path in graph.all_paths(X, Y):
        if not is_path_blocked(path):
            return False  # Found an unblocked path -> not d-separated
    return True  # All paths blocked -> d-separated
```

The collider case is the most counterintuitive and the most important for causal reasoning. Two independent causes of a common effect become dependent when you condition on the effect. This is known as Berkson's paradox or collider bias.

## The Three Fundamental Junctions

These three patterns are the building blocks of causal reasoning. Understanding them deeply makes graph reading automatic.

**Chains (A → B → C).** A causes B, and B causes C. A and C are marginally dependent (A affects B, B affects C). But conditioning on B blocks the flow of information: given B, A provides no additional information about C. This is the causal interpretation of Markov property.

Real example: Smoking → Tar in Lungs → Lung Cancer. Smoking and lung cancer are correlated. But if you know the tar level in someone's lungs, knowing their smoking status tells you nothing more about their cancer risk.

**Forks (A ← B → C).** A and C share a common cause B. They are marginally dependent (both are caused by B). But conditioning on B blocks the spurious association. This is the classic confounder scenario.

Real example: Ice Cream Sales ← Temperature → Drowning Deaths. Ice cream sales and drowning deaths are correlated. But they're both caused by summer heat. Condition on temperature, and the association disappears.

**Colliders (A → B ← C).** A and C both cause B. They are marginally independent (no causal path between them). BUT conditioning on B induces an association. This is the least intuitive and most dangerous pattern.

Real example: Talent → Hiring ← Beauty. Talent and beauty are independent in the population. But among hired candidates (conditioning on hiring), talented candidates are more likely to be less beautiful, and beautiful candidates are more likely to be less talented. You've induced a negative correlation between talent and beauty by conditioning on the hiring outcome.

```python
# Demonstrating collider bias with simulation
import numpy as np
import pandas as pd

# Simulate independent talent and beauty
np.random.seed(42)
n = 10000
talent = np.random.normal(0, 1, n)
beauty = np.random.normal(0, 1, n)

# Hiring depends on talent + beauty (+ noise)
hiring_score = talent + beauty + np.random.normal(0, 0.5, n)
hired = hiring_score > np.median(hiring_score)

df = pd.DataFrame({
    'talent': talent,
    'beauty': beauty,
    'hired': hired
})

# Correlation in full population
print(df['talent'].corr(df['beauty']))
# ~0.0 (independent)

# Correlation among hired candidates
print(df[df['hired']]['talent'].corr(df[df['hired']]['beauty']))
# ~-0.3 (negative correlation induced by conditioning on hiring)
```

This simulation shows exactly what happens when you condition on a collider. The induced association is not causal—it's a statistical artifact. But it looks real, which is why collider bias is responsible for countless spurious findings in epidemiology, economics, and social science.

## The do-Operator

The do-operator is the cornerstone of causal reasoning. `P(Y | do(X))` represents the distribution of Y after intervening to set X to a specific value, as opposed to `P(Y | X)` which is mere observation.

The critical distinction: `P(Y | X = x)` tells you how Y varies across subpopulations where X happens to be x. `P(Y | do(X = x))` tells you how Y would change if you forced X to be x for everyone.

In a causal graph, the do-operator removes all incoming edges to the intervened variable (you're setting its value, not observing it). This graphical operation is called the "mutilation" of the causal graph:

```python
def do_intervention(graph, variable, value):
    """Create the mutilated graph for do(X=value)"""
    # Remove all incoming edges to the intervened variable
    for parent in graph.parents.get(variable, []):
        graph.edges[parent].remove(variable)
    graph.parents[variable] = []

    # The intervention removes all causal influence on X
    # X is now set to value, not caused by its parents
    return graph
```

The difference between seeing and doing is why observational data alone is insufficient for causal claims. Without a causal graph, you cannot distinguish `P(Y | X)` from `P(Y | do(X))`.

## The Back-Door Criterion

The back-door criterion identifies when a causal effect can be estimated from observational data. A set of variables Z satisfies the back-door criterion relative to (X, Y) if:

1. No node in Z is a descendant of X.
2. Z blocks every path between X and Y that contains an arrow into X (a "back-door" path).

When Z satisfies the back-door criterion, the causal effect is identifiable:

```
P(Y | do(X = x)) = Σ_z P(Y | X = x, Z = z) P(Z = z)
```

```python
def backdoor_adjustment(data, X, Y, Z):
    """
    Estimate P(Y | do(X=x)) using back-door adjustment
    Adjusting for confounders Z
    """
    result = {}
    for x_val in data[X].unique():
        total = 0
        for z_val, weight in get_strata_weights(data, Z):
            subset = data[(data[X] == x_val) & (Z == z_val)]
            total += subset[Y].mean() * weight
        result[x_val] = total
    return result
```

In practice, applying the back-door criterion means: "What variables confound the relationship between X and Y? Control for those." The causal graph makes explicit what those confounders are.

## The Front-Door Criterion

The front-door criterion handles cases where confounders are unobserved (and thus can't be adjusted for). If there's a mediator M that sits on the causal path from X to Y, and M is not affected by the confounders, the front-door criterion provides an alternative identification strategy:

```
P(Y | do(X = x)) = Σₘ P(M = m | X = x) × Σ_{x'} P(Y | X = x', M = m) P(X = x')
```

The front-door criterion is more restrictive but also more robust: it works when you cannot measure the confounders at all.

## Practical Applications

Causal graphs are not academic exercises. They have direct practical applications.

**A/B testing.** When you randomize treatment assignment, you break all incoming edges to the treatment variable. The do-operator becomes equivalent to observation: `P(Y | do(T)) = P(Y | T)` in a randomized experiment. Causal graphs explain exactly why randomization works—it eliminates back-door paths.

**Confounder selection.** Epidemiologists use causal graphs to decide which variables to adjust for. Adjust for confounders. Do NOT adjust for colliders (you'll induce bias). Do NOT adjust for mediators (you'll block the causal path you're trying to measure). The graph makes these decisions explicit.

```python
# Bad adjustment: conditioning on a mediator
# X -> M -> Y
# Adjusting for M blocks the causal path
# You'll underestimate the effect of X on Y

# Good adjustment: conditioning on a confounder
# X <- Z -> Y
# Adjusting for Z removes the spurious association
# You'll correctly estimate the effect of X on Y
```

**Instrumental variables.** When both confounders and mediators are problematic, instrumental variables provide an alternative. An instrument Z must: (1) cause X, (2) affect Y only through X, and (3) not share causes with Y. The causal graph makes these three conditions visually checkable.

**Causal discovery.** Given enough observational data, some causal relationships can be discovered algorithmically. Algorithms like PC, FCI, and GES search for graphs that are consistent with the observed conditional independence structure. The results are always compatible with multiple graphs (the equivalence class), but they narrow down the possibilities.

## The Limits of Causal Graphs

Causal graphs are not a panacea. They have fundamental limitations:

1. **Hidden confounders.** If there's an unobserved variable that causes both X and Y, the graph can't help. The back-door criterion requires measured confounders.
2. **Equivalence classes.** Multiple graphs can imply the same conditional independence structure. You cannot distinguish them from data alone.
3. **Measurement error.** If variables are measured with error, the conditional independence relationships in the graph may not hold in the data.
4. **Feedback loops.** Causal graphs are acyclic by definition. Systems with feedback (e.g., supply and demand) require more complex models.

## Why Causal Graphs Matter for AI

For AI systems like HyperGraph's knowledge graph, causal graphs provide something that pure statistical models cannot: the ability to reason about interventions. A recommendation system that learns correlations recommends what's popular. A recommendation system that learns causes recommends what would actually help the user.

The difference is the do-operator. "What do users like?" is an observational question. "What would happen if we showed users this?" is a causal question. Causal graphs are the bridge between them.

The power of causal graphs is that they make assumptions explicit. Two analysts may draw different graphs, leading to different conclusions—but the debate shifts from statistical methodology to substantive domain knowledge. That's a much more productive argument to have.

## Causal Discovery: Learning Graphs from Data

In many real-world scenarios, we don't know the causal graph—we have to discover it from observational data. Causal discovery algorithms search the space of possible graphs to find one that's consistent with the observed conditional independence relationships.

The **PC algorithm** (named after its creators Peter Spirtes and Clark Glymour) is the classic constraint-based approach:

1. Start with a complete undirected graph (all variables connected).
2. Test conditional independence between every pair of variables given increasingly large conditioning sets.
3. Remove edges when variables are conditionally independent.
4. Orient edges using collider detection and acyclicity constraints.

```python
# Simplified PC algorithm
from itertools import combinations
from scipy.stats import chi2_contingency

def pc_algorithm(data, alpha=0.05):
    """PC algorithm for causal discovery from observational data"""
    variables = list(data.columns)
    n = len(variables)

    # Step 1: Start with complete undirected graph
    graph = {v: set(variables) - {v} for v in variables}

    # Step 2: Remove edges based on conditional independence
    for sep_size in range(n):  # Increasing conditioning set size
        for x, y in combinations(variables, 2):
            if y not in graph[x]:
                continue  # Edge already removed
            # Try all conditioning sets of current size
            candidates = graph[x] - {y}
            for Z in combinations(candidates, sep_size):
                p_value = conditional_independence_test(data, x, y, Z)
                if p_value > alpha:
                    graph[x].remove(y)
                    graph[y].remove(x)
                    break

    # Step 3: Orient edges (collider detection)
    for x, y, z in triplets(graph):
        # If x - y - z is a chain or fork, don't orient
        # If x - y - z is a collider (x -> y <- z), orient edges toward y
        if is_collider(data, x, y, z, alpha):
            graph[x].add_directed_edge(y)  # x -> y
            graph[z].add_directed_edge(y)  # z -> y

    return graph
```

The PC algorithm produces a **completed partially directed acyclic graph** (CPDAG)—a representation of the equivalence class of DAGs that are consistent with the data. Some edges will be directed (the causal direction is determined), while others remain undirected (we can't tell direction from data alone).

**Greedy equivalence search** (GES) is a score-based alternative that searches the space of CPDAGs directly. It starts with an empty graph and adds edges (forward phase), then removes edges (backward phase), guided by a score like Bayesian Information Criterion (BIC). GES is more computationally expensive than PC but produces better results on sparse graphs.

## Instrumental Variables: Causal Identification Without Randomization

When you can't randomize and confounders are unobserved, instrumental variables (IV) provide an alternative identification strategy. A variable Z is an instrument for the effect of X on Y if:

1. Z causes X (relevance)
2. Z affects Y only through X (exclusion restriction)
3. Z shares no common causes with Y (exogeneity)

```python
# Two-stage least squares (2SLS) for instrumental variable estimation
import statsmodels.api as sm
from statsmodels.sandbox.regression.gmm import IV2SLS

def iv_estimate(data, instrument, treatment, outcome, controls):
    """
    Estimate causal effect of treatment on outcome using instrument
    data: pandas DataFrame
    instrument: column name for Z
    treatment: column name for X
    outcome: column name for Y
    controls: list of column names for additional covariates
    """
    # First stage: regress X on Z
    X_first = sm.add_constant(data[[instrument] + controls])
    first_stage = sm.OLS(data[treatment], X_first).fit()
    data['X_hat'] = first_stage.fittedvalues

    # Second stage: regress Y on predicted X
    X_second = sm.add_constant(data[['X_hat'] + controls])
    second_stage = sm.OLS(data[outcome], X_second).fit()

    return second_stage.params['X_hat']
```

The intuition: the first stage isolates the variation in X that's driven by the instrument (which is exogenous). The second stage estimates how this exogenous variation affects Y. Any confounding that affects both X and Y is excluded because it doesn't affect the instrument.

In practice, finding valid instruments is extremely difficult. The exclusion restriction and exogeneity are untestable assumptions—they must be justified by domain knowledge. This is why randomized experiments remain the gold standard for causal inference.

## Do-Calculus: A Complete Causal Inference System

Judea Pearl's do-calculus provides three rules that, together, are complete: any causal effect that is identifiable from a given causal graph can be reduced to an expression involving only observational probabilities using these rules.

**Rule 1 (Insertion/deletion of observations)**: P(y | do(x), z, w) = P(y | do(x), w) if Y and Z are d-separated given X, W in the mutilated graph.

**Rule 2 (Action/observation exchange)**: P(y | do(x), do(z), w) = P(y | do(x), z, w) if Y and Z are d-separated given X, W in the mutilated graph where arrows into Z are removed.

**Rule 3 (Insertion/deletion of actions)**: P(y | do(x), do(z), w) = P(y | do(x), w) if there are no causal paths from Z to Y in the mutilated graph.

While the do-calculus is powerful, applying it manually is tedious. In practice, most causal identification problems are solved using the back-door criterion (which is a special case of do-calculus). But for complex graphs with unobserved confounders and multiple paths, the do-calculus provides the complete solution.

## Causal Graphs in Modern AI Systems

Causal reasoning is increasingly integrated into AI systems. Here are practical applications I've implemented or studied:

**Debiasing recommendation systems.** Recommendation systems learn correlations that often encode bias. A music recommendation system trained on historical data learns that users who listen to hip-hop are more likely to follow hip-hop artists—but this confounds genre preference with artist exposure. Causal graphs separate the true causal effect (genre → preference) from the bias (exposure → familiarity → preference). Adjusting for exposure using back-door criteria reduces filter bubbles.

**Out-of-distribution generalization.** Machine learning models fail when test data differs from training data (distribution shift). Causal models, by learning the underlying mechanisms rather than correlations, are more robust to distribution shifts. If you've learned the causal graph, you can predict how the system behaves under interventions that change the data distribution.

```python
# Causal debiasing for a recommendation system
def debiased_recommendation(user, items, exposure_model, preference_model):
    """
    Generate recommendations adjusted for exposure bias
    exposure_model: predicts P(exposed | user, item)
    preference_model: predicts P(click | user, item, exposed)
    """
    scores = []
    for item in items:
        # P(click | do(exposed=1)) = causal effect of exposure
        # Using back-door adjustment for confounders (user demographics, item popularity)
        causal_click_prob = backdoor_adjustment(
            data=user_history,
            X='exposed',
            Y='click',
            Z=['user_age', 'user_region', 'item_popularity', 'item_category']
        )
        scores.append((item, causal_click_prob))
    return sorted(scores, key=lambda x: x[1], reverse=True)
```

**Explainable AI.** Causal graphs provide built-in explainability. When a model makes a prediction, you can trace the causal path: "This loan was denied because credit score was low, which was caused by late payments, which was caused by..." The explanation is a chain of causes, not a list of correlated features.

## The Limitations Matter

Causal graphs are not a silver bullet. They require strong assumptions (the graph structure, no hidden confounders, no measurement error). But they make those assumptions explicit—and that's their greatest strength.

A regression analysis that claims "X causes Y" is hiding assumptions about confounders, mediators, and colliders. A causal graph analysis that claims "X causes Y, assuming no unobserved confounders and the following graph structure..." is transparent about what it assumes. The second analysis is easier to critique, which makes it more scientific.

In the era of machine learning systems that find correlations at unprecedented scale, causal reasoning is more important than ever. Correlations from massive datasets are still correlations. Causal graphs are the tool that helps us distinguish signal from spurious association.

For HyperGraph, causal graphs provide the formal language to distinguish "entities that are related" from "entities that cause each other." The distinction is critical for any system that makes decisions based on discovered relationships. Without causal reasoning, you're one spurious correlation away from a catastrophic recommendation.

That's not a theoretical risk. It's a production reality.

The power of causal graphs is that they make assumptions explicit. Two analysts may draw different graphs, leading to different conclusions—but the debate shifts from statistical methodology to substantive domain knowledge. That's a much more productive argument to have.
