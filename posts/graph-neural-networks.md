# Graph Neural Networks: GCN, GAT Foundations

Graph Neural Networks (GNNs) extend deep learning to graph-structured data. Unlike CNNs (grids) or RNNs (sequences), GNNs operate on arbitrary graph topologies through message-passing between nodes. Two foundational architectures are Graph Convolutional Networks (GCN) and Graph Attention Networks (GAT).

The core operation is message passing. Each node aggregates features from its neighbors, transforms them, and updates its own representation. After `k` layers, a node's representation encodes information from its `k`-hop neighborhood.

GCNs simplify this with a normalized aggregation. The GCN layer computes:

```
h_i^(k+1) = σ( Σ (c_ij * W * h_j^k) )
```

Where `c_ij` is a normalization factor based on node degrees. This is a spectral approximation — GCNs perform a localized first-order approximation of graph convolution. The result is simple, fast, and effective for node classification and semi-supervised learning. GCNs treat all neighbors equally, weighted only by degree.

GATs introduce attention. Instead of fixed normalization, GAT computes attention coefficients between each node and its neighbors:

```
α_ij = softmax(LeakyReLU(a^T [W h_i || W h_j]))
```

The attention mechanism learns which neighbors matter most. This is strictly more expressive than GCNs — the model can focus on relevant neighbors and ignore irrelevant ones. Multi-head attention runs multiple attention mechanisms in parallel, stabilizing training.

Both architectures stack layers. But deep GNNs suffer from over-smoothing — after many layers, all node representations become similar. This is an active research area addressed by residual connections, jumping knowledge networks, and normalization techniques.

Applications include molecular property prediction (atoms as nodes, bonds as edges), recommendation systems (user-item interaction graphs), and citation network analysis. GCNs excel when graph structure is uniform and well-understood. GATs win when neighbor importance varies and the graph contains noise.
