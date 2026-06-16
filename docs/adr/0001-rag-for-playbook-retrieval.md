# Semantic RAG for playbook retrieval, despite a small corpus

Retrieval mode resolves an engineer's diagnosed symptom to the matching playbook. We use a real retrieval-augmented pipeline (markdown playbooks, chunk-level embeddings in pgvector, semantic search returning the parent document via small-to-big retrieval) rather than the simpler catalog + LLM-pick, which would have sufficed functionally for a handful of playbooks. pgvector was chosen over a dedicated vector DB so a single Postgres instance can back both the playbook index and the deploy/log fixtures, keeping the project on one dependency.

The reason is that demonstrating a genuine RAG pipeline is an explicit goal of this project (it is a portfolio piece). Catalog + LLM-pick is technically retrieval but shows tool use, not RAG, and Investigation mode already covers agentic tool use. Splitting the two modes into two distinct retrieval paradigms (structured tool use over deploys/logs, semantic RAG over playbooks) is the stronger story and matches the design's "method matched to problem shape" thesis.

## Consequences

- The corpus carries an obligation: it must be large enough (target 10 to 15 multi-section docs) and the documents long enough that naive matching fails, otherwise nearest-neighbour over a tiny set is theatre and proves nothing.
- Parent-document retrieval is required so "show me the failover steps" returns the whole procedure, not an out-of-context chunk.
- Deploys and Logs deliberately stay structured tool calls, not RAG.
