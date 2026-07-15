# ADR-002: Golden-path scoping decisions (2026-07-12)

## Status

Accepted.

## Decisions

1. **Zero-dependency runtime.** Node 26 executes erasable-syntax TypeScript
   natively and ships `node:sqlite`. Floyd Core, contracts, and CLI run with no
   runtime npm dependencies and no build step; `typescript`/`@types/node` are
   dev-only for `tsc -b`. Fewer moving parts, deterministic startup, no native
   module compilation. Revisit only if a package materially wins.
2. **Floyd OpenCode plugin deferred.** The handoff lists a stateless plugin; the
   golden path runs `--pure` with permission gating done server-side by Floyd
   Core (poll pending permission requests → decide by AgentSpec policy → reply
   via REST → PolicyDecision evidence). Correlation IDs live in Floyd Core's
   engine-session mapping. The plugin remains the right place for richer
   tool-call metadata once it can be audited and tested; nothing in the current
   seam blocks adding it.
3. **Cockpit is a minimal first-party web client, CodeNomad adoption deferred.**
   The cockpit at `apps/cockpit` is served by Floyd Core itself and reads the
   same gateway API/SSE the CLI uses — same project/session/run/artifact IDs,
   satisfying the dual-surface golden-path requirement without a second control
   plane. Adopting a pinned CodeNomad copy stays on the roadmap (blueprint
   Phase B/C) and plugs into the same gateway.
4. **Engine PATH hygiene.** `/opt/homebrew/bin/opencode` pointed at a SuperFloyd
   binary until Douglas authorized repointing it to real 1.17.15 this session.
   Floyd Core still never resolves the engine via PATH: absolute path from
   `upstream.lock` plus sha256 verification before every spawn.
5. **Gateway auth.** Loopback bind plus a generated 0600 bearer token under
   `FLOYD_RUNTIME/core/gateway.token`. Not a provider key. Device-scoped tokens
   arrive with the remote/mobile phase.

### 2026-07-15 authentication addendum

The bearer remains the native/server-side credential. The local Cockpit now
exchanges its fragment bootstrap for a bounded, in-memory, digest-at-rest
HttpOnly loopback session and removes the JavaScript-readable credential.
Cookie mutations require the exact loopback Origin and same-origin fetch
context; non-loopback Host headers fail closed. This supersedes any earlier
Cockpit guidance that retained the gateway token in `sessionStorage`.
