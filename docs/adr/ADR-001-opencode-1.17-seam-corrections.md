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

## Credential sourcing — CORRECTED 2026-07-12 (omp broker removed entirely)

The initial "stale broker credential" reading was wrong. Verified facts:

- `omp auth-broker token <provider>` **ignores the provider argument** and
  prints the broker's own bearer token (proven: `token` and `token zai` return
  identical values). The stored zai key was never being tested — it is fine.
- The broker's HTTP surface (`/v1/chat/completions`, `/v1/messages`,
  `/v1/credential` write-only) is a **model gateway**, not a key vault; there
  is no credential *pull* route for external clients.
- CORRECTION (verified): the PATH `omp` binary is genuinely independent — zero
  embedded `openmythos-build` references. The openmythos process on 17384 is
  owned by **launchd**: `~/Library/LaunchAgents/com.omp.auth-broker.plist`
  (`KeepAlive=true`, `RunAtLoad=true`) runs the openmythos 16.3.6 dist binary
  by absolute path and instantly respawns it when killed. Any `serve` started
  by hand loses the port race to launchd.
- Douglas ruled: openmythos must not be involved in this harness; independent
  non-openmythos omp builds exist and are in regular use. He refreshed the
  broker's zai entry himself (broker DB row 48 validated HTTP 200 at the coding
  endpoint; the "stale credential" reading was an artifact of
  `token <provider>` printing the broker bearer, not the stored key).
- Vendor-supported credential path: z.ai's `coding-helper` (`chelper`) manages
  the GLM Coding Plan key and writes/reloads it into coding tools including
  OpenCode (`chelper auth reload opencode`); `chelper doctor` reports API key,
  plan, and OpenCode wiring healthy.

Decision: Floyd Core sources the GLM key from the opencode config that
`coding-helper` maintains, validates it against the coding endpoint before
every spawn, and fails closed. The omp spawn was deleted from `engine.ts`; no
openmythos process is in Floyd's credential or model path. Billing verified:
GLM plan usage registered for the golden-path window (5-hour token quota at
4%, plan level max) while the OpenCode credit balance was untouched — zero
marginal cost, no PAYG. Additional footgun recorded: invoking `omp` corrupts
the calling shell's PATH (post-invocation `command not found` observed
repeatedly).
