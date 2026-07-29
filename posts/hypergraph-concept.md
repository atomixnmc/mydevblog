# HyperGraph: Data + Index + Program

HyperGraph is a conceptual architecture that unifies data storage, indexing, and computation into a single graph structure. Unlike traditional systems that separate databases, search indexes, and application logic, HyperGraph represents all three as graph operations.

The core idea: every piece of data is a node. Every relationship is an edge. Every computation is a traversal pattern. A query is a subgraph pattern match. An index is a pre-materialized traversal path. A program is a sequence of graph transformations.

This unification eliminates the impedance mismatch between layers. In a traditional stack, data moves from database (rows/tables) to index (inverted lists) to application logic (objects/functions). Each transformation requires serialization, schema mapping, and data copying. HyperGraph stores everything in one graph native format.

The data layer uses a property graph model. Nodes have types and attributes. Edges have labels and direction. This handles both structured data (user profiles, orders) and semi-structured data (event streams, logs) without schema migrations.

The index layer is not external — it's embedded in the graph. Index structures like B-trees and inverted lists are graphs. A B-tree node connects to its children. An inverted index term connects to document nodes. Index traversals are graph traversals.

The program layer represents computation as graph transformations. A MapReduce job becomes a graph traversal with aggregation. A neural network layer becomes a bipartite graph of weighted edges. The execution engine optimizes traversals across data, index, and compute boundaries.

HyperGraph is more vision than production reality, but systems like Dgraph, TerminusDB, and Apache Age implement aspects of this unification. The true HyperGraph remains an aspirational architecture that would eliminate the database-index-application boundary entirely.
