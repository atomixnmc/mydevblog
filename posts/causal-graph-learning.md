# Learning Causal Graphs from Data

Learning causal relationships from observational data is one of the hardest open problems in machine learning. While correlation is easy to compute, causal structure—the directed acyclic graph (DAG) that describes how variables influence each other—must be inferred under strong assumptions.

**Constraint-based methods** (PC algorithm, FCI) test conditional independencies to prune edges. If X and Y are independent given Z, then Z blocks the causal path between X and Y. The PC algorithm starts with a complete undirected graph, tests conditional independencies to remove edges, then orients edges using collider detection patterns. The result is a CPDAG (completed partially directed acyclic graph) that represents the Markov equivalence class—all DAGs compatible with the observed independencies.

**Score-based methods** (GES, NOTEARS) search the space of DAGs for the structure that best fits the data under a scoring function. The Bayesian Information Criterion (BIC) trades off model fit against complexity. Greedy Equivalence Search (GES) starts with an empty graph, adds edges greedily, then removes edges greedily. NOTEARS reformulates the combinatorial DAG search as a continuous optimization problem by enforcing an acyclicity constraint differentiable with respect to the adjacency matrix, enabling gradient-based optimization.

**Functional causal models** (LiNGAM, ANM) make stronger assumptions about the data-generating process. LiNGAM assumes linear relationships with non-Gaussian noise, enabling identification of the full DAG (not just the equivalence class) through independent component analysis. Additive Noise Models assume Y = f(X) + ε where ε is independent of X. If the model fits in one direction but not the reverse, the causal direction is identified—asymmetry that doesn't exist under symmetric Gaussian noise.

**Latent variable challenges**: Unobserved confounders create spurious associations that differ from causal effects. The FCI algorithm handles latent confounders by outputting a Partial Ancestral Graph (PAG) that represents uncertainty about whether edges represent direct causation, latent confounding, or selection bias. When strong assumptions about no latent confounders fail, FCI provides sound but less informative results.

**Evaluation without ground truth**: Without known causal graphs (rare in real applications), evaluation uses prediction tasks (does the causal model predict intervention outcomes better than purely associational models?), stability across resamples, and expert domain validation. Synthetic data with known ground truth benchmarks (G-Sim, CausalBench) provides standardized evaluation.

The field is converging on hybrid methods: use constraint-based tests to prune the search space, score-based optimization to select among remaining structures, and domain knowledge to orient edges the data cannot distinguish.
