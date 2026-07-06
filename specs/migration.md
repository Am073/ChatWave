# Migration Plan

## Strategy

Use a parallel migration strategy:

```text
v1 Express backend remains working
      +
new backend_py FastAPI backend is built side-by-side
      +
frontend routes are pointed gradually to FastAPI
      +
Express is retired only after feature parity
```

## Migration Principles

- Preserve product behavior before improving UI.
- Keep API contracts stable where possible.
- Add observability and evals early.
- Avoid frontend rewrite during backend parity work.
- Do not remove old code until replacement is tested.

## Parity Checklist

FastAPI reaches parity when these work:

- [ ] Register
- [ ] Login
- [ ] Logout
- [ ] Current user
- [ ] Role-based route protection
- [ ] Document upload
- [ ] Ingestion status
- [ ] Document delete
- [ ] Chat answer
- [ ] Chat sources
- [ ] Chat history
- [ ] Announcement list/create
- [ ] Admin stats
- [ ] Admin health
- [ ] Streaming answer
- [ ] Tenant isolation

## Data Migration

Initial approach:

- Reuse MongoDB collections if schemas remain compatible.
- Add new fields incrementally:
  - `trace_id`
  - `prompt_version`
  - `model`
  - `embedding_model`
  - `quality_scores`
  - `agent_steps`

Vector migration:

- Existing Qdrant vectors may not be compatible if embedding model changes.
- Re-index documents with the selected v2 embedding model.
- Store embedding version on document records.

## Frontend Cutover

Step 1:

- Keep frontend API base URL configurable.
- Point local frontend to FastAPI for one route at a time.

Step 2:

- Verify auth and CSRF/session behavior.
- Verify upload and chat flows.

Step 3:

- Add frontend support for new fields:
  - trace id
  - source metadata
  - confidence
  - streaming status events

Step 4:

- Add admin AI quality panels.

## Rollback

Rollback path:

- Keep Express backend available.
- Keep frontend environment switchable.
- Do not run destructive schema migrations without backup.
- Keep v1 Docker/local setup until FastAPI is stable.

## Retirement Criteria

The Express backend can be retired only when:

- All parity checklist items are complete.
- FastAPI tests pass.
- AI evals pass minimum thresholds.
- Frontend works against FastAPI.
- Deployment path is documented.
- User approves removal/archive.

