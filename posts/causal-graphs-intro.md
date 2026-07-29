# Causal Graphs: An Introduction

Causal graphs, also known as Directed Acyclic Graphs (DAGs) in causal inference, represent assumptions about cause-effect relationships between variables. They are the foundation of Judea Pearl's causal inference framework and provide a rigorous language for reasoning about interventions and counterfactuals.

In a causal graph, nodes represent variables. Directed edges represent direct causal relationships. A → B means A causes B. The key property: the graph encodes conditional independence relationships through d-separation. Two variables are d-separated if every path between them contains a collider (a node where two arrowheads meet) that isn't conditioned on, or a non-collider that is conditioned on.

Causal graphs distinguish between three fundamental junction types. Chains (A → B → C): A and C are conditionally independent given B. Forks (A ← B → C): A and C are conditionally independent given B. Colliders (A → B ← C): A and C are marginally independent but become dependent when conditioning on B. Colliders are the most counterintuitive — conditioning on a common effect creates an induced association between its causes.

The do-operator is central to causal reasoning. `P(Y | do(X))` represents the distribution of Y after intervening to set X to a specific value, as opposed to `P(Y | X)` which is mere observation. Causal graphs help identify when a causal effect can be estimated from observational data using the back-door criterion or front-door criterion.

Practical applications are widespread. Epidemiologists use causal graphs to decide which variables to adjust for. Economists apply them to instrument variable analysis. Machine learning teams use them to detect and correct for confounding in A/B tests.

The power of causal graphs is that they make assumptions explicit. Two analysts may draw different graphs, leading to different conclusions — but the debate shifts from statistical methodology to substantive domain knowledge.
