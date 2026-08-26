# Architecture Note

## Agent Design
The agent uses a hand-written orchestration loop built around an OpenAI-compatible LLM (`gpt-4o-mini`). Instead of relying on a black-box agent framework (like LangChain), the orchestrator natively manages the conversation history, intercepts and executes tool calls server-side, and feeds results back to the model. The LLM acts purely as the reasoning engine; it does not query the database directly, nor does it enforce authorization or perform final business arithmetic.

## Tool Design
The agent is equipped with three distinct tools:
1. `document_search`: Performs hybrid search (vector + text) over chunked policy and agreement PDFs.
2. `data_lookup`: securely retrieves structured account, order, and ticket data, evaluating specific business rules (e.g. cancellation fee calculations) programmatically.
3. `draft_action`: Allows the agent to prepare state-changing actions (e.g., escalating a ticket or cancelling an order). Actions are placed in a `pending_actions` table and require explicit human confirmation via the UI to execute.

## Document and Structured-Data Handling
- **Documents (RAG):** The PDFs were ingested using `pdf-parse`, chunked, embedded using `text-embedding-3-small`, and stored in PostgreSQL using `pgvector`. Retrieval employs a hybrid search approach, combining vector similarity with Full Text Search (FTS).
- **Structured Data:** The provided Excel dataset was seeded into structured relational tables in a Neon PostgreSQL database. All data retrieval runs through repository classes scoped by Row Level Security (RLS) to enforce strict tenant isolation.

## Source Reliability and Conflict Handling
The system explicitly models the reliability of different data sources:
- **Authority Tiers:** Documents are tagged with an `authority` tier (e.g., `customer_agreement` > `current_policy` > `product_guide`). The agent is explicitly instructed to prefer customer-specific agreements over general policies.
- **Deprecation:** Outdated documents (like the v2 policy) are strictly excluded from retrieval via database-level filtering.
- **Historical Data:** Past ticket resolutions are flagged with `resolution_is_historical = true` and passed to the agent with explicit instructions to treat them as context only, as they may contain incorrect or outdated guidance.

## Major Technical Trade-offs
1. **Neon PostgreSQL over SQLite/Local Vector Stores:** We chose a robust PostgreSQL setup on Neon to leverage `pgvector` for embeddings and Row Level Security (RLS) for tenant isolation, ensuring a production-grade backend instead of a local SQLite mockup.
2. **Custom Auth vs Managed Auth:** We built a custom session-based auth system (Argon2id password hashing + HTTP-only cookies) specifically to demonstrate how identity can be securely injected into PostgreSQL transaction configurations (GUCs) to strictly enforce RLS policies, bypassing the complexities of external managed auth providers.
3. **Programmatic Math vs LLM Math:** Cancellation fees and SLA timings are calculated deterministically in backend code rather than relying on the LLM's arithmetic, ensuring high reliability for financial decisions.
