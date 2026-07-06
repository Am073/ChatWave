# Quality Plan

## Testing Pyramid

### Unit Tests

Test:

- Config validation
- Auth helpers
- Tenant context extraction
- Role policies
- Agent node functions
- Prompt-injection checks
- Citation validators

Tools:

- pytest
- pytest-asyncio
- pytest-mock

### API Tests

Test:

- Auth flows
- Chat route
- Upload route
- Announcement route
- Admin route
- Health route

Tools:

- httpx.AsyncClient
- pytest-asyncio

### Integration Tests

Test with real services where correctness depends on service behavior:

- MongoDB tenant filters
- Qdrant collection/filter behavior
- Redis/Celery enqueue behavior

Tools:

- testcontainers-python

### AI Quality Tests

Test:

- Faithfulness
- Answer relevancy
- Context precision
- Context recall
- Citation correctness
- Refusal accuracy
- Tool-call accuracy
- Prompt-injection resistance
- Tenant-isolation behavior

Tools:

- Ragas
- DeepEval
- Langfuse datasets/traces

## Golden Datasets

Required datasets:

- `golden_qa.jsonl`: normal institutional questions with expected answers/facts
- `expected_sources.jsonl`: questions with expected source documents
- `prompt_injection.jsonl`: malicious document/user prompts
- `tenant_isolation.jsonl`: cross-college leakage attempts
- `refusal.jsonl`: questions that should not be answered
- `tool_calls.jsonl`: cases requiring controlled tools

## CI Gates

Initial gates:

- Lint passes.
- Type checks pass.
- Unit tests pass.
- API tests pass.
- Tenant isolation tests pass.
- RAG evals run and report metrics.

Later gates:

- Faithfulness above threshold.
- Context recall above threshold.
- Citation correctness above threshold.
- Prompt injection cases pass.
- No critical security regression.

## Observability Requirements

Every AI request must record:

- trace id
- user id
- tenant
- role
- session id
- prompt version
- model name
- input/output tokens
- estimated cost
- retrieval latency
- generation latency
- total latency
- retrieved chunks
- selected context
- tool calls
- final answer
- sources
- errors

## Release Readiness

A release is ready when:

- All critical tests pass.
- Eval metrics do not regress.
- New endpoints are documented.
- Health checks pass locally.
- Migration notes are updated.
- Rollback path is known.

