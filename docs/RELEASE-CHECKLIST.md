# FLOYD Release Checklist

Items that cannot run in CI and must be recorded by an operator before release.

## Objective 4 — Floyd Core under launchd

- [x] `com.floyd.core.plist` validated in CI (`tests/acceptance/launchd_plist_test.py` → RESULT: PASS, 10/10).
- [x] Repeatable install/reload is provided by `pnpm core:install`; it installs
      a clean, commit-addressed release under `FLOYD_RUNTIME/releases/core`,
      installs the checked-in plist with mode `0600`, reloads the user
      LaunchAgent, and requires authenticated health to report that exact
      source commit. A failed rollout restores the prior plist and release link.
- [x] Loaded via `launchctl bootstrap gui/$UID`; `launchctl list` shows running (pid 85295, exit 0), state = running, never exited.
- [x] CLI-submitted run executed against the launchd Core with exactly one Core process (before=1, after=1); CLI attached, did not spawn.
- [ ] **MANUAL (operator, requires reboot):** Reboot the machine. After login, run
      `launchctl list | grep com.floyd.core` and confirm the service is running
      with no manual command. Record date + result here.
      - Reboot survival result: __________ (date, operator)

### Footgun recorded (ADR-worthy)

launchd cannot redirect a job's `StandardOutPath`/`StandardErrorPath` onto an
external volume (`/Volumes/Storage/...`) — it fails the job with
`EX_CONFIG` (exit 78) BEFORE spawning node, with empty logs. Core's stdio logs
therefore live at `~/Library/Logs/floyd/` (internal disk); only the runtime DB
and artifacts stay on the external `FLOYD_RUNTIME` volume (opened by node, not
launchd). The auth-broker plist logs to `~/.omp` for the same reason.

## Security items (P14 — Douglas's authority)

- [ ] Rotate the GLM key out of plaintext `~/.config/opencode/opencode.json`
      (coordinate with `coding-helper`).
- [x] Shared OpenCode config and legacy state directories/files are private
      (`0700` directories, `0600` config/DB/WAL/SHM); Floyd launchd and Core
      both enforce umask `077` for future runtime files.
