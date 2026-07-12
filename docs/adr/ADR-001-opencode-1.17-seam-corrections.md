# ADR-001: OpenCode 1.17.15 seam corrections (verified live, 2026-07-12)

## Status

Accepted — all facts below verified against the running pinned engine this session.

## Context

The blueprint/handoff described the OpenCode seam from documentation and an earlier
read-only audit. Live integration surfaced four divergences.

## Decisions

1. **Response envelope.** Every 1.17.15 JSON endpoint wraps its payload in
   `{"data": ...}`. The Floyd adapter unwraps this envelope centrally.
2. **Idle detection.** `POST /api/session/{id}/wait` returns
   `503 "Session wait is not available yet"` in this build. Idle is instead
   detected by polling: newest message is a completed assistant message, zero
   pending permission requests, stable across three consecutive 3-second polls.
   Residual risk: a >9-second silent gap between engine activities could read as
   idle; acceptable for the golden path, revisit with SSE `/event` correlation.
3. **Provider availability = integration connection.** Config
   `provider.options.apiKey` and `PUT /auth/{providerID}` alone do NOT make a
   model available in 1.17.15 (`ModelUnavailableError`). Availability requires a
   connected integration; the `zai`/`zai-coding-plan` integrations declare an env
   method via `ZHIPU_API_KEY`. Floyd Core injects the validated key as
   `ZHIPU_API_KEY` in the child environment only — never on disk.
4. **Model catalog drift.** The plan pinned `glm-4.6`; the live GLM Coding Plan
   catalog is `glm-4.7 / glm-5.1 / glm-5.2 / glm-5v-turbo / glm-5-turbo /
   glm-4.5-air`. Builder and reviewer AgentSpecs use `glm-5.2`. The user's global
   `~/.config/opencode/opencode.json` still pins the nonexistent
   `zai-coding-plan/glm-4.6` (its coding turns would fail the same way) — flagged
   as an operator follow-up, not touched by Floyd.

## Credential sourcing (same plan, explicit, not a route fallback)

`omp auth-broker token zai` vends a credential rejected by
`https://api.z.ai/api/coding/paas/v4/models` (HTTP 401, verified 2026-07-12);
the key in the user's opencode config validates (HTTP 200). Floyd Core validates
broker-first and falls back to the validated config key, records the actual
source in `engine.started` evidence, and fails closed when nothing validates.
Refreshing the broker's `zai` credential is an operator follow-up; when done,
Core automatically prefers the broker again.
