# FLOYD Golden Path — Handback Evidence (2026-07-12)

All claims below are [EXECUTED]/[OBSERVED] in the 2026-07-11/12 implementation
session. Runtime-verified end-to-end; nothing here is proposed-only unless
explicitly listed under "Not available".

## 1. Tree of real implementation modules

```text
packages/contracts/src/index.ts      typed contracts (ActionRequest/Observation, Run, Job,
                                     Lease, Artifact, EvidenceEvent, AgentSpec, ProviderProfile…)
core/daemon/src/config.ts            runtime-root ownership/mode checks, ids, gateway token (0600)
core/daemon/src/db.ts                SQLite WAL schema; evidence append-only TRIGGERs;
                                     lease partial-unique exclusivity index
core/daemon/src/evidence.ts          append-only evidence ledger
core/daemon/src/artifacts.ts         content-addressed store (sha256, 0600 files)
core/daemon/src/engine.ts            OpenCode supervisor + REST adapter (hash-verified spawn,
                                     credential sourcing, idle detection, permissions)
core/daemon/src/engine-logic.ts      pure tested seam predicates (newest/terminal/stalled)
core/daemon/src/leases.ts            exclusive worktree leases
core/daemon/src/git.ts               worktree add/remove/diff/merge helpers
core/daemon/src/runs.ts              golden-path orchestration: builder→diff→test→reviewer→gate
core/daemon/src/memory.ts            source-attributed memory with why_retrieved
core/daemon/src/seed.ts              glm-coding-plan profile + builder/reviewer AgentSpecs
core/daemon/src/http.ts              loopback gateway (bearer token), SSE, cockpit static
core/daemon/src/main.ts              startup, recovery, shutdown
core/daemon/test/*.test.ts           14 unit tests (all passing)
clients/cli/src/main.ts              floyd CLI surface
apps/cockpit/public/index.html       cockpit web surface (same gateway/state)
docs/adr/ADR-001, ADR-002            recorded corrections/scoping
```

## 2. Lockfiles

- `pnpm-lock.yaml` — dev-only deps (typescript, @types/node). Zero runtime deps.
- `upstream.lock` — OpenCode 1.17.15, absolute binary path, sha256
  `7bdefaeaef5cc4f661988eaba00de047f5f65547fd22a3bed5ba7c4d86a275d3`; re-verified
  before every spawn, fail closed.

## 3. Process topology (final verified state)

- Floyd Core: `node core/daemon/src/main.ts`, gateway `127.0.0.1:41414`
  (0600 bearer token at `FLOYD_RUNTIME/core/gateway.token`).
- Managed OpenCode 1.17.15: child of Core, `127.0.0.1:41415`, `--pure`,
  XDG+OPENCODE_CONFIG isolated under `FLOYD_RUNTIME/engines/opencode/`,
  credential via env only. Global `~/.local/share/opencode` untouched
  (mtime-verified).

## 4. Real trace (run_mrh89sxa0aa9e039a433)

prompt → builder session `ses_0aba522cfffeaPZu0LVf0Bj86m` (glm-5.2) in leased
worktree → wrote `median()` in `src/calc.js` → diff artifact `43348f4b…` →
test artifact `f37165a9…` (`node --test` exit 0, 4/4 pass) → reviewer session
`ses_0ab8c973effe…` in separate leased worktree consumed the diff →
review artifact `afe22369…` ("VERDICT: approve" + findings) → run
`waiting_review` → explicit `floyd accept` → merge commit
`8c45c8d0efd187606b90ac026016db157cbdfa4b` on scratch-calc main → 4/4 tests
pass on main → leases released → memory item `mem_mrh9gk3m…` stored with
source `run:run_mrh89sxa…`.

## 5. Dual-surface proof

CLI (`floyd run/state`) and Cockpit gateway state returned identical
`run_mrh89sxa0aa9e039a433 / ses_mrh89sx909be7505dd76 / prj_mrh89l120772fa769bab`
and identical artifact sha256 ids. Cockpit HTML served from the same daemon;
API returns 401 without the gateway token; SSE channel live.

## 6. Restart proof

Killed Core + engine while `waiting_review`; relaunched; before/after snapshots
of run/jobs/engine-session ids/lease ids/artifact ids are byte-identical
(`diff` → no output). Only lifecycle evidence appended (core.shutdown,
core.starting, engine.started, core.gateway_listening). No duplicate prompt or
coding action. Additionally exercised live: duplicate submission returns the
same run (idempotency key), and interrupted-before-first-assistant-turn
recovery re-prompts exactly once with evidence.

## 7. Worktree lease proof

`leases_active_exclusive` partial unique index: second active lease on the same
path fails at the storage engine (unit-tested). Builder and reviewer ran in
`FLOYD_RUNTIME/worktrees/job_mrh89sxa…` and `…/job_mrh9arvg…` — never the same
mutable tree. Both leases `released` after decision.

## 8. Provider route receipt & no-fallback proof

Route receipt evidence (`provider.route_receipt`) emitted BEFORE each model
call: provider zai-coding-plan, model glm-5.2, billing_class subscription,
plan GLM Coding Plan, project/run/job ids, timestamp — no credential. Engine
config `disabled_providers:["opencode"]` verified (only zai-coding-plan
loaded). Anthropic/Mistral/PAYG absent. Credential sourcing: broker `zai`
token failed live validation (HTTP 401) → validated user-config key used for
the SAME plan, recorded in `engine.started.credential_source` — fail closed if
none validates.

## 9. Tests and build output

- `pnpm exec tsc -b packages/contracts core/daemon clients/cli` → clean.
- `node --test "core/daemon/test/*.test.ts"` → 14/14 pass (evidence
  append-only, lease exclusivity, CAS, idempotent submission, payload parse,
  seam predicates, memory attribution).
- Golden project: baseline failing tests → post-merge 4/4 pass on main.
- Evidence ledger: 70+ append-only events in `FLOYD_RUNTIME/core/floyd.db`.

## 10. Blunt list of what is NOT available

- **[RESOLVED 2026-07-12] Engine permission root cause:** 1.17.15 silently
  ignores the `permission` config field (global and per-agent) when compiling
  PermissionV2 rulesets — built-in policy is allow-all inside the session
  directory, ask on `external_directory` and `.env` reads. The ask/reply
  machinery works in server mode (verified live: external write fired an ask;
  Floyd-style reject blocked it). Reviewer read-only is now enforced by the
  `floyd-reviewer` agent with mutating tools disabled (adversarially verified:
  write/bash/apply_patch/edit all blocked) plus a Core-side empty-diff
  invariant with `review.mutation_detected` evidence. Remaining upstream gap:
  builder-side *in-worktree* edit/bash cannot be made "ask" via config in this
  build — the worktree lease + explicit merge gate are the effective controls.
- **Floyd OpenCode plugin not built** (ADR-002); running `--pure`.
- **Cockpit is a minimal first-party page,** not the CodeNomad adoption; no
  visual browser screenshot this session (extension disconnected) — verified
  over HTTP only.
- **Terminal/PTY, media, skills registry, mobile/browser/lab providers:
  not implemented.** Cockpit lists them as unavailable with blockers.
- **omp auth-broker `zai` credential is stale** (401) — operator refresh
  needed; Core auto-prefers the broker once it validates.
- **Douglas's global opencode config still pins `zai-coding-plan/glm-4.6`,
  which no longer exists** in the plan catalog — his own coding sessions will
  fail until updated (not touched per no-global-mutation rule).
- **Engine downloads tooling (ripgrep) from GitHub at first run** — network
  egress from the engine child; pre-seeding/offline policy is a follow-up.
- **Gateway auth is a single local bearer token** — device-scoped identity
  arrives with the remote phase.
- MiniMax route remains unproven/blocked by design (region evidence found:
  `minimax-cn-coding-plan` label exists; activation still requires explicit
  approval).
