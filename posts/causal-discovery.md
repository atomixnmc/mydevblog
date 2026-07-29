# Causal Discovery Algorithms

Causal discovery aims to infer causal structures from observational data. The goal is to recover the directed acyclic graph (DAG) that generated the data, using only statistical patterns in the observed variables. This is fundamentally harder than causal inference (which assumes the graph is known) because multiple graphs may explain the same observations.

The three main families of causal discovery algorithms are constraint-based, score-based, and functional-causal-model approaches.

Constraint-based methods (PC algorithm, FCI) use conditional independence tests. They start with a fully connected undirected graph and remove edges when variables are conditionally independent. Then they orient edges using collider detection rules. The PC algorithm assumes no latent confounders. FCI relaxes this to handle hidden variables but produces partial graphs with uncertainty edges. The output is a Completed Partially Directed Acyclic Graph (CPDAG) representing the Markov equivalence class.

Score-based methods (Greedy Equivalence Search, Bayesian scoring) search the space of DAGs, assigning each candidate graph a score based on how well it fits the data (BIC, Bayesian Dirichlet equivalent). The search is combinatorial, so heuristic search with equivalence class moves is essential. GES starts with an empty graph and adds edges greedily, then prunes.

Functional causal model methods (LiNGAM, additive noise models) make stronger assumptions: the effect is a function of its cause plus independent noise. If the noise distribution is non-Gaussian or the function is non-linear, the direction of causation becomes identifiable — X → Y produces a different joint distribution than Y → X. This breaks the symmetry that limits constraint-based methods.

Sample efficiency varies dramatically. PC requires thousands of samples for reliable tests. LiNGAM works with hundreds but requires non-Gaussianity. For real-world applications, combining multiple methods and validating with domain knowledge is standard practice.

Causal discovery is active research. No algorithm guarantees recovering the true graph from observational data without strong assumptions, but they provide hypotheses that can be tested with experiments.
