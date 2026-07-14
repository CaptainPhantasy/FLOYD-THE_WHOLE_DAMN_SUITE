# FLOYD_WORKSTATION Issues

Initialized: 2026-07-11T22:59:28-04:00

## Open Issues

- **NODE-RUNTIME-001:** The workspace requires Node `>=26`, but the live host currently runs Node `22.18.0`. Typecheck and tests pass on Node 22, but runtime support is outside the declared contract until Node 26 is installed and the full verification suite is rerun.
- **SURFACE-INTEGRATION-001:** Desktop, IDE, TUI, PTY, launcher, ADK, and mobile sources are inventoried in `ecosystem/surfaces.json` but have not yet been admitted as independent copies or migrated to `@floyd/sdk`.
- **MOBILE-SOURCE-001:** `CaptainPhantasy/The_Burner` is remotely verified at `f1da3eb`, but no local source checkout was found during the 2026-07-13 audit.
- **AUTOSTART-001:** `com.floyd.core` launchd service is not provisioned; live Core/OpenCode startup currently requires an explicit command.
- **BROWSER-AUTH-001:** The cockpit supports one-time `?token=` bootstrap into `sessionStorage`, but a URL token is visible in browser process arguments and history until JavaScript removes it. Do not use URL-token launches for routine operation; replace bootstrap with an HttpOnly loopback session or native-shell injection before packaging.
