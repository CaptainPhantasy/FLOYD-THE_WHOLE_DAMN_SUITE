# FLOYD Implementation Punchlist — authoritative completion checklist

This document is the single checklist used to verify true project completion.
It lives in `docs/` per Douglas's directive (2026-07-12). The root
`task_plan.md` points here. An item is checked ONLY with runtime receipts.

Rules: an item is checked only with runtime receipts (command output, evidence
rows, artifacts, or test results). Blueprint gates A–H govern; "unavailable"
capabilities stay visibly unavailable until their provider passes e2e.

### P1: Interactive session channel (Claude-style live surfaces) — in_progress

- [x] Engine event subscription in Core with floyd-ID attribution (pure normalizer, TDD; live bus is `/api/event` — bare `/event` only heartbeats; 21/21 tests).
- [x] `GET /api/runs/:id/stream` — RECEIPT: run5 watcher captured 446 live attributed events (route-shadowing bug fixed).
- [x] `POST /api/runs/:id/steer` — RECEIPT: run_mrhwckwq steered mid-flight (evidence engine.steer.submitted 14:37:12); min/max landed in diff + tests 17/17.
- [x] CLI: `floyd watch` and `floyd steer` — RECEIPT: run5 live capture; run3 steer receipts.
- [x] Cockpit: live event pane + steer input shipped (HTTP-path verified; UI click pending browser session).
- [x] Live proof: run_mrhwckwq04c59b65e0de — steer changed the outcome (count+sum task gained min+max via steer), evidence + diff receipts.
- [ ] Cross-surface continuity proof — superseded by Objective 2 `cross_surface_parity_test` below.

### P2: Engine hardening and builder gating

- [ ] Write the upstream gap report: `permission` config is a silent no-op in 1.17.15 (ADR-001 has the evidence).
- [ ] Enable `OPENCODE_SERVER_USERNAME/PASSWORD` on the engine loopback (log currently warns "unsecured").
- [ ] E2E test: builder external-directory ask answered by Floyd gate per AgentSpec policy with PolicyDecision evidence.
- [ ] Tool-download egress policy: pre-seed ripgrep or record/pin the download in evidence.

### P3: Floyd OpenCode plugin (drop `--pure`)

- [ ] Audit the 1.17.15 plugin contract; implement the stateless Floyd plugin (correlation IDs, normalized evidence, tool-call metadata).
- [ ] Test plugin in isolation; then remove `--pure`; Gate B gap report updated.

### P4: Identity, continuity, and daemon lifecycle

- [ ] launchd-managed Floyd Core (`com.floyd.core`, KeepAlive) — surfaces always find the daemon; CLI stays attach-only.
- [ ] Actor/Device rows + device-scoped gateway tokens (replace the single shared token).
- [ ] Session continuity acceptance test: start in CLI, attach mid-run in Cockpit, decide from either.

### P5: Skills registry (priority raised per Claude-style goal)

- [ ] Versioned skill package schema + registry tables + digest verification.
- [ ] Two real audited/tested/permissioned skill packages (no decorative titles).
- [ ] Conformance suite; skills load on demand into builder sessions with evidence.

### P6: Memory deepening

- [ ] Recall injection into builder prompts (source-attributed block, visible in prompt/evidence).
- [ ] Memory inspect/export/delete endpoints + CLI verbs.
- [ ] Session-scoped memory alongside project scope.

### P7: Artifacts UX

- [ ] Lineage/provenance fields + retention policy on artifacts.
- [ ] Cockpit artifact browser; CLI `floyd artifact <id>` fetch (raw endpoint exists).

### P8: Browork scheduler (blueprint Phase D)

- [ ] Durable run DAG: dependencies, retries, stop conditions, cancellation.
- [ ] Parallel workers on isolated worktree leases; forced-worker-loss recovery test; no merge without gate.

### P9: Terminal provider (blueprint Phase D) — DEFERRED after Skills & Memory (Objective 3.3; not removed)

- [ ] Scoped PTY provider with durable transcript/evidence refs (COHORT donor via copy-before-edit protocol).
- [ ] No unauthenticated WebSocket, no arbitrary host-shell proxy (verified by test).

### P10: Cockpit adoption decision (CodeNomad)

- [ ] Independent pinned CodeNomad copy + source/security audit per admission protocol.
- [ ] ADR: adopt-and-attach vs continue first-party cockpit; either way, one control plane.

### P11: Multimedia (blueprint Phase F)

- [ ] Provider contract; ONE verified image workflow end-to-end (job, artifact, cost, provenance) before any other modality.
- [ ] Interrupted-job reconcile test without duplicate billing.

### P12: Mobile, browser, remote, lab (blueprint Phase G)

- [ ] Capability-provider interfaces registered with health/permission/artifact/evidence contracts; shown UNAVAILABLE with exact blockers until e2e passes.
- [ ] Tailscale-only device pairing + scoped capability tokens; revocation test.
- [ ] Browser native-messaging host (no blind ports/unauth WS); lab provider with mount/secret/idle-shutdown policy.

### P13: Golden compatibility (blueprint Phase C)

- [ ] Parity fixtures from `ff`/`superfloyd` behavior; side-by-side runs under a different command name; zero live-data writes.

### P14: Security and truth hardening

- [ ] Rotate the GLM key out of plaintext `~/.config/opencode/opencode.json` (coordinate with chelper; Douglas's authority).
- [ ] Fix legacy state permissions (0644 DBs under 0755 roots) in an approved maintenance window.
- [ ] MiniMax route: activation stays blocked until explicit approval (region evidence: CN label exists).
- [ ] upstream.lock refresh procedure for engine updates (hash re-pin + seam regression run).

### P15: Packaging and cutover (blueprint Phase H)

- [ ] Signed launcher/desktop packaging; private installer; operator runbooks.
- [ ] Alias cutover one command at a time after parity; rollback verified; website updated from sanitized evidence only.

## Directive 2026-07-12: Bidirectional Session Channel slice (Douglas's spec — execute in order)

### Objective 1 — Bidirectional session channel through the gateway (P0)

- [x] `GET /api/sessions/{id}/events` — RECEIPT: acceptance run_mrhwuoeo, all five types observed over 2688 sequenced events.
- [x] `POST /api/sessions/{id}/steer` — RECEIPT: steer/answer/permission all exercised live (evidence: engine.steer.submitted, engine.question.answered, policy.decision source=surface).
- [x] `POST /api/sessions/{id}/attach` — participant registration + replay implemented; session.participant_attached evidence.
- [x] Monotonic per-session `seq` — RECEIPT: replay from seq 1345 returned 1343 frames in order (sub-test 5 PASS).
- [x] CLI (`attach/say/answer/grant`) + Cockpit (session-events pane, question/permission prompts, steer box) consume the channel as primary.
- [x] ACCEPTANCE: tests/acceptance/objective1.py — RESULT: PASS, all 5 sub-tests (run_mrhwuoeo048dbb2e4596, exit 0).

### Objective 2 — Cross-surface session continuity (P0)

- [ ] `cross_surface_parity_test` automated (CLI start → Cockpit attach mid-run → observe tokens → answer permission from Cockpit → CLI reflects, no state loss), CI-runnable, restart-proof rigor.
- [x] `docs/session-contract.md` written — attach/events/steer schemas, seq semantics, permission split, authority rule.
- [ ] No second authority: surfaces never spawn Core; warn + instruct to check launchd. `ps` shows exactly one Core during parity test.

### Objective 3 — Skills & Memory before Terminal/PTY

- [x] Memory recall injected into builder prompt — RECEIPT: memory.injected (5 items, 1834 chars); block verified in live builder prompt (run_mrhxddmo).
- [x] Versioned skills registry (skills.ts, TDD 5 tests): register name@semver + digest; builder loads via @skill:name@ver — RECEIPT: skill.loaded tdd-loop@1.0.0 in prompt (run_mrhxi4r5). Two real seeded skills: code-review@1.0.0, tdd-loop@1.0.0.
- [x] Roadmap reordered: Skills & Memory (P5/P6) before Terminal/PTY (P9) — PTY deferred, not removed (see PTY note below).
- [x] ACCEPTANCE: memory in prompt (verified), skill loads on demand (skill.loaded evidence + prompt body), roadmap order below.

### Objective 4 — Floyd Core under launchd

- [ ] `com.floyd.core.plist` (Label/KeepAlive/RunAtLoad/exec path/log paths per auth-broker pattern).
- [ ] Loaded via launchctl; `launchctl list` shows running; exactly one Core process during runs; CLI attaches, never spawns.
- [ ] Reboot survival: manual operator checklist item (not CI); record in release checklist.
