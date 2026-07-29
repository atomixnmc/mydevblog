# HyperGraph vs RDF: Graph Data Models Compared

HyperGraph and RDF represent two fundamentally different approaches to graph data modeling. Understanding their differences is essential for choosing the right graph technology for a given use case.

**RDF (Resource Description Framework)** models everything as triples: subject-predicate-object statements. "Alice knows Bob" becomes `:Alice :knows :Bob`. This simplicity enables federated queries across datasets using SPARQL. RDF's semantics are grounded in description logic, enabling inference—the ability to derive implicit facts from explicit ones through OWL or RDFS ontologies. The tradeoff is that modeling n-ary relationships (a contract involving three parties) requires reification, which creates artificial complexity.

**HyperGraph** represents relationships as hyperedges connecting arbitrary numbers of vertices. The same contract scenario is a single hyperedge `:CONTRACT (:Alice, :Bob, :Carol, :ContractDoc)` with attributes on the edge itself. No reification needed. The model maps naturally to real-world relationships: team membership, multi-party transactions, chemical reactions, and document co-authorship.

**Query language differences**: SPARQL queries over reified RDF triples become verbose and hard to optimize. A query like "find all contracts involving Alice and Bob as co-signers" requires complex self-joins over triple patterns connected through blank nodes. HyperGraph's query language expresses this as a direct hyperedge pattern: `MATCH (a:Person {name:"Alice"}, b:Person {name:"Bob"}) -[CONTRACT]-> (others)`.

**Storage implications**: RDF stores typically use triple indexes (six permutations of subject-predicate-object) for fast access in any access pattern. This creates significant storage overhead. HyperGraph's adjacency lists with hyperedge pointers are more compact for dense graphs with multi-way relationships. Columnar attribute storage on hyperedges eliminates the need for separate property tables.

**Inference capabilities**: RDF's description logic foundation provides theoretical guarantees for entailment regimes. HyperGraph typically doesn't support ontology-based inference natively, instead pushing reasoning to application code or specialized rule engines. This is a tradeoff: RDF wins for semantic web use cases requiring ontological reasoning; HyperGraph wins for operational graph workloads where schema flexibility and query performance matter more.

**When to choose**: RDF for knowledge graphs, data federation, and semantic reasoning. HyperGraph for transactional graph applications with complex multi-way relationships—collaboration platforms, compliance systems, supply chain networks with shared resources.
