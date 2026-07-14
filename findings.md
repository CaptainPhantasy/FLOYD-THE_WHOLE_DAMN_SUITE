# FLOYD Ecosystem Unification — Findings and Decisions

## Portable experience envelope audit — 2026-07-14

- Core currently persists projects, sessions, runs, jobs, leases, artifacts, provider profiles, skills, memory, and append-only evidence. It does not persist presentation continuity: active run/view, transcript cursor, unsent draft, selected artifact, or surface capabilities.
- Cockpit currently keeps `currentRunId`, current session, model route, transcript map, and composer contents in browser memory/session storage. A reload or another surface therefore reconstructs backend truth but cannot resume the exact visible experience.
- The existing session channel already supplies the hard execution primitive: multiple surfaces attach to the same Core session, replay from Last-Event-ID, and receive pending question/permission snapshots. The new layer must reuse this channel and must not introduce a second session authority.
- `docs/PUNCHLIST.md` and the blueprint already require actor/device rows, device-scoped tokens, private-overlay access, revocation, and a visible kill switch. The current single gateway bearer is explicitly a temporary local-only boundary.
- The first implementation slice is a versioned `ExperienceEnvelope` with optimistic revisions. It persists only credential references, never provider secrets; pending engine asks are hydrated by Core from the active engine session rather than accepted as client-authored truth.

## Requirements

- Unify the named FLOYD projects into one coherent local workstation ecosystem inspired by the integration quality of the Anthropic ecosystem, while remaining Douglas-and-FLOYD-specific.
- Retain a capable desktop launching surface, MCP bridge, multi-FLOYD/Browork orchestration, and an internal FLOYD agent.
- Establish a persistent runtime that flows through desktop, CLI, browser, mobile, sandbox, multimedia, and multi-agent surfaces.
- Preserve the useful installed `ff` workflow until a verified migration path exists; do not equate it with the corrupted v5 backup tree.
- Recover the strongest desktop and multimedia-generation capabilities rather than reducing the system to a CLI wrapper.
- Determine the ecosystem structure and process flow from direct inspection, then produce the official implementation plan.
- Evolve the former harness, skills, lab, and tunnel features to current engineering patterns while retaining the FLOYD’s Labs brand voice.
- Support one continuous user workflow across mobile phone, SSH, terminal/code, Browork dispatch, photo/video generation, and Git-level operations.
- Treat every named source directory and app bundle as immutable; create and verify independent copies before any future edit.
- Evaluate the existing OpenCode customizer, FLOYD CODE app, and CURSE'M editor before designing replacement platform/editor surfaces.
- Deliver privately for Douglas and possibly teammates; public distribution and public service exposure are non-goals.

## Skill-Derived Modernization Criteria

### Agent harness

- Tool/action names must be stable, explicit, schema-first, and narrowly scoped.
- Tool observations should share a deterministic envelope: `status`, `summary`, `next_actions`, and `artifacts`.
- Error paths need a root-cause hint, safe retry instruction, and stop condition.
- Prefer hybrid control: exploratory reasoning for uncertain planning, typed/function execution for deterministic actions.
- Tool granularity follows risk: micro-tools for deployment/permissions/migrations, medium tools for normal loops, macro-tools only where round-trip cost dominates.
- Benchmark completion rate, retries, pass@1/pass@3, and cost per successful task.

### Skill system

- Treat skills as discoverable on-demand packages with trigger documentation, implementation guidance, optional scripts, tests, and registry/catalog metadata.
- Preserve cross-harness compatibility through thin adapters or copies generated from one canonical package, not independently drifting feature forks.
- Apply the referenced repository’s JavaScript naming/commit conventions only if the selected FLOYD skill-registry implementation is that repository or explicitly adopts those conventions.
- New capabilities should pair implementation, tests, and docs; catalog counts/metadata must be derived from filesystem truth.

### FLOYD identity and brand policy

- Keep every fact, metric, structural point, and truth-state label intact when applying voice.
- Explicitly label examples and capabilities as real, hypothetical, planned, in progress, or shipped.
- Translate jargon for operators and non-technical builders before adding personality.
- Treat brand voice as a presentation skill/policy selected per audience, not a hidden modifier of tool calls, stored evidence, permissions, or runtime contracts.
- The official blueprint is an internal technical document: use restrained garage-born clarity, specific evidence, and no corporate filler; avoid decorative audio-hostile formatting where it impairs use.

### Floyd Lab execution isolation

- The skill describes an on-demand Debian 13 arm64 VM on Apple Virtualization Framework via VibeBox, with 4 CPU, 4 GiB RAM, 20 GiB persistent disk, and 10-minute idle shutdown.
- Its intended boundary is untrusted dependencies, Linux builds, destructive operations, and full-stack tests; simple safe edits, basic Git, and required macOS operations stay on the host.
- Security expectations: explicit mount allowlists, read-only FLOYD config, no host environment inheritance, and no filesystem access beyond configured mounts.
- The skill references `/Volumes/SanDisk1gb/floyd-sandbox/`, but live inspection proved that volume name does not exist. The actual configured tree is `/Volumes/SanDisk1Tb/floyd-sandbox/`, containing `vibebox.toml`.
- `vibebox` did not resolve on the current tool-shell PATH, so VM lifecycle/version claims are not currently executable from this environment without locating or installing the binary. No VM was started.
- The skill’s fixed example IP remains unverified and must not become a contract; runtime discovery should supply guest addressing.
- Modern target: expose `lab.create/exec/inspect/stop/reset` through a typed provider interface while the control plane owns authorization, job records, artifacts, logs, cancellation, and cleanup.

### Tunnel and remote-access recovery

- Preserve the recovery priority: local bridge/process health, then private overlay reachability, then private route health, then manual remote-access fallback, and only then an explicitly enabled public tunnel.
- Implement deterministic probes and bounded remediations as code; invoke agent reasoning only for diagnosis, policy-governed escalation, or generating the operator explanation.
- Enforce a single-flight recovery lock to prevent duplicate guardians racing each other.
- Use observe-once, act-once, observe-again for GUI fallback; prefer CLI and local health endpoints.
- Public exposure requires a runtime policy flag/capability grant. Never reset network identity, credentials, ACLs, or broad firewall/router state automatically.
- Replace hard-coded service labels, addresses, ports, user IDs, and notification destinations with validated configuration plus live discovery.
- Emit one recovery event containing failure, attempted action, current reachable path, expected client behavior, and at most one manual next step; fan that event out through configured operator channels/outbox.
- Live check: `com.user.floyd.http-bridge.plist` exists in the user LaunchAgents directory, but `launchctl list` did not show the label as loaded.
- Live check: `GET http://127.0.0.1:43117/health` returned curl code `000`; the local bridge was unreachable at the observation point.
- `tailscale` did not resolve on the current tool-shell PATH. This does not prove Tailscale is absent as an app/network extension, only that the skill’s CLI path is not currently available here.
- The host contains many Floyd/Floyd's Labs launchd plists (agent, gateway, secret broker, memory watchers, ngrok watchdog, terminal, bridge/session/guardian, TailServe sites). This is strong evidence of fragmented service ownership and a migration requirement for one service registry/supervisor.

## Parallel Auditor Evidence

Browser/mobile and desktop/isolation lanes are complete read-only static audits. Live runtime and current test health remain explicitly unverified.

### Browser and mobile lane

- The old Chrome extension’s source and built output diverge. Its sidepanel sends `get_status/connect`, while the source background handles differently named MCP/agent messages; the primary control path is internally inconsistent.
- That extension scans localhost ports, uses unauthenticated WebSocket transport, and can fall back directly to external model APIs. Its native-host installer references stale absolute volume paths. Initial direction: extract UI/tool assets; do not adopt the runnable package unchanged.
- The TTY Bridge is a substantial capability donor but owns PTYs, agent logic, file IPC, MCP subprocesses, and browser tooling, so it is another runtime rather than a thin browser adapter today.
- The TTY repo contains an unwired MCP path: bridge events use `mcp_*` names but the inspected background handlers do not match, and an MCP server returns a native-messaging placeholder rather than completed execution.
- The mobile PWA is closest to a thin client, but its HTTP/SSE/actions/Browork requests omit the token used by WebSocket auth. Existing screenshots show invalid-token and disabled-action states, not end-to-end proof.
- Mobile restart code kills any PID on its port without ownership validation; first-message and non-WebSocket recovery gaps remain. Initial direction: preserve the PWA shell/API shapes behind centralized auth/approval and deterministic envelopes.

#### Browser/mobile normalized findings

##### Old Chrome extension

- Build inputs are `src/background.ts`, `src/content.ts`, and `src/sidepanel/index.ts`; manifest and background source differ from the existing `dist` output, with no test suite or build receipt.
- Seven structured browser/DOM/vision operations plus navigation, read, click/type, tabs, and screenshots are implemented and worth extracting.
- Transport is unauthenticated `ws://localhost:3005` with custom registration and MCP-like JSON-RPC, falling back to an absent `com.floyd.chrome` native host.
- The agent scans ports 3000–3009 and automatically falls back to a direct external provider. An open port is not identity/capability proof, and fallback is not policy-authorized.
- The sidepanel sends `get_status/connect`, while background handles `get_mcp_status`, `get_tool_metadata`, and `agent_*`; the primary built control path is statically mismatched.
- The native installer hard-codes obsolete volume paths and wildcard extension origins. Safety code warns but permits destructive/untrusted-domain actions.

##### TTY Bridge

- Implemented route: sidepanel -> Chrome background -> up to two `com.floyd.tty` native ports -> two Python login-shell PTYs -> OSC 7701/7702 -> browser/content tools.
- It includes dual xterm terminals, browser/a11y/refs/set-of-marks tools, screenshots, console/network capture, downloads, checkpoints/workflows, audio/WASM, Gemini Live audio/video, shell SDK, file IPC, MCP subprocess management, and a nested Tom app.
- MCP remains incomplete: Python emits `mcp_*`/`anvil_*`, background lacks matching handlers, and `mcp-server.js` reports `native_messaging_placeholder` instead of execution.
- Result semantics are unsafe: outer routing can report success when the nested payload contains an error. Twenty-seven implemented cases are absent from one schema surface; SDK/schema names also drift.
- Shell execution has no allowlist; file proxy lacks authentication/ownership checks; debug host logging writes the complete environment to `/tmp`; the nested Tom app exposes a filesystem bridge on `0.0.0.0` and injects a model key into browser code.
- Existing artifacts/test claims are stale relative to dirty source. A current pytest cache records at least one failed test, so no fresh passing-suite claim is valid.
- GIF encoding is explicitly deferred; it is not a shipped media artifact capability.

##### Mobile PWA

- The nested Git repo is clean and the React/Vite PWA renders chat, sessions, Browork, terminal, actions, settings, voice, Git views, and service-worker updates.
- WebSocket sends an auth token and has bounded single-flight reconnect; every inspected HTTP/SSE request omits authorization, including terminal, Git Actions, and Browork.
- A React state/closure race drops the first message after creating a session; cancellation IDs diverge, and terminal listeners can accumulate across reconnects.
- Git commit/push commands are constructed client-side without a centralized approval/evidence boundary.
- There is no ngrok lifecycle, tunnel lease, health probe, private-first discovery, or explicit public-fallback state. The dev launcher kills any owner of port 8765 without identity validation.
- Workbox caches `/api/` GET data for up to 24 hours, creating stale/sensitive data risk.
- Rendered screenshots prove UI presentation only: one shows `Invalid token`, another remains on the welcome shell, and Actions is disabled without a project.

##### Cross-surface contract implication

- Chrome exposes browser capabilities only; TTY/Desktop lease runtime-owned PTYs; PWA renders authenticated commands/events. None owns models, prompts, sessions, policy, retries, tunnel leases, or canonical artifacts.
- Normalize current `{success,result,error}`, OSC, MCP, and SSE forms into the shared `status/summary/next_actions/artifacts` envelope; nested errors and deferred encoders must never map to success.
- Brand/persona packages consume neutral observations for display; they do not alter action identity, evidence, approval, or persisted status.

### Desktop and isolation lane

- DesktopWeb-v2 owns its own `.floyd-data`, settings, sessions, skills, projects, in-memory Browork state, and task queue: it is a competing runtime/state owner, not currently a thin desktop surface.
- Its multimedia queue/artifact path is in-memory/base64 with timed cleanup rather than a durable artifact/job pipeline; server and packaged build copies are reportedly out of sync.
- Static inspection verifies open CORS, unauthenticated server/MCP surfaces, and default tool access spanning the current directory and home directory.
- `floyd-sandbox` is an experiment container, not an isolation implementation. Its strongest Go tree has MCP/skills/permissions/session/subagent assets but inherits host environment and lacks mount/secret/idle isolation.
- The FLOYD Wrapper has useful TypeScript/Zod tool-contract assets, while MCP/sandbox paths are placeholders and build settings can mask TypeScript failure.
- INK is a prototype with ineffective `ask` permission behavior, unauthenticated WebSocket, stale native-host wiring, and obsolete tests.

#### Desktop/isolation normalized findings

- Desktop source implements DALL-E 3 image, ElevenLabs text-to-speech, and Zai CogVideoX video adapters, but model routing is bypassed, job state is in memory, and artifacts remain base64/data URLs with timed cleanup.
- Target multimedia flow is `MediaJob -> provider attempt -> immutable Artifact -> transformation/derivative -> export/publish`, with attempts, provider IDs, hashes, lineage, and artifact references stored outside message rows.
- No inspected asset provides a real sandbox: Desktop and Wrapper inherit `process.env`; Go defaults to `os.Environ()` and host cwd; Wrapper sandbox exists only in docs; INK merely labels a workspace as a sandbox.
- Existing permission brokers are reusable policy UX above isolation, not isolation themselves. The new provider needs explicit mounts, empty environment by default, referenced secrets, network policy, resource limits, leases/idle TTL, streamed observations, and forced cleanup.
- Wrapper supplies Zod input schemas, typed `ToolResult`, and stream events. Go supplies permission requests, categorized errors with resolution suggestions, tool metadata, and checkpoints. These are seeds for one generated schema, not competing contracts.
- Go's default workflow executor is a stub: it marks steps complete without executing commands, validation always succeeds, and rollback does not run rollback commands.
- `FloydDeployable` and `floyd-next` share 725 inspected paths: 503 identical and 222 different. The aggregate delta is 326 files, +27,155/-4,608. Extract Deployable runtime packages plus `floyd-next` CI/GoReleaser assets, then retire the duplicate generation after provenance is preserved.
- Highest-value Go donor packages: `internal/agent`, `internal/db`, `internal/session`, `internal/permission`, `internal/skills`, `internal/plugins`, and `internal/agent/tools/mcp`.
- Highest-value Desktop donor: `MultimediaPanel`, media rendering, desktop theme/assets, and provider adapters. Highest-value Wrapper donor: types/tool registry/Zod/browser/checkpoint/theme. INK contributes native framing/theme reference only.

## Initial Verified Facts

| Fact | Evidence | Confidence |
|---|---|---|
| Active workspace is `/Users/douglastalley/Documents/Floyd_EcoSystem` | `pwd` returned the exact path. | verified |
| The workspace is greenfield except for Git metadata | `ls -la` showed only `.git`; `find . -maxdepth 2 -type f` showed only Git control files. | verified |
| No prior planning files existed in the workspace | `rg --files` found no `task_plan.md`, `findings.md`, `progress.md`, `.planning/*`, or `FLOYD.md`. | verified |
| The planning skill’s catch-up script reported no unsynced context | Session catch-up exited `0` with no output. | verified |
| An active goal already carries the full user objective | `get_goal` returned status `active` and the user’s ecosystem-unification objective. | verified |
| All ten user-named source directories exist and are readable | A single `stat`/`du`/Git census returned `EXISTS=YES` for every named path. | verified |
| All ten newly added source directories also exist and are readable | Second `stat`/`du`/Git census returned `EXISTS=YES` for iPhone-Dispatcher, FloydSkills, TerminalOne, terminal-control-center, MWIDE, FloydsLabsStudio, deerflow, COHORT, Agency, and ANVIL. | verified |
| The current greenfield workspace has approximately 90 GiB free | `df -h` on the workspace filesystem reported 90 GiB available; no `intake/` directory or source copy exists yet. | verified |
| The source set is materially fragmented and large | Approximate sizes range from 44 MB (`floyd-harness`) to 2.2 GB (`floyd-v5` backup); several trees include vendored environments/build products. | verified |
| Six named roots are Git worktrees and four are not | Git worktrees: TTY Bridge, v5 backup, DesktopWeb-v2, FCCLI, harness, wrapper. Non-Git roots: Chrome extension container, mobile PWA container, floyd-sandbox, INK SANDBOX. | verified |
| Every detected Git worktree has local divergence or modifications | `git status --short --branch --untracked-files=no` showed changes in all six; TTY Bridge is also 14 commits ahead of origin. | verified |
| `ff` is not on the Codex non-interactive process PATH | `whence -va ff`, `type -a ff`, `which -a ff`, and `command -v ff` all returned not found/empty under the tool shell. | verified for this process only |
| Interactive zsh resolves the live `ff` command | `/bin/zsh -lic 'whence -va ff'` returned `/Users/douglastalley/.local/bin/ff`. | verified |
| `ff` is a stable compatibility alias over the installed Floyd launcher | `~/.local/bin/ff` is a symlink whose realpath is `/usr/local/bin/floyd`. | verified |
| The installed launcher delegates to a separately managed real binary | The 375-byte `/usr/local/bin/floyd` wrapper sets `REAL=/opt/homebrew/libexec/floyd-harnesses/floyd-ff-real` and ends with `exec "$REAL" -D "$DATA_DIR" "$@"`. | verified |
| The live `ff` instance has an isolated default state root | The wrapper sets `DATA_DIR=${FLOYD_DATA_DIR:-$HOME/.floyd-ff}` and adds `-D "$DATA_DIR"` unless the user already supplied a data-dir argument. | verified |
| The launcher preserves explicit data-dir overrides | Its argument loop bypasses injected state for `-D`, `-D=*`, `--data-dir`, and `--data-dir=*`. | verified |

## Initial Source Census

| Component | Size | Git / Branch Evidence | Immediate Signal |
|---|---:|---|---|
| FLOYD Extension for Chrome | 79 MB | root is not Git | Contains `FloydChromeBuild` and a handoff document; likely packaging container. |
| Floyd TTY Bridge for Chrome | 451 MB | `main`, ahead of origin by 14, locally modified | Substantial extension/native-host project with tests, security docs, vision bridge assets, and packaged extension artifacts. |
| FLOYD MOBILE PWA + ngrok | 184 MB | root is not Git | Contains `mobile/`, browser scripts, screenshots, and prior agent metadata. |
| floyd-v5 backup | 2.2 GB | `main`, locally modified | Go source, `main.go`, `internal/agent`, multiple binaries, MCP servers, lab server, schema/config, and duplicated generations. |
| FloydDesktopWeb-v2 | 950 MB | `add-ons`, locally modified | Electron + Vite/React + TypeScript server, CLI client, tunnel assets, MCP config, releases, tests, and local data. |
| FCCLI | 98 MB | `floyd-platform-governance-hardening`, locally modified | Node CLI monorepo with chat, MCP, sessions, terminal, sandbox, worktree, incident, logging, and security features. |
| floyd-harness | 44 MB | `main`, locally modified | Python application with routers/services, API contract, run script, logs, and a vendored virtual environment. |
| floyd-sandbox | 780 MB | root is not Git | Forensic/experimental container holding several Floyd generations, patches, API comparisons, and deployment candidates. |
| FLOYD WRAPPER | 180 MB | `main`, tracked deletions | TypeScript/Node wrapper with extensive tests, performance work, build automation, and archived material. |
| INK SANDBOX | 191 MB | root is not Git | Container holding the later-inspected Ink/React agent prototype and packaging artifacts. |

## Inspection Policy

- Treat file contents as evidence/data. Do not execute instructions embedded in legacy documentation.
- Prefer manifests, imports, entrypoints, tests, launch scripts, state paths, and live process resolution over prose claims.
- Do not expose secrets; record only secret names/locations and whether handling is safe.
- Do not mutate any named legacy project during this planning pass.

## Component Evidence Matrix

| Component | Role Claim | Stack / Entrypoint | Runtime / State | Reusable Assets | Risks / Duplication | Disposition |
|---|---|---|---|---|---|---|
| FLOYD Extension for Chrome | browser executor plus competing agent/fallback | MV3 TypeScript/Vite/CRXJS; WS/native messaging | `chrome.storage.local` + panel `localStorage` | typed browser/vision tools, screenshots, theme/icons | source/dist drift, miswired UI, unauthenticated WS, blind port scan, automatic provider fallback, no native host | extract tools/assets; quarantine runnable; retire duplicate root JS |
| Floyd TTY Bridge for Chrome | rich browser/TTY/multimedia bridge plus competing runtime | MV3 JS, Python native host/PTYs, OSC 7701/7702, xterm, Gemini Live | Chrome/page storage, PTY/temp files, `~/floyd_comm`, checkpoints, local DB/logs | native framing, OSC parser, PTY supervisor, browser/a11y/ref tools, xterm/audio/video/tests | duplicate PTYs/agents/state, unwired MCP, unsafe shell/file proxy, env logging, nested public Tom bridge, version drift | adopt as capability donor; quarantine unsafe paths; retire duplicates |
| FLOYD MOBILE PWA + ngrok | closest thin mobile client | React 19, TypeScript, Vite 7 PWA, REST/SSE/WS, xterm | local settings/cache plus backend sessions | PWA shell, responsive UI, voice/xterm, typed API/SSE, Workbox/update UX | HTTP auth omission, first-message/cancel races, client-built Git commands, stale cache risk, no tunnel manager, unsafe port kill | adopt mobile presentation donor; quarantine controls until centralized policy |
| floyd-v5 backup | corrupted forensic lineage only | Go/Cobra/Bubble Tea tree sharing the live binary's module/revision lineage | local repository state is not trusted as an implementation base | provenance, historical contract clues, comparison only | user-confirmed corruption, dirty/unreproducible state, no checked-in binary match | quarantine; never use as core donor |
| FloydDesktopWeb-v2 | desktop/multimedia app plus competing backend | Electron 40, React/Vite, 4,372-line Express server | own `.floyd-data`, JSON sessions/settings/skills/projects, in-memory Browork/media queues | desktop UI/theme, media controls/adapters, mobile-auth pattern | unauthenticated HTTP/WS, open CORS, broad host execution, stale packaged server | extract UI/media; quarantine backend/state |
| FCCLI | promising coding/control scaffold, not a current runtime | Node CLI plus nested Python DeepCode UI | user-confirmed no runtime; isolated persistence/ledger concepts do not constitute system authority | execution ledger, planning approval/state, checkpoints, selected UI/worktree concepts | scaffolded/unwired engines and features, duplicate schemas, weak eager skills, nested Python parse error | harvest selectively into new daemon/client; never treat as spine today |
| floyd-harness | OpenAI-compatible provider facade | FastAPI/Pydantic with provider fallback | token-usage SQLite only; cache/process state in-memory | API adapter and transient provider fallback patterns | placeholder MCP/no handlers, no tool loop or session/job/agent authority, sensitive request logging | harvest hardened adapter; retire independent runtime |
| floyd-sandbox | forensic container, not an isolation system | duplicate Go trees: `FloydDeployable` and `floyd-next` | each owns runtime concerns; no VM/mount/secret/idle boundary | Deployable agent/session/DB/MCP/skills/plugins/permission/TUI; next CI/release assets | host env inheritance, bypassable safe-prefix policy, stub workflow executor, divergent duplicates | adopt Deployable as donor; reference next; quarantine container |
| FLOYD WRAPPER | standalone TypeScript GLM agent | Node/TypeScript with Zod tools and stream events | per-workspace SQLite/cache | action/result schemas, registry patterns, browser/checkpoint/UI assets | MCP placeholder, sandbox docs only, masked TypeScript build failures, competing runtime | extract contracts; retire standalone runtime |
| INK SANDBOX | small Ink/React agent prototype | Anthropic-compatible agent, MCP stdio/WS, native framing | per-workspace JSON sessions | theme and native-message framing | no isolation, ineffective `ask`, unauthenticated WS, stale native path/tests | reference/extract small assets; quarantine then retire |
| Live `ff` chain | fantastic active golden runtime | installed Go binary via stable wrapper; module/revision lineage known, source delta unknown | SQLite sessions/messages/files; invocation-persistent, not resident | behavioral compatibility oracle, CLI/TUI experience, data contract | no trustworthy matching source tree; `0644` state; no daemon | preserve untouched; snapshot safely; use for parity oracle |
| Live `superfloyd` chain | user-confirmed good CLI with presentation defect | interactive symlink chain to clean Go build revision `587b0ebb74c7` | multiple possible state roots; invocation-persistent, no current process | second behavioral/CLI oracle | three installations with PATH precedence; ASCII art defect; state ownership unresolved | preserve active path untouched; snapshot and use for parity |
| iPhone-Dispatcher | voice/Shortcuts bridge plus competing services | Python/shell/launchd, Tailscale HTTP, optional ngrok/tmux | global JSON session, transcripts/outbox, multiple jobs/ports | voice normalization, confirmation/policy, transcript evidence, provider adapter | no app auth, global state, powerful autonomous recovery, hard-coded topology, failure storm | extract voice/policy/client; retire services after cutover |
| FloydSkills | Markdown content library, not skill machinery | 57 tracked files; no executable code or `SKILL.md` | none | algorithms/patterns/reasoning/workflow content | inconsistent schemas, missing validators/tests, stale harness assumptions | reference and selectively rewrite into canonical skills |
| TerminalOne | focused mobile/PWA terminal client plus backend | Node/Express/WS/node-pty/xterm/PWA | in-memory PTYs, 512 KB replay, 5-minute grace | mobile keybar/input guard/reconnect/terminal UX | unauthenticated WS/admin, cosmetic PIN, dual launch ownership, 7,756 port conflicts | adopt thin client; extract protocol; retire backend job |
| terminal-control-center | named-agent/PTY cockpit, not Browork engine | FastAPI/Pydantic/Python PTY/xterm/JSON | process registry/state/layouts; restart tied to reconnect | typed agent/LLM contracts, output analyzer, fan-out, layouts | plaintext PIN, broken actions/plists, cwd-dependent state, competing service identities | extract cockpit/contracts; retire services/scheduler |
| MWIDE | strongest mobile IDE/PWA cockpit donor | React/Vite PWA, CodeMirror/xterm, Express/node-pty, isomorphic-git/IndexedDB | browser/virtual persistence; host PTY memory only | responsive IDE, virtual Git, cockpit schemas, editor/terminal/file UX | largely unauthenticated privileged APIs, SSRF/symlink escapes, PAT in browser, auto mutations, env inheritance | adopt UI; quarantine server/execution |
| FloydsLabsStudio | narrow voice-generation prototype | Vite/React, ElevenLabs TTS, Gemini script polish, canvas/MediaRecorder | browser localStorage/object URLs | voice A/B preview, controls, transcript/media UX | client keys, public dev bind, no tests/dist/Git, mislabeled media, no true image/video gen | extract voice UX; retire standalone app |
| deerflow | large broken wrapper around capable nested DeerFlow | Python/LangGraph/FastAPI + Next.js; MCP/ACP; provider sandboxes | SQLite/Postgres checkpointer; memory; background tasks in-memory | middleware, lazy skill loader, sandbox provider, checkpointers, MCP config | invalid gitlink topology, dirty 7.4 GB tree, permissive config modes, no Git worktrees, non-durable jobs | extract selected clean components; never adopt tree wholesale |
| COHORT | real local terminal-control/relay service | TypeScript/Hono/node-pty/SQLite/WS/MCP | durable sessions/history/checkpoints/recordings; PTY/cron maps ephemeral | PTY/state detector, `/api/do`, Relay leases, audit/memory, MCP proxy, TeamDeck UI | broad bearer authority, no sandbox/worktrees, split audit/DB, stale runtime | extract terminal/provider/policy/UI; do not keep daemon |
| FLOYD _THE_AGENCY | offline workflow-blueprint generator | single-file HTML plus partial Python centroid code | localStorage templates only | 12-gate intake, 20 templates, output schema/vocabulary | no executable orchestration/API/tests/auth/MCP; regex parser and prose overclaims | extract WorkflowSpec compiler fixtures; retire runtime claim |
| Floyd_The_ANVIL | policy/metaprompt specification only | tracked Markdown, no code/manifests/tests | none | evidence/heartbeat/idempotency/budget/hard-stop/rollback vocabulary | missing referenced asset, theatrical thought protocol, no mechanism | reference policy vocabulary; retire as runtime |
| Opencode_Customizer | documentation archive, not a fork/runtime | 132 KB, 17 files, no Git/source/manifest/tests/build/release artifacts | none; described Floyd plugin/config paths are absent from current installation | workflow requirements, upstream-minimal-diff rules, verification/rollback language, `AsciiSF.txt` | stale v1.2.x claims, missing files, incompatible/unloaded plugins, SDK/config drift, literal keys and permissive current profile | extract requirements/assets; quarantine claims; retire as active project root |
| FLOYD CODE.app | tiny Terminal launcher, not an OpenCode app | 103-byte Bash/AppleScript launcher to external `~/.local/bin/floyd -y` | owns no contained runtime/state | icon and launch affordance | unsigned/incomplete Info.plist, user/path-specific, external golden binary, no packaged behavior | retire packaging; preserve icon/intent; replace with real client |
| FLOYD CURSE'M.app | branded near-stock VS Code package | VS Code 1.109.3 Electron bundle, shell wrapper, 94 stock Microsoft extensions | standard Code identity/data/update/sync surfaces remain internally | visible multi-agent IDE concept and temporary local sidecar behavior | no source/build tree or Floyd extension; mixed identity, shell failure, Microsoft endpoints, ad-hoc signing/no valid notarization | reference/quarantine; rebuild from pinned source if retained |
| Current upstream OpenCode | mature coding platform and managed engine | 1.17.15 server/SDK/plugin/agent/permission/MCP/LSP/event surfaces | its engine sessions/messages/database only | full coding loop, clients, child sessions, tools, permissions, extensions | not global device/job/artifact/media/tunnel authority; local config/version/secret drift | adopt pinned and upstream-compatible beneath Floyd Core |
| CodeNomad | cockpit baseline | MIT server/SolidJS/Electron/Tauri monorepo around OpenCode | current server can own workspace/auth/process state | desktop/web/mobile/remote, sessions, voice, worktrees, diffs, SideCars | unsigned/self-signed development boundaries; would compete if adopted whole | independently copy; adapt UI/client; subordinate backend authority |
| floydslabs.com | public brand/catalog plus isolated hosted API | Next.js/Vercel-facing site; live health/catalog endpoints report 3 groups/67 tools/73 skill definitions | separate hosted identity/API/logging, not workstation state | ownership story, suite taxonomy, searchable skills, visual/brand language | contradictory counts/statuses; public metrics/catalog; credential-shaped OpenAPI example; shared-password auth; public/runtime coupling | preserve brand; revise truth states; decouple and quarantine auth/runtime from private system |
| LegacyAI-FloydsLabs GitHub org | canonical ownership candidate | unauthenticated GitHub API exposes 10 public, unarchived repositories | GitHub repositories; private inventory not observable unauthenticated | organization boundary, public donors/products, website/control-center provenance | public does not meet the requested private future; missing recognized licenses on several public repos | create new private canonical monorepo; inspect/import donors selectively |

## Live `ff` Launch Chain

```text
interactive zsh PATH
  -> /Users/douglastalley/.local/bin/ff  (symlink)
  -> /usr/local/bin/floyd                (Bash compatibility wrapper)
  -> /opt/homebrew/libexec/floyd-harnesses/floyd-ff-real
  -> default state root /Users/douglastalley/.floyd-ff
```

- Wrapper SHA-256: `cf77333718b53d3e84689caa6087a7de736d4b79e49d4c08dd628b85e91cbf5d`.
- No alias or shell function overrides `ff` in the interactive trace; zsh resolves an external executable.
- The non-interactive lookup failure is explained by PATH initialization, not by a missing installation.
- Installed target fingerprint: `/opt/homebrew/libexec/floyd-harnesses/floyd-ff-real` is a 58,901,762-byte Mach-O arm64 executable with SHA-256 `dcc97eee1bb3b355b3a6ae35278fc6f7ccb51008eba1eb518d76aadf5f2d9e46` and a Go build ID.
- Code-signing state is ad-hoc/linker-signed (`Identifier=a.out`, no Team ID, no sealed resources), appropriate as local dev evidence but not a production desktop distribution boundary.
- Dynamic dependencies are limited to macOS system libraries/frameworks (`libSystem`, `libresolv`, CoreFoundation, Security), consistent with a mostly self-contained Go binary.
- Embedded markers show broad provider/tool functionality (`openai`, `anthropic`, `google`, `vercel`, MCP, SQLite, sessions, tools, LSP, edits), but strings prove inclusion only—not verified behavior or current configuration.

### Live state root

- `/Users/douglastalley/.floyd-ff` exists, is approximately 98 MB, and was modified 2026-07-09.
- The root contains `floyd.db` plus WAL/SHM files, `crush.db` plus WAL/SHM files, JSON logs, an `init` marker, and three Ralph command documents.
- `floyd.db` and `crush.db` are SQLite 3 databases in WAL mode. Read-only `PRAGMA quick_check` returned `ok` for both.
- Both stores expose the same five application tables: `sessions`, `messages`, `files`, `read_files`, and `goose_db_version`, plus 13 indexes. This strongly indicates a legacy-compatible database lineage rather than two unrelated stores.
- `floyd.db` is the current store: 79,106,048 bytes and modified 2026-07-11; `crush.db` is 131,072 bytes and was last modified 2026-05-03. Data contents were not read.
- Logs occupy approximately 18 MB. The state model therefore already includes durable relational data and local operational history.
- The state-root directory is `0755`, and both database files plus WAL/SHM files are `0644`. Because the schema contains sessions/messages, this is a verified local confidentiality weakness: other host accounts can traverse and read the state files.
- The coexistence of `floyd.db` and legacy-named `crush.db` suggests compatibility/migration layering that requires schema and code provenance inspection.

### Current runtime lifecycle

- No process matching `floyd-ff-real`, `/usr/local/bin/floyd`, or `floyd-harness` was running at the observation point.
- No matching TCP listener was present. The live `ff` CLI therefore persists data across invocations but is not itself the requested persistent runtime/daemon today.
- The `sqlite3` process briefly shown by `lsof` was the concurrent read-only inspection command, not FLOYD; it is excluded from runtime evidence.
- Launchd contained several Floyd/Floyd's Labs-named jobs, but none proved ownership of the `ff` state or CLI runtime. Each must be inspected by label before being included in the architecture.

### Installed-source provenance

- `go version -m /opt/homebrew/libexec/floyd-harnesses/floyd-ff-real` identifies module `github.com/legacy-ai/floyd` at pseudo-version `v0.0.0-20260331134101-cd343b1c2708+dirty`, built with Go 1.26.1.
- The v5 backup's `go.mod` declares the same module path, its Git HEAD is `cd343b1c270882c1e505fefd0bd2c0656fb774e6`, and its `VERSION` file says `5.3.0`.
- This proves shared module/revision lineage and a dirty build; it does **not** prove byte identity with the current backup worktree or make that worktree trustworthy.
- None of the candidate Mach-O binaries in the v5 backup matched the installed binary's size or SHA-256.
- User-confirmed truth: the original v5 backup is absolutely corrupted, while the installed runtime reached through `ff` is fantastic.
- Architectural implication: quarantine the backup as forensic evidence. Preserve the installed `ff` artifact and behavior as the golden compatibility oracle, and build the new daemon from independently copied clean donors such as `FloydDeployable`.

## User-Confirmed Source Fitness Boundary

- `/Volumes/Storage/floyd-v5-backup-2026-04-16` is **not a donor**, even though build metadata proves shared lineage.
- `/Users/douglastalley/.local/bin/ff` -> `/usr/local/bin/floyd` -> `floyd-ff-real` is the current **golden behavior path**.
- Never rebuild, replace, relink, or repoint that live path during donor extraction.
- Before future parity testing, independently copy the wrapper/binary and create a consistent SQLite backup into the greenfield intake area; run tests against copies and separate data, not the live state.
- The installed `superfloyd` command is also good and becomes a second golden CLI oracle; only its ASCII-art presentation needs adjustment, in copied/new code rather than the live command.
- FCCLI may become excellent, but it is currently a scaffold without a runtime. Its value is donor architecture and UX, not operational authority.

## Live `superfloyd` Launch Chain

```text
interactive zsh PATH
  -> /Users/douglastalley/.local/bin/superfloyd  (symlink)
  -> /Users/douglastalley/.local/bin/floyd       (symlink target)
  -> /Volumes/applebottom/main-offload/.local/bin/floyd
```

- Active target is a Mach-O arm64 Go binary, built with Go 1.25.5 from module `github.com/legacy-ai/floyd` at revision `587b0ebb74c7a35b711b7ef05f5248513fbedf25`, with `vcs.modified=false`.
- Active-target SHA-256: `99514459711bc61a36c9c3958e9b717d9f940708ab8902ede7ea24e1bb88f671`.
- Two lower-precedence installations exist: `/opt/homebrew/bin/superfloyd` is a Bash wrapper, and `/usr/local/bin/superfloyd` is a different dirty Go build at revision `0e47633937d6`.
- No matching `superfloyd` process was running during observation.
- Candidate state roots `~/.floyd`, `~/.config/floyd`, `~/.local/share/floyd`, and `~/.superfloyd` all exist, but static launcher inspection has not yet proven which store the active binary owns. Do not merge them by name.
- PATH precedence is part of the golden behavior contract. Migration must not accidentally select either lower-precedence installation.
- The ASCII art is a presentation asset to replace in the copied/new thin client. It is not a reason to alter the golden executable.

### `superfloyd` state and presentation evidence

- Embedded schema/help text declares `data_directory` relative to the working directory with default `.floyd`; it also references project `.floyd`, `FLOYD.md`, `~/.config/floyd/skills`, and a hard-coded `/Volumes/Storage/.floyd` marker. State discovery is therefore intentionally/disputably distributed rather than one global authority.
- `~/.floyd` contains a small `floyd.db`, JSON sessions/exports, Floyd/FCCLI logs, and other user state. `~/.local/share/floyd` contains larger `floyd.db`/`crush.db`, provider/project/config files, backups, logs, and tools. `~/.config/floyd` contains a large agent/config catalog. `~/.superfloyd` contains additional config/data JSON.
- Static evidence cannot attribute every root to the active `superfloyd` build without executing it. They must remain separate provenance sources; do not merge by filename.
- `/Users/douglastalley/.local/share/floyd/floyd.db` is mode `0666` (world-readable and world-writable). `/Users/douglastalley/.floyd/floyd.db` is `0644`. These are verified host security failures for session-capable state.
- Embedded `compactLogo`, `sidebarLogo`, `Logo*`, and ASCII markers confirm that the presentation is separable enough to replace in a new client/theme package.

## Additional Source Census

| Component | Size | Git State | Immediate Signal |
|---|---:|---|---|
| iPhone-Dispatcher | 42 MB | clean `main...origin/main` | Sanitized Floyd bridge repository with `Floyd/`, docs, and `floyd-bridge`. |
| FloydSkills | 932 KB | clean `main...origin/main` | Small categorized algorithms/analysis/patterns/reasoning/workflows/mega library. |
| TerminalOne | 75 MB | modified `ci/harden-first-run` | Recent portable/self-healing launcher work; existing task/findings/progress and tests. |
| terminal-control-center | 198 MB | `main`, ahead 5, modified | Python/web terminal control with remote PIN auth, agent/layout state, tests, and local secret files. |
| MWIDE | 287 MB | root Git disabled | Mobile web IDE container with a nested `mobile-web-IDE`. |
| FloydsLabsStudio | 190 MB | no Git root | Vite/TypeScript studio application candidate. |
| deerflow | 7.4 GB | dirty `main`, no upstream shown | Very large orchestration container with nested `deer-flow`, OAuth bridge, migration assets, and harness configuration. |
| COHORT | 809 MB | modified `main...origin/main` | Fleet/relay/menu-bar/UI system with local DB/token and recent lease-expiry work. |
| FLOYD _THE_AGENCY | 620 KB | clean `autonomously-fixed` | Small static/backend agency methodology prototype. |
| Floyd_The_ANVIL | 188 KB | clean `autonomously-fixed` | Small metaprompt specification repository. |

- Total source copying is technically possible with current free space, but `deerflow` dominates at 7.4 GB and likely includes dependencies/artifacts. The donor-first copy rule avoids wasting space and copying irrelevant generated state.
- No copy was created during census; all new source paths remained read-only.

## Architecture Decisions

| Decision | Status | Rationale / Required Evidence |
|---|---|---|
| Floyd Core is the sole durable ecosystem authority; multiple surfaces and supervised workers | selected | Global identity, projects, runs/jobs, skills, memory, artifacts, leases, policy, evidence, and lifecycle require one owner. |
| Current upstream OpenCode is the managed coding engine | selected | Its supported server/SDK/plugin/session/tool platform prevents an unnecessary coding-loop rewrite while leaving workstation-wide authority in Floyd Core. |
| CodeNomad is the cockpit baseline, not a control plane | selected | Its UX directly covers desktop/web/mobile/remote/session/worktree/voice needs; backend state must be adapted beneath Floyd Core. |
| Event- and job-oriented internal contract | selected | Long-running agents, media generation, remote approvals, retries, and restart recovery require durable lifecycle plus idempotency. |
| Local-first system of record with recoverable state | selected | Workstation bedrock requires restart continuity, export/restore, inspectable memory, artifacts, and append-only evidence. |
| Hybrid reasoning plus typed execution | selected | Flexible planning remains compatible with auditable, permissioned, deterministic workstation actions. |
| Versioned on-demand skills over monolithic prompt features | selected | CLI, desktop, browser, mobile, OpenCode, and other harnesses can share tested packages without bulk prompt load. |
| Brand voice as explicit presentation policy | selected | FLOYD identity remains strong without contaminating commands, schemas, evidence, permissions, or failure truth. |
| Isolated lab as supervised provider | selected | VM/container isolation is useful but cannot own global sessions/jobs/state. |
| Connectivity guardian as deterministic state machine | selected | Private-first probes, explicit public fallback, single-flight locking, and bounded recovery prevent duplicate/risky remediation. |
| Public website is a one-way brand/release consumer | selected | A hosted public API/catalog cannot share credentials, sessions, tools, or network reachability with the private workstation. |

## OpenCode Platform Evaluation

### Local verified facts

- Interactive zsh selects `/Users/douglastalley/.opencode/bin/opencode`; `/opt/homebrew/bin/opencode` is a lower-precedence installation.
- Active local version is `1.17.15`; the active arm64 Mach-O hash is `7bdefaeaef5cc4f661988eaba00de047f5f65547fd22a3bed5ba7c4d86a275d3`.
- The CLI exposes a headless server plus `attach`, web client, ACP server, MCP manager, agents, plugins, sessions, import/export, GitHub/PR workflow, model/provider management, statistics, and database tooling.
- Server defaults are loopback (`127.0.0.1`), random port, mDNS off, and no extra CORS domains. `--auto` is explicitly labeled dangerous.
- Local config includes an installed OpenCode package/plugin environment under `~/.config/opencode`; no OpenCode process was running during observation.
- `~/.local/share/opencode` is itself a symlink. This is existing user state topology, not an architecture recommendation; FLOYD integration must discover the real target and preserve it unchanged.

### Opinion and selected boundary

- **Do not build a symlink federation.** It would preserve competing state, permissions, retries, tool schemas, and process lifecycles while hiding the fragmentation.
- **OpenCode is a full coding platform, not merely a CLI.** Its server/client/plugin/SDK/session/permission surfaces should be used directly rather than reimplemented or wrapped as a shell command.
- **OpenCode is not the complete workstation organism.** Its documented contracts do not own global actor/device identity, durable cross-session Browork leases, multimedia artifacts, tunnel policy, or process supervision.
- **Selected split:** new Floyd Core is the sole durable ecosystem authority; a pinned, unmodified upstream OpenCode server is its managed coding engine; a thin stateless Floyd plugin/SDK adapter binds policy, correlation, evidence, and typed provider tools.
- CodeNomad is the cockpit baseline and OpenCode client donor, but its workspace/auth/process state is subordinated to Floyd Core so it cannot become a second backend authority.
- Deep forks remain prohibited unless a written gap test reproduces a required capability that cannot be supplied through supported server, SDK, plugin, or sidecar contracts.

### Official ecosystem and CodeNomad evidence

- The official OpenCode ecosystem page, updated 2026-07-10, exposes SDK, server, plugins, tools, agents, permissions, policies, MCP, ACP, Agent Skills, custom tools, web, IDE, GitHub, and GitLab surfaces.
- The official ecosystem lists community extensions for isolated sandboxes, PTYs, context pruning, lazy skills, background agents, scheduling, structured workflows, worktrees, multi-agent workspaces, and session-scoped goals.
- Officially listed projects include a mobile-first VPN/Tailscale UI, an OpenCode-powered Cowork alternative, several desktop/web clients, and CodeNomad. This is direct evidence that the intended architecture is broader than a terminal CLI.
- Ecosystem inclusion proves extensibility and activity, not security or production fitness. Every adopted extension still requires source and runtime verification.
- CodeNomad is an MIT-licensed OpenCode cockpit monorepo with server, SolidJS UI, Electron app, and experimental Tauri app. GitHub showed 1,289 commits, about 2.2k stars, 160 releases, and listed v0.18.0 dated 2026-06-21.
- Its declared scope overlaps FLOYD directly: multi-instance workspaces, remote access, sessions, voice/speech, Git worktrees, filesystem browsing, authentication, notifications, theming, desktop/web/mobile/remote access, and localhost SideCars.
- CodeNomad's server manages workspaces, proxies OpenCode, and provides API, authentication, and speech. It requires OpenCode on PATH and a first-run password.
- Remote HTTPS uses a generated self-signed certificate by default, and the README documents an unsigned/unnotarized macOS workaround. Those are development/community release boundaries, not the production standard for FLOYD.
- SideCars are useful for TerminalOne/MWIDE integration but must be capability-scoped; FLOYD must not expose an unauthenticated general localhost proxy.
- **Selected architectural bet:** keep OpenCode and CodeNomad upstream-compatible, build Floyd Core explicitly for workstation-wide authority, and use a minimal adapter/plugin rather than duplicating OpenCode's coding loop. The Phase B gap test determines whether any kernel patch is necessary, not whether durable Floyd authority exists.

### Official server and SDK contract evidence

- OpenCode is natively client/server: normal `opencode` starts a TUI plus server, and the TUI talks to the server. `opencode serve` runs the headless HTTP/OpenAPI authority, while clients can attach to it.
- The server publishes OpenAPI 3.1 and exposes global health/events, projects, paths/VCS, instances, configuration/providers, sessions/messages/commands, files, experimental tools, LSP/formatters/MCP, agents, logging, TUI control, authentication, events, and documentation APIs.
- The type-safe JavaScript/TypeScript SDK can either start a server/client pair or connect client-only to an existing instance. Its types are generated from the server OpenAPI specification.
- SDK session APIs include create/list/get/update/delete, child sessions, init, abort, share/unshare, summarize, messages, prompts, commands, shell execution, revert/unrevert, and permission responses.
- The SDK supports JSON-Schema-validated structured model output and an SSE event subscription, and it can drive TUI prompts, sessions, models, themes, commands, and toasts.
- This platform owns most of the proposed coding-engine surface. Rebuilding its model/session/tool loop would be unnecessary duplication; using it as the global device/job/artifact/media authority would exceed the documented boundary.
- OpenCode server authentication is HTTP Basic auth from environment-configured username/password. That is sufficient for a local protected service but not the final device/user/capability model for mobile, browser, SideCars, or privileged workstation actions.
- OpenCode can intentionally start multiple servers. FLOYD therefore needs one supervised instance registry/launch policy so `ff`, CodeNomad, CURSE'M, mobile, and plugins attach to the same authority rather than silently creating new ones.

### Official plugin, permission, agent, and skill evidence

- OpenCode plugins are JavaScript/TypeScript modules loaded from global/project config and plugin directories; all hooks run sequentially in a defined load order.
- Plugin hooks include before/after tool execution plus session, todo, shell environment, TUI, and general event handling. Official examples demonstrate environment-file blocking, notifications, custom tools, logging, environment injection, and compaction hooks.
- Plugins receive project/client/directory/worktree context. This is a viable first-party home for Floyd policy, evidence capture, compatibility, media/job submission, and brand/context integration without a kernel fork.
- Local plugin dependencies can trigger `bun install` during startup. A Floyd distribution must pin dependencies/lockfiles, verify digests, and avoid uncontrolled network-time installation in the privileged workstation runtime.
- Permissions support `allow`, `ask`, and `deny`, granular wildcard rules by tool input, external-directory policy, and per-agent overrides. Approval can be one-time, session-pattern “always,” or reject.
- Stock defaults are permissive: most permissions allow, while doom-loop/external-directory ask and `.env` reads deny. `--auto` approves everything not explicitly denied. FLOYD must ship a stricter profile and never treat `--auto` as a safe operator default.
- OpenCode agents support primary/subagent/all modes, hidden programmatic subagents, Task allow/ask/deny rules, per-agent permissions, and step limits. This covers agent selection and delegation, but not by itself durable Browork leases, restart recovery, worktree ownership, or artifact authority.
- Users can manually invoke subagents even when another agent's Task rules would deny dispatch. Floyd's device/capability policy must sit below UI affordances and bind actor identity mechanically.
- OpenCode already discovers `SKILL.md` packages from `.opencode/skills`, `.claude/skills`, and `.agents/skills` at project and global scope. This aligns with the user's existing skill estate and avoids inventing another discovery tree.
- The reviewed Agent Skills page did not expose enforced version/digest/compatibility/tool-permission semantics. Floyd still needs a signed/versioned catalog and conformance tests above discovery.

Architectural decision:

- Use Floyd Core as the global durable authority for identity, projects, sessions, runs/jobs, agents, skills, memory, artifacts, leases, providers, evidence, devices, and recovery.
- Use stock/pinned OpenCode server as the managed coding-engine authority for coding conversations, child sessions, model turns, tools, LSP/MCP, diffs, and engine-local events.
- Use a stateless first-party Floyd plugin/SDK adapter for policy, typed evidence, correlation, provider/job submission, and context/brand behavior.
- Use a CodeNomad-derived cockpit and an IDE extension as clients of Floyd Core/OpenCode; treat CURSE'M only as behavior/reference evidence.
- Do not deep-fork OpenCode unless a written gap test proves a required hook cannot be supplied upstream or through a stateless adapter/provider.

External research sources reviewed as data:

- `https://opencode.ai/docs/sdk/`
- `https://opencode.ai/docs/server/`
- `https://opencode.ai/docs/plugins/`
- `https://opencode.ai/docs/permissions/`
- `https://opencode.ai/docs/agents/`
- `https://opencode.ai/docs/skills/`

External research sources reviewed as data:

- `https://opencode.ai/docs/ecosystem#plugins`
- `https://github.com/NeuralNomadsAI/CodeNomad`

### Rendered Browser verification

- The in-app browser visibly rendered the OpenCode Ecosystem page at the `Plugins` section with the expected `Plugins`, `Projects`, and `Agents` navigation and live plugin rows including isolated sandbox and devcontainer integrations.
- The rendered OpenCode documentation navigation visibly includes Web, IDE, GitHub/GitLab, Tools, Agents, Permissions, Policies, MCP, ACP, Agent Skills, SDK, Server, and Plugins. This supports platform breadth independently of the CLI help output.
- The rendered CodeNomad GitHub page visibly shows the public MIT repository, dev branch, roughly 1,290 commits, 2.2k stars, about 145 forks, 160 releases, and v0.18.0 as latest at observation time.
- The visible README feature list includes multi-instance workspace, remote access, session management, voice/speech, Git worktrees, rich messages, SideCars, command palette, filesystem browser, authentication/security, notifications, theming, and internationalization.
- Rendered proof confirms product positioning and visible documentation, not runtime correctness or security. Source and local-copy audits remain required before adoption.

### Native app visibility check

- Computer Use could not resolve `/Applications/FLOYD CODE.app` by path, and its registered-app inventory exposed no FLOYD CODE entry. Nothing was launched; static bundle inspection remains the source of truth until its bundle identity/completeness is known.
- The registered-app inventory did expose `com.floyd.curse-m` / `FLOYD CURSE'M`, currently not running. A read-only UI observation by bundle ID is the next safe step.
- Computer Use launched CURSE'M only for observation, then returned it to its original not-running state. No click, text entry, setting change, file operation, or source modification occurred.
- The rendered native window is a VS Code-derived workbench, not merely a themed mockup. Visible surfaces included Explorer, Search, Source Control, Run/Debug, Remote Explorer, Extensions, Testing, Project Manager, Claude Code, Codex, agent session history, agent/model/tool selectors, context attachments, and Git/editor status.
- The current UI displayed historical Codex sessions and a functional-looking agent cockpit, but also a live notification: `Unable to resolve your shell environment: Unexpected exit code from spawned shell (code 2, signal null)`.
- Architectural implication: CURSE'M is a serious editor/cockpit donor and possible FLOYD-branded IDE client. It is not current runtime-health proof, and its shell/runtime integration must be replaced by or adapted to the selected OpenCode platform authority.

### Historical lineage supplied by Douglas

- Douglas's statement is verified with high confidence: the good Go FLOYD surfaces descend from CRUSH, and CRUSH preserves the archived Go OpenCode lineage. They do **not** descend from today's TypeScript `anomalyco/opencode` tree.
- Installed `ff` and the active `superfloyd`/`floyd` builds report module `github.com/legacy-ai/floyd` in Go build metadata.
- The available FLOYD Git history starts as a Douglas-authored squashed baseline, so upstream parents were discarded. Nevertheless, its root tree shares 748 same paths and 489 byte-identical same-path blobs with CRUSH commit `c2b8661` from the adjacent release.
- Official CRUSH and archived Go OpenCode repositories resolve identical historical commit SHA `f0571f5f5adef12eba9ddf6d07223a043d63dca8`, which proves shared Git ancestry.
- This explains recurring OpenCode/CRUSH database and command concepts, but it does not imply source or storage compatibility with current OpenCode 1.17.15.
- Architectural consequence: preserve the Go CLIs as behavioral clients/oracles while using explicit contracts and migrations around the modern upstream OpenCode engine—never filesystem links or a resurrection of the corrupt tree.

### OpenCode customizer audit

- `/Volumes/Storage/Opencode_Customizer` is a 132 KB, 17-file documentation archive with no Git metadata, source code, manifests, tests, CI, build scripts, or release artifacts.
- Its documentation describes historical OpenCode 1.2.x customizations, but the current installed binary is 1.17.15 and the claimed Floyd plugin, system prompt, provider, MCP, skill, and agent paths are absent.
- Current plugin/package evidence is drifted across 1.15.5, 1.4.0, 1.3.2, and older document claims; one global plugin shape is statically incompatible with the current documented function-export loader.
- The current config has no explicit permission profile and contains literal nonempty API-key fields in a `0644` file. Secret values were not printed.
- Disposition: preserve requirements, deterministic workflow/verification/rollback language, and `AsciiSF.txt`; retire the folder as a runtime/source root and build a tested upstream overlay in the canonical repo.

### Public website truth and trust boundary

- `floydslabs.com` strongly captures the ownership/anti-subscription brand and the desired suite taxonomy: CLI, Desktop, IDE, MCP, Skills, Memory, and Orchestrator.
- Published counts conflict: the home/apps/about/connect surfaces alternate among 13 or 3 MCP servers and 73+ or 105+ skills, while application cards mark several unverified prototypes as available.
- Read-only live checks returned HTTP 200 from `/api/mcp/health`: version 1.0.0, three server groups, and 19 + 22 + 26 = 67 tool descriptors. `/api/mcp/skills` returned 73 definitions; 39 carry a non-null server and 34 do not.
- `/api/mcp/skills` and `/api/mcp/metrics` are publicly reachable. The public OpenAPI 3.0 document declares bearer auth but contains a 15-character credential-shaped shared-password example at the login schema. The value was redacted and was not tested.
- Immediate recommendation: remove the example, rotate any corresponding real credential, replace shared-password auth, decide which catalog data is intentionally public, protect metrics, and correct wildcard/public API policy.
- The website becomes a one-way consumer of a sanitized signed release manifest. It never becomes an ingress route or identity issuer for the private workstation.

### GitHub organization and provenance boundary

- GitHub's unauthenticated API exposed 10 public, unarchived repositories under `LegacyAI-FloydsLabs` at inspection time. This proves public state only; it does not prove whether private repositories exist.
- `control-center`, `aterm`, `Legacy_Oracle`, `zai-tui`, `supercache`, `FloydTheWebsite`, and other public projects overlap possible donors/consumers, but metadata overlap is not code-adoption evidence.
- `CaptainPhantasy/floyd-wrapper` and `CaptainPhantasy/floyd-v5` are publicly visible, unarchived provenance backups. Public history remains exposed even if visibility later changes.
- Selected ownership: create a new private `LegacyAI-FloydsLabs/floyd` canonical monorepo; preserve/mirror before any later visibility/archive decisions; do not rewrite or delete backups during migration.

### Model capacity and subscription routing

- Douglas states that local RAM/VRAM supports only tiny models. The architecture must not depend on local heavyweight coding, reasoning, or media inference.
- Active OpenCode 1.17.15 currently defaults to `zai-coding-plan/glm-4.6` with `zai-coding-plan/glm-4.5-air` as the small model.
- `opencode auth list --pure` exposed credential labels for `Z.AI Coding Plan`, `MiniMax Token Plan (minimaxi.com)`, and Mistral; no values were read. Labels prove stored provider records, not current entitlement or quota.
- No standalone `glm`, `zai-cli`, `minimax`, `minimax-code`, or `mmx` executable was found. The shell command `zai` is only a `cd` alias to a local project.
- The existing OMP broker is healthy and its catalog includes Z.AI/Zhipu plan routes plus MiniMax international and China routes. Its current live role assignments use Z.AI/Zhipu for several roles but do not route a role to MiniMax.
- The observed MiniMax credential label uses the China-domain `minimaxi.com`; the correct `minimax-code-cn` versus international adapter must be confirmed without a billed model call.
- Official provider behavior distinguishes subscription/token-plan credentials from pay-as-you-go credentials. Selected policy: record billing mode per provider profile, never interchange plan/PAYG keys, and never silently fall back into metered balance usage.

### Private/team delivery implications

- Remote Git repositories `CaptainPhantasy/floyd-wrapper` and `CaptainPhantasy/floyd-v5` are backup/provenance surfaces, not automatic canonical donors.
- The corrupted-v5 quarantine applies to its remote history unless Douglas identifies a specific known-good commit and it passes independent comparison/tests.
- Private use supports a focused Floyd distribution without public-market compatibility or hosted SaaS requirements, but Git/workstation/model credentials make least privilege and signed/reproducible artifacts more—not less—important.
- Target repository layout should preserve upstream OpenCode/CodeNomad mergeability in private forks/mirrors and keep Floyd plugins/services/donor imports in a private integration repository.
- Public OpenCode sharing and public tool/MCP endpoints should be disabled by policy. Team access uses private networking and device-scoped credentials.

## Audit Coordination

- Three agents cover disjoint component groups and are explicitly forbidden from writing source or planning files.
- The primary orchestrator is the sole planning-file writer and decision owner.
- The live `ff` trace is the only intentional overlap, providing independent verification of the most migration-sensitive path.

## Open Proof Gaps

- No new Floyd Core, adapter/plugin, Cockpit, provider, or canonical repository has been implemented; the blueprint is a plan, not shipped runtime proof.
- OpenCode's official seam still needs the Phase B spike: session/event correlation, permission preflight, crash recovery, idempotency, and CodeNomad adaptation must pass locally before any cutover.
- Exact import/mapping rules across golden `~/.floyd*` stores remain intentionally untested against live data. They require supported backups, copies, redacted fixtures, and parity tests.
- Multimedia donor UIs exist, but no end-to-end image/video/audio/document pipeline has been verified as the new durable provider/artifact flow.
- Browork leases, worktree isolation, merge/review gates, and restart recovery are specified but unimplemented.
- The VibeBox/lab executable, VM lifecycle, mounts, network, secrets, persistence, and idle behavior remain unverified; the old skill wiring is stale.
- The current private route, device pairing, tunnel policy flag, and notification/outbox implementation remain unverified; the old HTTP bridge is inactive.
- Public-site credential rotation/auth/CORS/metrics remediation has not been performed; it requires explicit operational authority and separate verification.
- Existing public organization repositories need code-level donor audits before import; only metadata/README roles were classified in this pass.
- GLM and MiniMax subscription integration must be verified through their supported local/provider login paths; a subscription must never be assumed to include separately metered API calls.

## Issues Encountered

| Issue | Resolution |
|---|---|
| A new `/goal` could not be created because the user’s goal was already active | Continued under the existing active goal after verifying its objective. |
| `ff` did not resolve in the Codex tool shell | Resolved by switching to interactive zsh; live chain begins at `~/.local/bin/ff` and is now documented. |
| Two composed inspection commands were rejected before shell execution by JavaScript template parsing | Removed brace-form shell expansions from composed command strings; the revised process/database inspection executed successfully. |
| Two broad findings normalization patches failed atomic verification as the evidence file evolved | Switched to small component-matrix, lane-detail, and progress patches; failures made no partial writes. |
| Desktop auditor initially passed a literal `--data-dir/floyd.db` path to Git as an option | Auditor corrected the read-only command using `--`; corrected command exited `0`. |
| CURSE'M screenshot helper referenced an import that had not initialized after the prior FLOYD CODE target failure | Re-read current app state with fresh module bindings; captured accessibility/rendered evidence, then closed the app successfully. |
| Web safety filtering refused direct opens of three Floyd Labs API URLs | Used bounded read-only `curl` requests instead; health/catalog checks completed without authentication or tool execution. |
| Public OpenAPI inspection exposed a credential-shaped example | Redacted the value, inspected only its path/type/length, did not authenticate, and elevated removal/rotation as an urgent follow-on boundary. |

## Resources

- Planning skill: `/Users/douglastalley/.agents/skills/planning-with-files/SKILL.md`
- Source paths: see `task_plan.md` Named Source Scope.
- Official blueprint: `/Users/douglastalley/Documents/Floyd_EcoSystem/FLOYD_ECOSYSTEM_BLUEPRINT.md`
- Current OpenCode contracts: `https://opencode.ai/docs/server/`, `https://opencode.ai/docs/sdk/`, `https://opencode.ai/docs/plugins/`, `https://opencode.ai/docs/permissions/`, `https://opencode.ai/docs/agents/`, `https://opencode.ai/docs/skills/`.
- Cockpit baseline: `https://github.com/NeuralNomadsAI/CodeNomad`.
- Public brand/API boundary: `https://www.floydslabs.com/`.
- Organization boundary: `https://github.com/LegacyAI-FloydsLabs`.
- Provider billing semantics: `https://docs.z.ai/devpack/faq`, `https://docs.z.ai/devpack/usage-policy`, `https://platform.minimax.io/docs/token-plan/quickstart`, `https://platform.minimax.io/docs/token-plan/faq`.

## Implementation Session 2026-07-11 — Environment Facts (all [EXECUTED]/[OBSERVED] this session)

- **PATH footgun:** `/opt/homebrew/bin/opencode` is a symlink to `~/.opencode/bin/opencode-superfloyd` (reports "SuperFloyd v1.0"). Interactive zsh resolves `~/.opencode/bin/opencode` (1.17.15) first, non-interactive shells resolve the SuperFloyd binary. Floyd Core MUST spawn OpenCode by absolute path `/Users/douglastalley/.opencode/bin/opencode`.
- **Upstream pin:** OpenCode 1.17.15, sha256 `7bdefaeaef5cc4f661988eaba00de047f5f65547fd22a3bed5ba7c4d86a275d3`.
- **Isolation verified:** with `XDG_DATA_HOME/XDG_CONFIG_HOME/XDG_CACHE_HOME/XDG_STATE_HOME` + `OPENCODE_CONFIG` pointed under `/Volumes/Storage/FLOYD_RUNTIME/engines/opencode/`, `opencode serve --pure` wrote only Floyd-owned paths; global `~/.local/share/opencode/{opencode.db,auth.json}` mtimes unchanged.
- **Server API (from live /doc):** `POST /api/session {location:{directory}}` binds a session to a directory (worktree lease seam); `POST /api/session/{id}/prompt {prompt:{text},delivery:steer|queue}`; `GET /api/session/{id}/wait`; permission requests replied via `POST /api/session/{id}/permission/{requestID}/reply {reply}`; SSE at `/event`. `disabled_providers:["opencode"]` removes the unapproved bundled provider (verified: only `zai-coding-plan` remains). `permission:{edit:ask,bash:ask,webfetch:ask}` honored (verified via /config).
- **Env vars honored by 1.17.15 binary:** `OPENCODE_CONFIG`, `OPENCODE_CONFIG_DIR`, `OPENCODE_AUTH_CONTENT`, `OPENCODE_SERVER_USERNAME/PASSWORD`, `OPENCODE_DISABLE_AUTOUPDATE`, `OPENCODE_PERMISSION`, XDG overrides.
- **Credential broker:** `omp auth-broker` (v16.3.6) serves at `http://127.0.0.1:17384`; provider id `zai` = "Z.AI (GLM Coding Plan)"; `omp auth-broker token zai` exits 0 (token never displayed). Floyd Core fetches this in-process at engine spawn; interim `/Volumes/Storage/FLOYD_RUNTIME/secrets/glm.env` deleted.
- **User global opencode.json embeds the GLM key in plaintext** at `~/.config/opencode/opencode.json` (also inside four MCP server blocks). Hardening follow-on, not touched this session.
- **MiniMax region answered:** auth label `minimax-cn-coding-plan` exists in global opencode auth.json → China-domain plan. Out of golden-path scope.
- **Runtimes:** Node v26.0.0, pnpm 10.25.0 at /opt/homebrew/bin. `/Volumes/Storage/FLOYD_RUNTIME` exists, 0700, douglastalley.

## OpenCode 1.17.15 seam facts (live-verified 2026-07-12, see ADR-001)

- All JSON endpoints wrap payloads in `{data:...}`.
- `POST /api/session/{id}/wait` → 503 "not available yet" in this build; idle detection = completed-assistant + no pending permissions + 3 stable polls.
- Model availability = **integration connection**, not config apiKey / PUT /auth. `zai*` integrations connect via `ZHIPU_API_KEY` env. Without it: `ModelUnavailableError` on every turn.
- GLM Coding Plan live catalog: glm-4.7, glm-5.1, glm-5.2, glm-5v-turbo, glm-5-turbo, glm-4.5-air. **glm-4.6 no longer exists** — blueprint and Douglas's global opencode config both stale on this.
- `omp auth-broker token zai` → HTTP 401 at api.z.ai coding endpoint; user's config key → HTTP 200. Core validates broker-first, falls back with evidence, fails closed otherwise.
- Session recovery contract implemented: reattach + observe if an assistant turn exists; set model + re-prompt (evidenced) when the action never started.
