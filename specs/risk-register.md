# Risk Register

## Risk 1: Big-Bang Rewrite Failure

Impact: High  
Likelihood: Medium

Problem:

Deleting the Express backend before FastAPI parity could leave the product broken.

Mitigation:

- Build `backend_py/` side-by-side.
- Keep frontend-compatible routes.
- Retire Express only after parity and tests.

## Risk 2: Tenant Data Leakage

Impact: Critical  
Likelihood: Medium

Problem:

RAG and agent tools can accidentally retrieve data from another college or unauthorized department.

Mitigation:

- Tenant context dependency.
- Tenant-specific Qdrant collections or strict metadata filters.
- RBAC checks inside tools.
- Integration tests for cross-tenant attempts.
- Eval dataset for tenant isolation.

## Risk 3: Auth Library Misfit

Impact: High  
Likelihood: Medium

Problem:

Auth libraries reduce boilerplate but do not automatically solve product-specific RBAC, tenant policy, CSRF, audit, and refresh-token requirements.

Mitigation:

- Use libraries for primitives only.
- Keep product policies explicit.
- Test auth and RBAC boundaries.

## Risk 4: Unsafe Streaming Auth

Impact: High  
Likelihood: Medium

Problem:

Passing long-lived tokens in SSE query parameters can leak through logs/history/proxies.

Mitigation:

- Prefer same-site cookies.
- Or use fetch streaming with headers.
- Avoid long-lived query tokens.

## Risk 5: Embedding Strategy Drift

Impact: Medium  
Likelihood: Medium

Problem:

Switching embedding providers changes vector dimensions and retrieval behavior.

Mitigation:

- Pick one primary embedding strategy first.
- Store embedding model/version in document metadata.
- Re-index when embedding model changes.

## Risk 6: Docling Edge Cases

Impact: Medium  
Likelihood: Medium

Problem:

Docling may not perfectly handle every PDF, image, or spreadsheet.

Mitigation:

- Benchmark on project documents.
- Keep fallback parser interface.
- Store extraction diagnostics.

## Risk 7: Agent Tool Overreach

Impact: High  
Likelihood: Medium

Problem:

Agents may take actions without enough context or user confirmation.

Mitigation:

- Start with only read-only tools.
- Add human approval for mutating tools.
- Enforce tool RBAC.
- Use hard loop limits.

## Risk 8: Tool Soup

Impact: Medium  
Likelihood: High

Problem:

Adding too many tools/frameworks can make the project harder to understand and maintain.

Mitigation:

- Every tool must have a clear owner responsibility.
- Delay frontend rewrite until backend parity.
- Avoid multi-agent architecture until a single agent graph is stable.

## Risk 9: Evals Become Decorative

Impact: Medium  
Likelihood: Medium

Problem:

Evals can become reports nobody uses.

Mitigation:

- Put evals in CI.
- Define thresholds.
- Tie failed traces to admin quality dashboard.
- Keep datasets small but high quality initially.

## Risk 10: Cost And Latency Growth

Impact: Medium  
Likelihood: Medium

Problem:

Query rewriting, reranking, multi-query retrieval, and agent loops can increase cost and latency.

Mitigation:

- Trace every stage.
- Set loop limits.
- Add model cost tracking.
- Benchmark before adding heavy retrieval features.

