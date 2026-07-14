# FLOYD Ecosystem Unification — Progress Log

## Session: 2026-07-11

### Phase 0: Durable Planning Bootstrap

- **Status:** complete
- **Actions taken:**
  - Verified the live workspace with `pwd`.
  - Read all 440 lines of the requested `planning-with-files` skill.
  - Checked for existing planning files and found none.
  - Ran the skill’s session catch-up script; it exited `0` with no unsynced context.
  - Read the three skill templates.
  - Queried the already-active `/goal` after an attempted duplicate goal creation was rejected.
  - Created the root planning trio.
- **Files created:**
  - `/Users/douglastalley/Documents/Floyd_EcoSystem/task_plan.md`
  - `/Users/douglastalley/Documents/Floyd_EcoSystem/findings.md`
  - `/Users/douglastalley/Documents/Floyd_EcoSystem/progress.md`

### Phase 1: Evidence Inventory and Runtime Trace

- **Status:** complete
- **Actions taken:**
  - Started three parallel, read-only evidence lanes: browser/mobile; core runtime/CLI; desktop/sandboxes/wrapper.
  - Confirmed all ten named source paths exist.
  - Captured size, Git state, branch/head, top-level structure, and modification signals for each source root.
  - Attempted the first `ff` resolution in the Codex tool shell; proved it is absent from that process PATH and preserved interactive-shell tracing as the next distinct approach.
  - Resolved `ff` through interactive zsh and traced its symlink/wrapper chain to the installed real binary without executing the application.
  - Verified that the compatibility wrapper pins the default state root to `~/.floyd-ff` while preserving explicit data-dir overrides.
  - Fingerprinted the installed real `ff` binary without executing it: arm64 Go Mach-O, size/hash, ad-hoc signature, and system-library dependencies.
  - Inspected the state-root structure without reading secret values: two SQLite/WAL stores, JSON logs, Ralph commands, and approximately 98 MB of durable data.
  - Verified both databases read-only: WAL mode, matching session/message/file table lineage, 13 indexes, and `quick_check=ok`.
  - Checked live processes/listeners: no resident `ff`/harness process or Floyd listener was present.
  - Identified a verified security issue: session/message database files are world-readable (`0644`) beneath a traversable (`0755`) state root.
  - Proved installed-source lineage with Go build metadata: live `ff` was built from the exact v5 HEAD revision plus dirty changes; no checked-in v5 binary hash matches the deployment.
  - Began the user-requested modernization pass across five former feature skills.
  - Read `agent-harness-construction` and `agent-skill-system` completely; added their action-space, observation, recovery, metrics, packaging, registry, and cross-harness requirements to the plan.
  - Read `floyds-labs-brand-voice` and `floyd-lab` completely; separated brand/presentation policy from semantic runtime truth and added a supervised isolated-execution provider boundary.
  - Read `floyd-tunnel-recovery` completely; converted its intent into a private-first, deterministic, single-flight connectivity-supervisor design requirement.
  - Formalized a no-race audit protocol: disjoint read-only lanes, one planning-file writer, normalized return contracts, and explicit conflict reconciliation.
  - Live-checked skill literals: corrected the lab location to `/Volumes/SanDisk1Tb/floyd-sandbox`, found no `vibebox` CLI on the current PATH, and left the VM untouched.
  - Verified that the historical HTTP bridge plist exists but is not loaded; local health port 43117 was unreachable.
  - Captured interim high-priority contradictions from the browser/mobile and desktop/isolation auditors for final evidence normalization.
  - Completed and normalized the browser/mobile and desktop/isolation lanes: seven source roots audited read-only with evidence-backed donor, quarantine, and retirement boundaries.
  - Verified by static evidence that the PWA is the strongest thin mobile donor, TTY is the strongest browser/PTY donor, DesktopWeb is the desktop/media donor, and none may retain independent runtime/state authority.
  - Completed and normalized the original core-runtime lane, then corrected source fitness from the user's authoritative clarification: corrupt v5 backup quarantined; live installed `ff` retained as golden oracle; FCCLI and harness remain selective donors.
  - Expanded source scope from ten to twenty immutable directories and launched three new disjoint read-only audit lanes.
  - Added a copy-before-edit protocol that forbids hardlinks and writable source symlinks and preserves dirty/untracked provenance.
  - Verified all ten added paths exist, captured size/Git state, and confirmed the workspace has 90 GiB free with no source copy created.
  - Recorded user-authoritative source fitness: live `superfloyd` is another golden CLI path with an ASCII-only presentation issue; FCCLI is a scaffold without a runtime.
  - Traced `superfloyd` without executing it: active symlink chain, clean Go revision/hash, two lower-precedence installations, candidate state roots, and no current process.
  - Inspected only names/types/modes for candidate `superfloyd` state roots and embedded path markers; found project-relative data defaults plus multiple global roots and a world-writable (`0666`) session database.
  - Began an evidence-backed OpenCode architecture evaluation rather than defaulting to source symlinks.
  - Verified local OpenCode 1.17.15 exposes headless/attach/web, ACP, MCP, agents, plugins, sessions, import/export, GitHub, and DB surfaces; no process was running.
  - Read the user-provided official OpenCode ecosystem page and CodeNomad repository; revised the hypothesis from “coding worker” to “platform kernel plus cockpit baseline.”
  - Recorded Douglas's lineage clarification: the good Go CLI surfaces descend from CRUSH/OpenCode and should remain golden clients/oracles while authority returns to a modern OpenCode platform through explicit adapters.
  - Read current official OpenCode SDK/server contracts; confirmed the TUI is already a server client and the generated SDK/OpenAPI/events/session/permission surfaces cover most planned core authority.
  - Read current plugin/permission/agent/skill contracts; established an upstream-compatible OpenCode kernel plus hardened Floyd plugins/narrow durable services as the leading design.
  - Read the explicitly requested Browser and Computer skills completely and added their rendered/native verification roles to the plan.
  - Used the in-app Browser read-only to verify the rendered OpenCode ecosystem and CodeNomad repository/feature surfaces; captured DOM-grounded facts and screenshots without interaction or downloads.
  - Added the existing OpenCode customizer and two installed Floyd editor/coding apps to immutable audit scope before recommending new platform UI work.
  - Recorded private/team-only delivery and remote Git backup boundaries; remote v5 remains quarantined provenance rather than a donor.
  - Normalized static app evidence: FLOYD CODE is only an external CLI launcher; CURSE'M is a branded near-stock VS Code package and not a Floyd/OpenCode implementation donor.
  - Began read-only native UI verification. FLOYD CODE was not registered with Computer Use and did not launch; CURSE'M resolved as bundle `com.floyd.curse-m`.
  - Visually verified CURSE'M as a real VS Code-derived multi-agent/coding cockpit with Codex/Claude/Git/editor surfaces; observed a current shell-environment failure and restored the app to not running.
  - Finished the OpenCode customizer audit: proved it is a documentation archive rather than a fork/runtime and compared its stale claims with the current 1.17.15 installation/config/plugin state without exposing keys.
  - Independently verified the Go lineage: 489 same-path blobs in the first FLOYD baseline are byte-identical to adjacent CRUSH source, and CRUSH shares an exact historical Git commit with archived Go OpenCode.
  - Audited `floydslabs.com` as brand/catalog and isolated hosted API. Verified three live server groups, 67 tools, 73 catalog definitions, contradictory published counts/statuses, and a public-boundary/auth concern without testing credentials or executing tools.
  - Audited the `LegacyAI-FloydsLabs` organization and two personal backup repositories read-only; current unauthenticated evidence shows ten public org repositories plus both public personal backups, while private repository existence remains unknown.
  - Selected Floyd Core as the sole durable ecosystem authority, current upstream OpenCode as the managed coding engine, a stateless Floyd plugin/SDK adapter, and a CodeNomad-derived cockpit.
  - Recorded Douglas's cost/runtime constraint: only tiny local models fit; GLM and MiniMax annual subscriptions are preferred workhorses and must not silently fall back to separately metered API calls.
  - Completed the read-only provider audit: GLM Coding Plan is the active OpenCode default, a MiniMax Token Plan credential label exists but has no active model route, the OMP broker exposes plan adapters, and vendor docs verify that plan keys/routes must remain separate from PAYG.
- **Next actions:**
  - Complete the narrow read-only GLM/MiniMax subscription integration check.
  - Run final planning-file consistency, scope, secret, and completeness checks.
  - Produce the evidence ledger, completeness matrix, and official handoff.

### Phases 2–5: Adjudication, Architecture, Flows, and Official Plan

- **Status:** complete
- **Actions taken:**
  - Assigned adopt/extract/reference/quarantine/retire dispositions to every named component and added current OpenCode, CodeNomad, the public website, organization, and remote provenance boundaries.
  - Defined one durable authority, global-versus-engine session mapping, provider boundaries, contracts, storage, skills, agents, memory, security, cost, and copy-before-edit admission.
  - Mapped boot, coding, Browork, media, terminal/Git/browser, mobile/SSH/voice, lab, and connectivity flows.
  - Sequenced preservation, platform-spike, coding-continuity, Browork/terminal/Git, skills/memory/artifacts, multimedia, remote/lab, and packaging/cutover gates.
  - Created `/Users/douglastalley/Documents/Floyd_EcoSystem/FLOYD_ECOSYSTEM_BLUEPRINT.md` as the official plan.

### Phase 6: Verification and Handoff

- **Status:** complete
- **Actions taken:**
  - Began reconciling the blueprint with the component matrix, source-scope list, user constraints, public/private boundaries, and evidence ledger requirements.
  - Verified all 23 named local source/app paths still exist and all 31 disposition terms appear in the official blueprint.
  - Verified Markdown structure and lint, balanced code fences, required sections, no workspace symlinks, no intake/source copy, and no credential-pattern matches in the planning files.
  - Captured final file hashes and confirmed the workspace contains only the four new planning/blueprint files as untracked work; no originals were edited or copied.
  - Provisioned the selected empty Storage-volume hubs: `/Volumes/Storage/FLOYD_WORKSTATION` and `/Volumes/Storage/FLOYD_RUNTIME`, each mode `0700`, owned by Douglas; no source, donor, planning-document, Git, or remote migration occurred.

## Verification Results

| Check | Command / Method | Expected | Actual | Status |
|---|---|---|---|---|
| Workspace identity | `pwd` | `/Users/douglastalley/Documents/Floyd_EcoSystem` | Exact match | PASS |
| Existing plan discovery | `rg --files` for planning filenames | Establish whether prior state exists | No matches | PASS |
| Session catch-up | `session-catchup.py $(pwd)` | Exit `0` | Exit `0`, no output | PASS |
| Skill read | `wc -l` + `sed` | Complete file loaded | 440 lines loaded | PASS |
| Named path census | `stat`, `du`, `git status`, top-level `find` | Ten readable paths | Ten of ten returned `EXISTS=YES` | PASS |
| Non-interactive `ff` resolution | `whence`, `type`, `which`, `command -v` | Classify this shell's resolution | All report not found/empty | PASS (bounded result) |
| Interactive `ff` resolution | `/bin/zsh -lic` with `whence`, `which`, `realpath`, `file`, `shasum`, `sed` | Trace launcher without running Floyd | `~/.local/bin/ff` -> `/usr/local/bin/floyd` -> `/opt/homebrew/libexec/floyd-harnesses/floyd-ff-real`; state `~/.floyd-ff` | PASS |
| Installed binary fingerprint | `file`, `stat`, `shasum`, `codesign`, `otool`, bounded `strings` | Establish binary type/provenance without running it | 58,901,762-byte arm64 Go Mach-O, ad-hoc signed, hash recorded | PASS |
| Live state structure | bounded `find`, `file`, `du` excluding secret-like names | Establish durable state topology without exposing values | SQLite/WAL databases, JSON logs, command docs, 98 MB root | PASS |
| Database structure/integrity | `sqlite3 -readonly` PRAGMAs and schema-name queries | Verify storage lineage without reading user rows | Both `quick_check=ok`; matching five application tables; WAL mode | PASS |
| Runtime residency | `pgrep`, bounded `ps`, `lsof`, launchd label filter, listener filter | Determine whether `ff` is persistent today | No matching process or listener | PASS (negative evidence) |
| State confidentiality | `stat`/`ls -lOe` on root and DB/WAL/SHM files | State readable only by owner | Root `0755`, files `0644` | FAIL |
| Lab path/current CLI | `ls`, `command -v`, bounded config `find` | Verify skill environment claims | `SanDisk1gb` missing; config at `SanDisk1Tb/floyd-sandbox`; no `vibebox` on PATH | FAIL (stale/incomplete wiring) |
| Local tunnel bridge | launchd label filter and bounded localhost health request | Loaded label and HTTP 200 | Label not loaded; curl HTTP code `000` | FAIL |
| Browser/mobile audit | Agent Git/manifests/source/dist/screenshot comparison | Three surfaces classified with direct evidence | Chrome, TTY, and PWA normalized; no live runtime/tests executed | PASS (static scope) |
| Desktop/isolation audit | Agent Git/manifests/source/build comparison | Four roots classified with direct evidence | Desktop, two Go generations, Wrapper, and INK normalized; no live runtime/tests executed | PASS (static scope) |
| Added-source census | `stat`, `du`, Git status/log, bounded top-level `find` | Ten readable paths with state/size | Ten of ten exist; 7.4 GB deerflow dominates | PASS |
| Copy-capacity boundary | `df -h`, workspace tree, intake check | Capacity known; no accidental copy | 90 GiB free; `intake/` absent | PASS |
| Interactive `superfloyd` resolution | `zsh -lic` with `whence`, `which`, `realpath`, `file`, `shasum`, `go version -m`, process check | Identify golden path without launch | Active clean build at revision `587b0ebb74c7`; two lower-precedence installs; no process | PASS |
| `superfloyd` state boundary | bounded binary markers plus state-root filenames/types/modes | Identify likely state without reading values | Distributed project/global roots; one DB `0666` | FAIL (security/authority) |
| Local OpenCode platform | interactive resolution, binary fingerprint, version/help, bounded config/state/process inspection | Establish actual local platform surface | 1.17.15 with server/attach/ACP/MCP/agent/plugin/session/DB commands; no process | PASS |
| Rendered OpenCode/CodeNomad surfaces | In-app Browser DOM snapshot, bounded read-only evaluation, screenshots | Visibly confirm platform/cockpit claims | Ecosystem/plugin categories and CodeNomad cockpit features rendered as documented | PASS (presentation only) |
| CURSE'M native UI | Computer Use accessibility tree and screenshot, followed by quit/state verification | Determine whether app is real surface and restore state | VS Code-derived cockpit rendered; shell error visible; app returned to not running | PASS (UI scope) |
| Go FLOYD lineage | installed Go metadata + local blob comparison + official shared commit SHA | Test Douglas's CRUSH/OpenCode ancestry statement | 489 exact same-path FLOYD/CRUSH blobs; identical CRUSH/archived-Go-OpenCode commit | PASS |
| Opencode_Customizer | file/Git/build inventory plus current config/plugin comparison | Determine whether it is a working fork/distribution | 17 documentation files; no Git/source/build/tests; described Floyd integration absent | PASS (static scope) |
| Floyd Labs live boundary | rendered pages plus read-only health/catalog/OpenAPI/metrics requests | Separate brand claims from current public contract | 3 groups/67 tools/73 definitions; conflicting site counts; redacted credential-shaped example; public metrics/catalog | PASS (inspection); FAIL (security/truth baseline) |
| GitHub ownership/provenance | unauthenticated GitHub API and public metadata | Establish current visible organization/backups without changing state | 10 public org repos; both personal backups public; private inventory not inferable | PASS |
| Official blueprint | created file plus component/flow/roadmap reconciliation | Produce selected architecture and migration plan | `FLOYD_ECOSYSTEM_BLUEPRINT.md` contains decision, diagram, boundaries, dispositions, flows, gates, and non-goals | PASS |
| GLM/MiniMax provider routing | PATH/alias/version, redacted auth labels/config, broker catalog, official vendor docs | Ground cost strategy in current subscriptions without calling a model | GLM plan is routed; MiniMax plan label exists but region/entitlement are unverified; plan/PAYG separation proven | PASS (read-only scope) |
| Final plan consistency | Markdown lint, fence/section checks, source-path and component coverage, secret-pattern scan, workspace boundary | Verify the plan is complete and source-safe | Lint exit 0; 12 fences; 23/23 local paths; 31/31 dispositions; no symlinks/intake/secrets | PASS |

## Error Log

| Date | Error | Attempt | Resolution |
|---|---|---:|---|
| 2026-07-11 | `create_goal` rejected a duplicate active goal | 1 | Used `get_goal`; verified and retained the existing active goal. |
| 2026-07-11 | `ff` not found in Codex non-interactive PATH | 1 | Switched to interactive zsh and resolved the full compatibility-launcher chain. |
| 2026-07-11 | Interactive trace orchestration template produced `SyntaxError: Missing } in template expression` before execution | 1 | Rebuild the command without zsh map expansion inside a JavaScript template literal. |
| 2026-07-11 | Process/database batch template produced the same pre-execution syntax error | 2 | Removed brace expansions; revised process/database commands completed successfully. |
| 2026-07-11 | Broad provenance patch context failed atomic verification | 1 | Queried current anchors and applied narrower hunks; no partial write occurred. |
| 2026-07-11 | Broad lane-normalization patch context failed atomic verification | 2 | Replaced with small independently anchored patches; no partial write occurred. |
| 2026-07-11 | Expanded-scope findings patch assumed separated table rows were adjacent | 1 | Queried the current matrix and applied independent row patches; no partial write occurred. |
| 2026-07-11 | Combined OpenCode research update failed atomic verification | 1 | Split it into small independently anchored findings, plan, and progress patches; no partial write occurred. |
| 2026-07-11 | Initial web-result wrapper printed no content | 1 | Retried with raw result forwarding and read both official pages. |
| 2026-07-11 | Computer Use rejected the FLOYD CODE app path as an invalid target | 1 | No launch occurred; registered-app inventory showed only CURSE'M, so FLOYD CODE remains static-bundle-only pending audit. |
| 2026-07-11 | CURSE'M screenshot helper was undefined after the previous call failed before import | 1 | Reinitialized helpers, captured current state, and restored app to not running. |
| 2026-07-11 | Web safety filtering refused direct opens of Floyd Labs API URLs | 1 | Switched to bounded unauthenticated `curl` GETs; no tools, forms, or credentials were invoked. |
| 2026-07-11 | Public OpenAPI data contained a credential-shaped example | 1 | Redacted the value, verified only path/type/length, did not test it, and elevated removal/rotation as a separate authorized follow-on. |
| 2026-07-11 | First Markdown lint pass flagged intentional long/table lines plus four emphasis pseudo-headings | 1 | Scoped out MD013/MD060 for the table-heavy plan, converted the four labels to real headings, and reran lint successfully. |

## 5-Question Reboot Check

| Question | Answer |
|---|---|
| Where am I? | Planning goal complete; verified implementation handoff is ready |
| Where am I going? | Phase A preservation/hardening, then the narrow Phase B Floyd Core/OpenCode seam spike after Douglas authorizes implementation |
| What is the goal? | One evidence-backed implementation plan for a persistent, unified FLOYD workstation ecosystem |
| What have I learned? | One Floyd authority plus managed OpenCode and many focused surfaces is the coherent path; the public website and legacy runtimes must stay outside that trust boundary |
| What have I done? | Inspected and adjudicated the full named estate, verified key lineage/runtime facts, and wrote the official architecture and migration blueprint |

## Session: 2026-07-11/12 — FABLE5 golden path implementation

### Phase I1 (env verification + pin): complete
- OpenCode 1.17.15 pinned in `upstream.lock` (sha256 7bdefaea…); PATH `opencode` symlink repointed from SuperFloyd binary to real 1.17.15 with Douglas's explicit authorization; superfloyd chain untouched.
- Isolation empirically proven: XDG+OPENCODE_CONFIG confine all engine state under FLOYD_RUNTIME; global opencode.db/auth.json mtimes unchanged.
- GLM key vends from `omp auth-broker token zai` (exit 0); interim secrets file deleted; credential_ref = omp-auth-broker:zai.

### Phase I2/I3 (scaffold + contracts + persistence): complete
- pnpm workspace: packages/contracts, core/daemon, clients/cli, apps/cockpit. Zero runtime deps (node:sqlite, native TS on Node 26); typescript+@types/node dev-only.
- SQLite WAL at FLOYD_RUNTIME/core/floyd.db (0600): projects/sessions/runs/jobs/leases/artifacts/agent_specs/provider_profiles/evidence_events.
- Evidence append-only enforced by SQLite triggers; lease exclusivity by partial unique index; CAS artifacts under FLOYD_RUNTIME/artifacts.
- `node --test`: 5/5 pass (append-only, lease conflict, CAS, idempotent submission, payload parsing). `tsc -b`: clean.

### Phase I4 (managed engine): complete
- Core spawns pinned binary by absolute path after sha256 re-verification, --pure, loopback 41415, minimal PATH env, broker-fed key in env only.
- Gateway on 127.0.0.1:41414 with 0600 bearer token; CLI + cockpit surfaces attach to same state.

### Phase I5 (golden path): in progress
- scratch-calc project created at FLOYD_RUNTIME/projects/scratch-calc (median tests failing at baseline, commit fa25f00).
- Run run_mrh89sxa0aa9e039a433 submitted. First attempt failed: engine wraps responses in {data:...} envelope — adapter fixed, retry endpoint added, core restarted (recovery marked prior jobs interrupted), run retrying.

### Errors Encountered (implementation)
| Error | Attempt | Resolution |
|---|---|---|
| `node --test core/daemon/test/` MODULE_NOT_FOUND | 1 | Use explicit glob `"core/daemon/test/*.test.ts"` |
| TS2688 missing node types | 1 | Added @types/node dev dep |
| TS2352 JobRow casts | 1 | `as unknown as JobRow` |
| engine session create "no id" | 1 | 1.17.15 wraps all JSON in {data:…}; adapter unwraps envelope |

### Phase I5 progress (attempt 4, in flight)
- ModelUnavailable chain solved: {data} envelope → glm-4.6 catalog drift → integration-connection auth (ZHIPU_API_KEY env). ADR-001 records all four seam corrections.
- Broker zai credential proven stale (401 at api.z.ai coding endpoint); config key proven valid (200). Core validates broker-first, falls back with evidence (engine.started.credential_source), fails closed otherwise.
- waitIdle rebuilt as completion-polling (POST /wait is 503 in this build).
- Recovery re-prompt path implemented and exercised live: reattach with prior_assistant_turn=false → set model → re-prompt (evidence engine.prompt.resubmitted). No duplicate action possible once an assistant turn exists.
- Builder (glm-5.2) wrote correct median() in leased worktree job_mrh89sxa…; run continuing to diff/test/review.
- Cockpit verified over HTTP: serves at gateway, 401 without token, same project/run/lease IDs as CLI. Visual browser check NOT done (extension disconnected).

### Phases I5–I8: complete (runtime-verified)
- Golden path executed end-to-end on run_mrh89sxa0aa9e039a433: builder (glm-5.2, leased worktree) → diff 43348f4b… → tests 4/4 (exit 0) → reviewer (separate session+worktree) "VERDICT: approve" → waiting_review → explicit accept → merge 8c45c8d → 4/4 tests on main → leases released → memory item stored with source attribution.
- Restart proof: identical durable state before/after kill+relaunch (diff of snapshots empty); only lifecycle evidence added; no duplicate action.
- Dual surface: CLI and cockpit gateway return identical project/session/run/artifact IDs; API 401 without token; SSE live.
- TDD adopted mid-session per Douglas: engine-logic predicates + memory built test-first. Final: tsc clean, 14/14 unit tests.
- Handback: docs/HANDBACK-2026-07-12-golden-path.md (ten proofs + blunt unavailable list). ADR-001/ADR-002 record corrections.
- Honest gap: engine permission asks never fired in server mode — Floyd gate wired but unexercised; top follow-up.

### Loop repeatability proof (second iteration, zero code changes)
- run_mrh9l2jw0438cf235f92 "mode() via TDD" executed first-try through the live loop: lease → route receipt → builder session ses_0ab85429fffe… (glm-5.2) wrote 5 new tests + implementation (9/9 pass, exit 0) → reviewer session approved with substantive findings → explicit accept → merge 6113895 → 9/9 on main → all leases released → memory item auto-written by the decision path (2 source-attributed items now recallable).
- This proves the connecting agent loop is a repeatable ecosystem facility, not a one-off script.

### Permission root cause (resolved, live-verified 2026-07-12)
- 1.17.15 ignores the `permission` config field (global AND agent-level) — compiled PermissionV2 ruleset stays base allow-all inside the session directory; asks only on external_directory and .env reads. Config echoes intent while policy differs: upstream gap report item.
- Ask/reply machinery verified working in server mode: external-directory write fired an ask in ~10s; reject via REST blocked the write (file absent).
- Fix shipped: `floyd-reviewer` engine agent with write/edit/bash/patch/multiedit disabled (adversarial test: model attempted all four, engine blocked all, no mutation) + Core-side reviewer empty-diff invariant (`review.mutation_detected`). Commit e1f5372.

### P1 Interactive session channel (in progress, 2026-07-12)
- Governance bootstrap repaired to 13/13 (bootstrap.sh --repair; agent log, supercache link, FLOYD.md header). Punchlist authoritative at docs/PUNCHLIST.md.
- live-channel.ts normalizer (TDD, 7 tests) + engine /api/event subscription (bare /event is heartbeat-only — verified), run-scoped SSE `GET /api/runs/:id/stream`, `POST /api/runs/:id/steer`, CLI watch/steer, cockpit live pane + steer input.
- STEER PROOF: run_mrhwckwq04c59b65e0de asked for stats() with count+sum; mid-flight steer (actor douglas-cockpit) added min/max requirement; diff + tests show min/max; 17/17 pass. Evidence: engine.steer.submitted.
- Remaining P1: live stream capture proof on fixed /api/event subscription (run 4) + cross-surface UI click.

### Objective 1 — bidirectional session channel: COMPLETE (acceptance PASS, 2026-07-12)
- tests/acceptance/objective1.py: all 5 sub-tests PASS (exit 0) on run_mrhwuoeo048dbb2e4596 — five event types streamed (2688 sequenced events), mid-run steer reflected in diff, question answered via channel (scale chosen), permission granted from surface (external note written after grant), Last-Event-ID replay from seq 1345 returned 1343 frames in order.
- Permission semantics upgraded: AgentSpec-listed kinds auto-decided by Core; unlisted kinds stay pending for surfaces (policy.pending_surface_decision → surface policy.decision). Human-in-the-loop verified live.
- docs/session-contract.md (Objective 2.2) written. Cockpit + CLI now consume the channel as primary. 27/27 unit tests, tsc clean.

### Objectives 2-4 progress (2026-07-12)
- Objective 3 COMPLETE: memory injection (memory.injected, block in live prompt) + versioned skills registry (skills.ts, TDD 5 tests, 2 seeded skills code-review@1.0.0/tdd-loop@1.0.0) with on-demand @skill loading (skill.loaded receipt in run_mrhxi4r5); roadmap reordered Skills&Memory before PTY (deferred).
- Objective 4 CI sub-tests COMPLETE: com.floyd.core.plist PASS 10/10 (launchd_plist_test.py); launchd Core running pid 85295 exit 0; CLI run executed against it with exactly one Core process; CLI attaches never spawns. FOOTGUN: launchd EX_CONFIG(78) when stdio redirects to external volume — logs moved to ~/Library/Logs/floyd. Reboot survival = manual operator item (docs/RELEASE-CHECKLIST.md).
- Objective 2: on-attach pending-ask snapshot added for cross-surface continuity (a surface joining after an ask fired still sees open questions/permissions). Parity test iterating.

### Objective 2 — cross-surface continuity: COMPLETE (parity PASS 6/6, 2026-07-12)
- cross_surface_parity_test PASS (run_mrhxxxf41w95d6d8b67a): CLI surface started run, cockpit attached mid-run, observed live token stream (2287 frames), answered engine question que_f56eb378 -> yes, CLI observed same events (2366 frames) + run continued to gate, exactly one Core (launchd pid 85295).
- Fix that got it green: cross-surface interactive primitive changed from permission-ask (flaky — builder's own in-worktree guardrail makes it refuse the external write, correctly) to a question (deterministic; the model reliably uses its question tool). Permission-grant-from-surface remains proven in objective1.py.
- ALL FOUR OBJECTIVES COMPLETE. 33/33 unit tests, tsc clean, Core launchd-managed. docs/session-contract.md is the mobile-ready contract.

### Cleanup pass — 2026-07-12 (post-Opus audit)

A 2026-07-12 audit found a self-resurrecting `com.floyd.core` launchd daemon, a permission-hang landmine, run cleanup gaps, and repo/worktree litter. The following was executed with evidence:

- **com.floyd.core neutralized**: `launchctl bootout gui/$(id -u)/com.floyd.core` + `kill 85351`; plist quarantined to `~/.floyd/quarantine/2026-07-12/Library/LaunchAgents/com.floyd.core.plist` (restore command in `.WHY.md`). Service absent from `launchctl list`; engine child absent from process table.
- **Permission gate hardened**: `core/daemon/src/runs.ts` now rejects unlisted permission kinds deterministically instead of leaving them pending for a human surface that does not exist on the loopback launchd path. Evidence: `policy.decision` with `reject` + reason.
- **Run failure cleanup**: `runEngineTask` accepts `idleTimeoutMs`; builder uses 120s timeout; `executeRun` catches failure, records `engine.builder_failed`, sets job `failed`, and removes the leased worktree + releases the lease.
- **Verification**: `pnpm test` 33/33 pass; `pnpm typecheck` clean.
- **Gateway token rotated**: `/Volumes/Storage/FLOYD_RUNTIME/core/gateway.token` regenerated; new SHA-256 differs from old.
- **CLAUDE.md corrected**: repo-root `CLAUDE.md` no longer claims "golden path is implemented and runtime-verified" globally; it now states the golden path is partially implemented and verified only for the exercised builder→reviewer loop, with the not-yet-built surfaces listed.
- **Orphaned worktrees/branches removed**: 12 `FLOYD_RUNTIME/worktrees/job_*` worktrees quarantined to `/Volumes/Storage/.floyd/quarantine/2026-07-12/FLOYD_RUNTIME/worktrees/`, `git worktree prune` cleared the registry, and 12 `floyd/job_*` branches in `scratch-calc` were deleted. Uncommitted diffs archived to `/Volumes/Storage/FLOYD_RUNTIME/artifacts/orphaned-worktree-diffs-2026-07-12/`.
- **Intentional states documented (not changed)**:
  - `/opt/homebrew/bin/opencode` points to `/Users/douglastalley/.opencode/bin/opencode` (stock 1.17.15). No `opencode-superfloyd` target exists on disk, so this symlink was left as-is and is noted here.
  - `/Volumes/Storage/FLOYD_WORKSTATION/.supercache` is a symlink to `/Volumes/SanDisk1Tb/.supercache`. Current parity verified: both `VERSION` stamps read `1.7.2`. Cross-volume unmount risk remains; remediation (local copy or union mount) requires owner decision.

## Ecosystem SDK integration — 2026-07-13

- Canonical repository connected to `CaptainPhantasy/FLOYD-THE_WHOLE_DAMN_SUITE`; the unrelated initial remote history was preserved in merge commit `a104e47` rather than overwritten.
- Existing unattended-engine hardening committed separately as `2074322` after 33/33 tests and typecheck passed.
- Live start initially failed closed because `upstream.lock` pinned OpenCode 1.17.15 while the absolute binary reported 1.17.18 with SHA-256 `652a34ca…`. No guard was bypassed.
- The installed binary was launched in an isolated temporary XDG environment. Loopback `/api/health`, `/api/session`, `/api/permission`, `/api/question`, `/api/event`, and current root routes were probed; the process was then stopped.
- `upstream.lock` and `@opencode-ai/sdk` now match exact version 1.17.18. Core's session, prompt/steer, model switch, message, permission, question, health, and event calls now pass through `@floyd/opencode-runtime`.
- Added `@floyd/sdk`: dependency-free bearer client, exact HTTP error object, typed Core operations, normalized SSE async generator, Last-Event-ID resume, reader cancellation, and AbortSignal propagation.
- Existing CLI regular requests now use `@floyd/sdk`; the CLI does not import or connect to OpenCode.
- Added `ecosystem/surfaces.json` for desktop, IDE, TUI, PTY, launcher, ADK, and mobile. Every entry explicitly prohibits direct OpenCode access.
- Live runtime proof: Core started on `127.0.0.1:41414`, supervised OpenCode 1.17.18 on `127.0.0.1:41415`, CLI health returned both healthy, and a direct `OpenCodeSdkRuntime.health()` returned `true`; both processes were cleanly stopped.
- Verification: 39/39 tests pass, TypeScript project references clean, production audit reports 0 vulnerabilities at all severities.
- Sharp edges retained as open issues: Node 22.18.0 is below declared Node >=26; no launchd autostart; surface donors are inventoried but not copied/admitted; The_Burner has no local checkout; official OpenCode SDK adds daemon-only `cross-spawn` transitively.

## Natural-language coding pane — 2026-07-13

- Replaced the minimal cockpit run inspector with an IDE-style natural-language coding partner pane: project selector, run history, new-run composer, active-run steering, normalized token/tool stream, inline question/permission decisions, accept/reject/escalate gate, artifact inspector, responsive layout, and explicit Core/OpenCode authority display.
- Added the dependency-free browser build at `packages/sdk/browser/floyd-sdk.js`; Core serves it as `/floyd-sdk.js`. The cockpit contains no raw `fetch`, `EventSource`, direct OpenCode endpoint, provider key, or OpenCode SDK import.
- Removed all emoji glyphs from the cockpit. UI marks and controls use typography, borders, and CSS geometry.
- First rendered Chrome proof caught `TypeError: Illegal invocation` because native `window.fetch` had been stored unbound. `FloydBrowserClient` now binds native fetch; a regression test covers receiver-sensitive fetch.
- Second rendered proof PASS: title `Floyd Workstation`; health `Core and engine online`; one `scratch-calc` project; 14 runs; no toast; no page errors; no emoji glyphs; no EventSource path. Selecting a real accepted run rendered two transcript rows, four inspector sections, accepted state, two engine jobs, five artifacts, and no page errors.
- Security incident during proof cleanup: a process-list command printed the URL-bootstrap gateway token from Chrome's command line. The proof browser and Core were stopped, the token was rotated, and live auth verification returned old token HTTP 401 / new token HTTP 200. Future proof must avoid putting gateway tokens in process arguments.

## Protected surface copies — 2026-07-13

- Added and ran `scripts/prepare-surface-copies.sh`; originals were not modified.
- Independent copies now exist under the git-ignored `intake/surfaces/` area for desktop, IDE, TUI, PTY, launcher, ADK, and mobile.
- Remote copies are clean at: desktop `68ba0642603b`, IDE `1bec2197aa14`, TUI `c5d2b231733b`, PTY `b3a4d90286fb`, ADK `c70c9b3d7c87`, mobile `f1da3eb9a43a`. Launcher is a `--no-local` clone at `30d6717483b6`.
- Validation PASS: all seven worktrees clean; no symlink points to a protected donor path; launcher representative source/copy inode identities differ (`16777260:35863503` vs `16777260:47836049`).
- First validator run exited 1 after cloning because it selected the donor's untracked `.DS_Store` as the inode probe; the clone correctly lacked that file. The script now selects a tracked path via `git ls-files`, and the complete rerun exited 0.

## Desktop Core integration — 2026-07-14

- Edited only the independent Desktop intake copy; the dirty original at `/Volumes/Storage/FloydDesktopWeb-v2` was not touched.
- Added a pinned, zero-dependency `@floyd/sdk` snapshot and a server-side bridge. The browser calls `/api/core/health` and `/api/core/chat/stream`; the gateway token is read by the server and never enters browser state or URLs.
- New-run submission and active-run steering go through Floyd Core. Core status/payload are preserved before stream headers; incoming abort or outgoing close aborts the SDK request, and the SDK generator cancels its reader in `finally`.
- Replaced the direct-provider settings UI with a read-only runtime panel and removed rendered emoji glyphs. Legacy provider routes remain server-side for migration compatibility but are not reachable from the current pane.
- Replaced `uuid` with Node `crypto.randomUUID()`. Updated Electron, Express, Puppeteer, and WebSocket dependencies plus narrowly scoped transitive overrides. Production audit moved from 13 advisories (including one critical) to zero; dev-only audit findings remain outside the production graph.
- Build passed, Vitest passed 6/6, production audit found zero vulnerabilities, live Desktop `/api/core/health` returned HTTP 200 with Core and OpenCode healthy, and rendered Puppeteer proof showed the Core route, no provider-key UI, no emoji, and no page errors.
- Live launch also exposed a donor crash on occupied MCP port 3005. The auxiliary port is now configurable and bind failure degrades only the Chrome extension bridge; Desktop stayed online during the repeated occupied-port proof.
- Component commits `11015cf9f8dba2cb5dc81a16b4e131ea234140a0` and security follow-up `3eba9b3019ff0488d650a5a48d7beed27612f837` pushed to `CaptainPhantasy/floyd-desktop-web-v2` branch `feat/floyd-core-runtime`. The follow-up removes wildcard CORS and binds Desktop to `127.0.0.1` by default so the Core bridge is not exposed as a LAN-wide confused deputy.

## IDE Core and folder-workspace integration — 2026-07-14

- Verified the existing folder workspace implementation instead of replacing it: welcome screen, Projects panel, command palette, top bar, and File Explorer expose Open Folder; `/api/fs/workspace-info` validates a directory before the IDE switches roots and persists recent/last workspace state.
- Replaced the rendered provider-key assistant with a natural-language Floyd Coding Partner. Its server-side vendored `@floyd/sdk` bridge resolves or registers the current folder in Floyd Core, submits a new run or steers the durable session, normalizes Core SSE for the pane, and aborts the Core reader when the client disconnects.
- Legacy `/api/llm/*` provider routes and unused `src/lib/llm.ts` remain in the donor for migration compatibility, but `AIChatPanel.tsx` no longer imports or exposes them. Their eventual removal is a separate breaking cleanup.
- Upgraded Express to 4.22.2 and WebSocket to 8.21.0. Production audit moved from four advisories to zero; full-install dev advisories remain.
- Verification passed: `npm run lint`, `npm run build`, production audit zero, live Core health HTTP 200 with OpenCode healthy, live folder workspace HTTP 200 for `/Volumes/Storage/FLOYD_WORKSTATION`, and installed-Chrome rendered proof with enabled Core input, no provider-key UI, no emoji, and no page errors.
- Component commit `e094896512d97bfd65935cd25da5c30a55848dae` pushed to `CaptainPhantasy/mobile-web-IDE` branch `feat/floyd-core-runtime`.

## TerminalOne and harness-launcher Core integration — 2026-07-14

- Edited only the independent intake copies. `/Volumes/SanDisk1Tb/TerminalOne` retained its pre-existing documentation changes, and `/Volumes/Storage/harness-launcher` remained clean; neither donor was modified.
- Added CommonJS-compatible, zero-dependency `@floyd/sdk` snapshots and server-side `/api/floyd/health` bridges. The gateway token is read under `FLOYD_RUNTIME_ROOT` inside Node and is never returned to the browser or placed in a process argument.
- Both bridges preserve upstream HTTP status and JSON error payloads. The launcher regression test proved exact 429 preservation and that abandoning the browser request closes the outbound Core request; TerminalOne proved exact 401 preservation.
- Added a trusted PTY-local Core CLI command. It defines collision-free `floyd_core`, removes a pre-existing legacy `floyd` alias, then installs a session-local `floyd` alias; no global shell files change and the CLI still talks only to Floyd Core through `@floyd/sdk`.
- The launcher now lists `floyd-core` from its single-source registry. Its full suite exercised all 16 registered harnesses plus error recovery, argument injection resistance, respawn-race prevention, and concurrent isolation.
- TerminalOne gained a Floyd action, Core/OpenCode status, loopback binding by default, `node:crypto.randomUUID()` in place of `uuid`, structured occupied-port failure, and removal of rendered gear/star/close glyphs. Its full input, Core, browser, resume, feature, behavior, and responsive suites passed.
- Both production and complete dependency audits report zero vulnerabilities. Express is 4.22.2 and WebSocket is 8.21.0.
- Live proof used Floyd Core PID 55182 and managed OpenCode PID 55188. Rendered browser checks on isolated ports showed `Core/OpenCode online`, real `floyd-core` health JSON in each PTY, no provider/API-key text, no rendered emoji, and no page errors. The first launcher render exposed a missing favicon 404; a data favicon removed it before the final proof.
- TerminalOne implementation commit `b657853ce0f373637261145ecf4666b920bcdc8e` plus documentation head `d6c652f2a9bc4f1d58ee4402c93884f0bb3822b5` pushed to `CaptainPhantasy/TerminalOne` branch `feat/floyd-core-runtime`. Launcher implementation commit `55d81f95f2b4bcaa28272678b4b6ee8659578d3e` plus documentation head `5caf75615d346e164b610f763bba0ec290b8c30b` remain only in the independent copy because its `origin` is the protected local donor.

## Active surface scope change — 2026-07-14

- Douglas removed ADKv2Agent and The_Burner from the active integration list before work began on either component.
- Neither protected donor nor either intake copy was modified. Existing intake directories remain untouched as historical provenance; they are excluded from the active manifest and copy-preparation loop rather than deleted.
- The active five-surface system is Desktop, IDE, OhMyFloyd, TerminalOne, and harness-launcher. At the time of this scope change, OhMyFloyd was the only component integration still pending; it is now complete below.

## OhMyFloyd Core integration — 2026-07-14

- Edited only `/Volumes/Storage/FLOYD_WORKSTATION/intake/surfaces/tui`; the modified donor at `/Volumes/SanDisk1Tb/OhMyFloyd` was not used as a worktree and was not changed.
- Added a zero-dependency `@floyd/sdk` workspace package with exact Core errors, normalized SSE parsing, Last-Event-ID support, AbortSignal propagation, and reader cleanup.
- `omp` now defaults to a Floyd Core natural-language coding pane. It supports run submission, active-session steer, question answers, one-time/always/reject permission decisions, run attachment, and accept/reject/escalate review. `omp launch` remains an explicit legacy direct-provider migration command.
- The pane imports no provider SDK or provider credential controls. It reads only the 0600 loopback Core token; Floyd Core owns OpenCode, provider credentials, durable sessions, tools, policy, and review state.
- First live smoke exposed an accidental native-addon dependency caused by importing the old editor/theme stack. The Floyd pane now uses pure TypeScript TUI primitives, so status and interactive mode work without a compiled native addon.
- Dependency audit initially found 28 production vulnerabilities inherited from legacy provider/browser/XML dependencies. Same-major transitive overrides and a Turbo patch update reduced both production and complete audits to zero; the new Floyd SDK itself has no registry dependencies.
- Verification passed: coding-agent package check, Floyd SDK check, Rust fmt/clippy, exact 429/SSE/reader-cancel contract simulation, live default and explicit Floyd status against Core PID 55182/OpenCode PID 55188, rendered tmux `/help` proof, and clean Ctrl+C termination. The root monorepo `bun check` wrapper still fails on unrelated pre-existing formatter debt under `packages/agent` and old TUI tests; its coding-agent and Rust legs pass independently.
- Component commit `3121bce7acd64c6801003a47d9e2d030d470233f` pushed to `CaptainPhantasy/OhMyFloyd` branch `feat/floyd-core-runtime`.

## Five-surface acceptance — 2026-07-14

- `scripts/prepare-surface-copies.sh` verified clean independent copies at Desktop `3eba9b3019ff`, IDE `e094896512d9`, OhMyFloyd `3121bce7acd6`, TerminalOne `d6c652f2a9bc`, and launcher `5caf75615d34`; launcher source/copy inode separation remains true.
- `scripts/verify-active-surfaces.sh` verified the manifest contains exactly those five surfaces, every current Git head matches its pinned integration commit, every copy is clean, direct OpenCode ownership is false, every production audit count is zero, and live Floyd Core PID 55182 reports managed OpenCode PID 55188 healthy. The token is read inside the Node verifier and never placed in process arguments.
- Canonical suite verification passed: 43/43 tests, TypeScript project references, production audit, complete audit, and `git diff --check`. Node 22.18 still emits the declared Node >=26 engine warning; the commands nonetheless exited zero.
- Live OhMyFloyd submit proof replayed accepted run `run_mrhxxxf41w95d6d8b67a` through the default Floyd command. Core returned the same run ID and the state remained at 15 runs, proving the submit route without starting another model job or incurring a new provider call.
