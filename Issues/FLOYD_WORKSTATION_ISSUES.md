# FLOYD_WORKSTATION Issues

Initialized: 2026-07-11T22:59:28-04:00

## Open Issues

No open issues remain from this intake as of 2026-07-15.

## Resolved Issues

- **NODE-RUNTIME-001 — RESOLVED:** The live runtime is Node `v26.5.0`, which
  satisfies `engines.node >=26`. `pnpm typecheck` and the complete `pnpm test`
  run pass on that runtime (153/153 tests).
- **SURFACE-INTEGRATION-001 — RESOLVED/SUPERSEDED:** The active scope was
  explicitly narrowed to Desktop, IDE, TUI, PTY, and Launcher before donor
  mutation. Each active surface is an independent clean copy, is pinned to a
  verified integration commit, and connects through `@floyd/sdk`; `pnpm
  verify:surfaces` reports `ACTIVE_SURFACES PASS`. ADK and mobile remain clean,
  untouched intake evidence and are not falsely represented as admitted
  runtime surfaces.
- **MOBILE-SOURCE-001 — CLOSED AS A PROVENANCE BOUNDARY:** The clean
  remote-derived The_Burner intake is present at commit
  `f1da3eb9a43a96a6612c2ac6d760e42db99befd4`. Unpushed local-only history that
  was never found cannot be reconstructed; no active-surface deliverable
  depends on it.
- **AUTOSTART-001 — RESOLVED:** `com.floyd.core` is installed at
  `~/Library/LaunchAgents/com.floyd.core.plist` with mode `0600`, is enabled,
  `KeepAlive`, and `RunAtLoad`, and owns the live Core plus managed OpenCode
  child. `pnpm core:install` now provides a repeatable, health-gated reload.
  Reboot proof remains the separate manual release-checklist gate.
- **BROWSER-AUTH-001 — RESOLVED:** The Cockpit no longer writes the gateway
  token to `sessionStorage` or `localStorage`. It exchanges the cleared URL
  fragment bootstrap for a random eight-hour HttpOnly `SameSite=Strict`
  loopback cookie. Core stores only a SHA-256 digest in memory, rejects hostile
  Host and Origin values, requires exact same-origin mutations, supports
  explicit revocation, and invalidates all local browser sessions on restart.
  The bootstrap must never be passed in a process command line.
