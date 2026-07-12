# FLOYD Workstation Repository Contract

## Mission

Build one private, persistent FLOYD workstation: coding, Browork, terminal, Git,
browser, mobile/SSH, multimedia, skills, memory, agents, and artifacts over one
durable authority.

## Fixed decisions

- Source/control hub: `/Volumes/Storage/FLOYD_WORKSTATION`.
- Runtime/media hub: `/Volumes/Storage/FLOYD_RUNTIME`.
- Floyd Core is the sole durable ecosystem authority.
- Upstream OpenCode is the managed coding engine, never a deep fork by default.
- CodeNomad is the cockpit baseline, not a second backend authority.
- `ff` and `superfloyd` are untouched behavioral oracles.
- The v5 backup is corrupted forensic lineage, never a code donor.
- GLM Coding Plan is the initial coding route; MiniMax Token Plan is an explicit
  alternate after region/entitlement discovery. No silent PAYG fallback.

## Non-negotiable protection

- Never edit, move, clean, reset, install into, or execute migrations against
  any legacy donor directory.
- Any donor use starts with a verified independent copy. Never use hardlinks or
  writable symlinks into legacy paths.
- Never expose OpenCode, Floyd Core, browser control, MCP, shell, Git, or media
  providers publicly. Tailscale/private routes only; public tunnels are explicit
  break-glass work.

## Authoritative planning documents

1. `FABLE5_HANDOFF.md` — immediate implementation mission.
2. `FLOYD_ECOSYSTEM_BLUEPRINT.md` — selected architecture and roadmap.
3. `findings.md` — evidence and donor dispositions.
4. `task_plan.md` — constraints and acceptance gates.
5. `progress.md` — evidence log and continuation status.

## Truth protocol

Label work as proposed, implemented, or runtime-verified. A test must show real
command output before claiming pass. Every implementation turn ends with exact
changes, commands, output, verification, and remaining work.
