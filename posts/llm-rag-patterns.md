# RAG Patterns

Retrieval-Augmented Generation (RAG) grounds LLM outputs in external data. Without RAG, an LLM answers from its training data cutoff. With RAG, it queries a knowledge base, retrieves relevant documents, and generates answers conditioned on those documents.

## The Basic Pipeline

```
User Query ──► Embedding ──► Vector Search ──► Retrieved Docs
                                      │
                                      ▼
                               LLM Prompt ──► Generated Answer
```

The query is embedded into a vector, nearest neighbors are found in a vector database (Pinecone, Qdrant, pgvector), and the retrieved documents are injected into the prompt. This is the simplest form and works well for Q&A over a fixed corpus.

## Chunking Strategies

The quality of retrieval depends heavily on chunking. Too-small chunks miss context; too-large chunks dilute relevance:

```python
def chunk_document(text: str, strategy: str) -> list[str]:
    if strategy == "recursive":
        # Split by paragraphs, then sentences, then clauses
        chunks = []
        for para in text.split("\n\n"):
            if len(para) > 500:
                for sent in para.split(". "):
                    chunks.append(sent)
            else:
                chunks.append(para)
        return chunks
    elif strategy == "semantic":
        # Use embeddings to find natural breakpoints
        return semantic_chunk(text, max_tokens=300)
```

Recursive character splitting is the simplest and often sufficient. Semantic chunking (using embeddings to detect topic shifts) is more accurate but requires an additional embedding pass. We found that 256-token chunks with 32-token overlap works well for most technical documentation — enough context for code snippets with minimal noise.

## Multi-Hop RAG

Simple RAG fails for questions requiring multiple retrievals:

> "What is the capital of the country where Maria was born?"

This needs: (1) find Maria → (2) find her birthplace → (3) find the capital of that country. Multi-hop RAG chains retrievals, feeding each answer into the next query:

```python
def multi_hop_rag(query: str, k: int = 3):
    results = []
    current_query = query
    for hop in range(k):
        docs = vector_search(current_query)
        results.extend(docs)
        # Extract entities for the next query
        current_query = extract_next_query(current_query, docs)
    return results
```

In practice, 2-3 hops covers most multi-step questions. Beyond 3 hops, the LLM tends to lose track of the original question. We implemented a "re-query" check after each hop to confirm the retrieved documents are on track — if the cosine similarity between the query and top result drops below 0.7, we rephrase and retry.

## Hybrid Search

Pure vector search misses exact matches. Hybrid search combines vector similarity with keyword (BM25) scoring:

```python
def hybrid_search(query: str, alpha: float = 0.5):
    vector_results = vector_search(query)
    keyword_results = bm25_search(query)
    # Reciprocal Rank Fusion
    combined = {}
    for rank, (doc, score) in enumerate(vector_results + keyword_results):
        combined[doc.id] = combined.get(doc.id, 0) + 1 / (60 + rank)
    return sorted(combined.items(), key=lambda x: x[1], reverse=True)
```

The `alpha` parameter controls the weight between vector and keyword. For code-heavy retrieval (function names, API calls), alpha=0.3 (favoring keywords) works better. For conceptual questions about architecture, alpha=0.7 (favoring vectors). We expose this as a per-query parameter so users can tune it — power users set it per query, while the default 0.5 works well for general use.

RAG is not a solved problem. Chunking, retrieval, and prompt construction each have trade-offs that depend on your data and use case. The patterns above cover the common cases, but every production RAG system I've seen has custom heuristics learned from failure analysis.