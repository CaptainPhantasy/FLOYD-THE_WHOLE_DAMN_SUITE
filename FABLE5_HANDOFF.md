# Fable 5 — Principal Engineer Handoff: Build FLOYD as One Operating Environment

## Mandate

Do not create another agent scaffold, dashboard mockup, or half-working Copilot
clone. Build the production-shaped **FLOYD operating environment**: one private,
persistent runtime joining coding, terminal, Git, agents, skills, memory,
projects, artifacts, and every future surface.

Treat the audit documents as evidence, not scripture. Preserve their hard facts
and protection boundaries. Correct any design that creates a second control
plane, a fake feature, an unauthenticated bridge, a public workstation endpoint,
or split/recoverless state. Record the correction as an ADR and continue.

## Exact roots

```text
Source/control: /Volumes/Storage/FLOYD_WORKSTATION
Runtime/media:  /Volumes/Storage/FLOYD_RUNTIME
```

The source root is a new local Git repository with no remote yet. Runtime state
never enters Git. Legacy folders are immutable donors only; never edit, move,
reset, clean, install into, or point a migration at them.

## Read in order

1. `FLOYD.md`
2. `FLOYD_ECOSYSTEM_BLUEPRINT.md`
3. `findings.md`
4. `task_plan.md`
5. `progress.md`

Inspect the current local environment before coding. Do not repeat the legacy
audit except where a claim matters to a concrete implementation decision.

## Fixed architecture

```text
Surfaces: CLI · Cockpit · IDE · Terminal · Mobile · Browser · SSH
                         │
Floyd Core: sole durable authority
  projects · identity · sessions · memory · skills · agents · jobs
  worktree leases · artifacts · providers · evidence · health/recovery
                         │
Managed upstream OpenCode: coding session · model turn · tools · LSP
  formatter · engine MCP · child coding sessions
```

OpenCode is not a wrapped CLI. Use its server, SDK, sessions, events,
permissions, agents, tools, and plugin contract. Floyd Core is not a competing
coding loop; it is the durable workstation authority OpenCode does not provide.

## Definition of a valid first release

Do **not** call a database plus `/health` a release. The first release is valid
only when this golden path works against one real scratch project:

1. Start one Floyd Core instance and one managed OpenCode instance.
2. Attach both the Floyd CLI and a real Cockpit surface to the same project and
   session identity.
3. Submit a coding task through the approved GLM Coding Plan route.
4. OpenCode performs a scoped coding action in a Floyd-leased Git worktree;
   terminal output, diff, test result, and evidence appear on both surfaces.
5. A reviewer agent uses a separate worktree/session or consumes the diff under
   an explicit AgentSpec; it never shares the builder's mutable worktree.
6. Core persists project, session, run, agent execution, route receipt, diff,
   test evidence, memory item, and artifact reference.
7. Restart Core and OpenCode. Reattach from both surfaces and retrieve the same
   durable state without duplicating the coding action.
8. The user accepts, rejects, or escalates the Git change. Nothing merges or
   pushes automatically.

This is a thin but complete operating path, not a narrow prototype. Every
later surface plugs into these same identities, events, policies, artifacts,
and leases. A capability without provider proof remains visibly unavailable;
it is never rendered as working.

## Build order — execute, do not mock

### 1. Production-shaped foundation

- Use TypeScript with the installed Node and pnpm only after checking
  compatibility. Do not install a global runtime.
- Create a workspace with clear `core`, `contracts`, `opencode`, `providers`,
  `cli`, `cockpit`, and test modules. Avoid a package graveyard.
- Use runtime SQLite and content-addressed artifact storage only under
  `/Volumes/Storage/FLOYD_RUNTIME`, with ownership/mode checks on startup.
- Define typed `ActionRequest`, `ActionObservation`, `Run`, `Job`, `Lease`,
  `Artifact`, `EvidenceEvent`, `AgentSpec`, `SkillVersion`, and
  `ProviderProfile` contracts before adding providers.
- Implement append-only event/outbox records and idempotency keys before any
  external side effect.

### 2. Real OpenCode integration

- Pin the observed local OpenCode `1.17.15` by version and hash in
  `upstream.lock`; do not alter its global install or global state.
- Run OpenCode as a managed loopback child with isolated Floyd-owned config and
  data paths. Use `--pure` until the Floyd plugin is tested.
- Use the supported server/SDK interface; never scrape the TUI.
- Implement a minimal stateless Floyd adapter/plugin carrying project, run,
  actor, worktree, and correlation IDs; it gates sensitive tools and emits
  normalized evidence.
- No `--auto`; permissions begin strict and explicit.

### 3. Complete the first actual capability stack

- **Project/Git:** register a project, allocate a worktree lease, show diff and
  test result, and require an explicit merge/reject action.
- **Terminal:** provide one scoped PTY provider with durable transcript/evidence
  references; no unauthenticated WebSocket or arbitrary host-shell proxy.
- **Agents/Browork:** implement builder and reviewer AgentSpecs with separate
  worktree/session authority and a review gate.
- **Skills:** build a versioned registry with at least two audited, tested,
  permissioned skill packages—not decorative titles.
- **Memory:** store source-attributed project/session memory and reveal why it
  was retrieved; never silently import legacy databases.
- **Artifacts:** content-address patch/test transcript and generated output;
  expose the same artifact IDs in CLI and Cockpit.
- **Cockpit:** attach a real CodeNomad-derived or equivalent client to the same
  Floyd/OpenCode state. Do not build an isolated dashboard.

### 4. Future surfaces are contracts now, not fake modules

- Register Browser, Mobile, Voice, SSH, Media, and Lab as capability-provider
  interfaces with health, permission, artifact, and evidence contracts.
- Do not mark any available until its real provider passes an end-to-end test.
- The UI may show unavailable capabilities only with their exact blocker.

## Model and cost policy

- Use GLM Coding Plan as the first actual coding route through its supported
  OpenCode provider. Emit a route receipt with provider, model, subscription
  class, project, run, and time—never a credential.
- MiniMax Token Plan is an explicit alternate/reviewer route only after
  determining whether Douglas's plan is global or China-domain and proving the
  correct provider path. Never guess or replace it with PAYG.
- Local models are utility-only. Do not build around unavailable heavyweight
  local inference.
- Anthropic, OpenCode-Go, Mistral, and PAYG providers are disabled by default;
  no silent fallback and no surprise charge.

## Hard stops

- No legacy mutations, symlinks, hardlinks, or in-place migrations.
- No public endpoint, public MCP, ngrok route, remote repository, GitHub
  visibility change, or credential rotation without Douglas's direct authority.
- GLM Coding Plan is the approved model route for this golden path. Before its
  first call, record the route receipt in evidence; every other provider route
  remains a hard stop until explicitly approved.
- No fake health checks, empty skills, placeholder agents, or mock media cards
  presented as capabilities.
- No completion claim without actual command output and cross-surface proof.

## Required handback evidence

```text
1. Tree of real implementation modules.
2. Dependency lockfile and upstream.lock with OpenCode version/hash.
3. Core and OpenCode process topology.
4. Real trace: prompt -> action -> terminal -> diff -> test -> review -> decision.
5. CLI and Cockpit proof of the same project/session/run/artifact IDs.
6. Restart proof with no duplicate action.
7. Worktree lease proof: builder and reviewer cannot race a mutable tree.
8. Provider route receipt and proof of no unapproved fallback.
9. Tests, build output, and evidence ledger.
10. Blunt list of anything still unavailable, with no marketing language.
```

## Delivery rule

Continue until the golden path is real. If time ends before all ten proofs,
leave a runnable, tested repository and report the exact next unblocked
operation. Do not hand Douglas a disconnected scaffold.
