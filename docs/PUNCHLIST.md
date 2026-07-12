# FLOYD Implementation Punchlist — authoritative completion checklist

This document is the single checklist used to verify true project completion.
It lives in `docs/` per Douglas's directive (2026-07-12). The root
`task_plan.md` points here. An item is checked ONLY with runtime receipts.

Rules: an item is checked only with runtime receipts (command output, evidence
rows, artifacts, or test results). Blueprint gates A–H govern; "unavailable"
capabilities stay visibly unavailable until their provider passes e2e.

### P1: Interactive session channel (Claude-style live surfaces) — in_progress

- [ ] Engine `/event` SSE subscription in Core with floyd-ID attribution (pure normalizer, TDD).
- [ ] `GET /api/runs/:id/stream` — token-gated live SSE per run on the gateway.
- [ ] `POST /api/runs/:id/steer` — mid-run steer to the builder session (`delivery: steer`), evidenced.
- [ ] CLI: `floyd watch <run>` and `floyd steer <run> <text…>`.
- [ ] Cockpit: live event pane + steer input on the run view.
- [ ] Live proof: a run steered mid-flight; steer text visible in transcript artifact and evidence ledger.
- [ ] Cross-surface continuity proof: watch in CLI, steer/decide from Cockpit (or inverse), same IDs.

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

### P9: Terminal provider (blueprint Phase D)

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
