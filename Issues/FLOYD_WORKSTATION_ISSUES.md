# FLOYD_WORKSTATION Issues

Initialized: 2026-07-11T22:59:28-04:00

## Open Issues

- **NODE-RUNTIME-001:** The workspace requires Node `>=26`, but the live host currently runs Node `22.18.0`. Typecheck and tests pass on Node 22, but runtime support is outside the declared contract until Node 26 is installed and the full verification suite is rerun.
- **SURFACE-INTEGRATION-001:** Desktop, IDE, TUI, PTY, launcher, ADK, and mobile sources are inventoried in `ecosystem/surfaces.json` but have not yet been admitted as independent copies or migrated to `@floyd/sdk`.
- **MOBILE-SOURCE-001:** No pre-existing local The_Burner donor was found. A clean remote-derived intake copy now exists at `intake/surfaces/mobile` (`f1da3eb`), so any local-only mobile changes that were never pushed remain unavailable.
- **AUTOSTART-001:** `com.floyd.core` launchd service is not provisioned; live Core/OpenCode startup currently requires an explicit command.
- **BROWSER-AUTH-001:** API query-token authentication has been removed. The Cockpit now accepts only a one-time URL fragment bootstrap (fragments are not sent to Core) and immediately moves it to `sessionStorage`. Native-shell secure-storage injection or an HttpOnly loopback session is still required before packaging; never pass even the fragment bootstrap through a process command line.
