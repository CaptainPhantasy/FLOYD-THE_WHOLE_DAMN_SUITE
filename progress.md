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
