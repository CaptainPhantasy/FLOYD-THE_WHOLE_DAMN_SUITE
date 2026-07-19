# FLOYD Workstation — plain-speak status (2026-07-19)

*Read at a glance. No jargon required.*

## The one-sentence version

The bones are built and the engine turns over, but the parts that make it a *daily-driver* (mobile hand-off, real-OAuth, fresh rendered visual proof) still need their last mile.

## What "FLOYD Workstation" is, in plain words

It's your private control room. One durable authority (Floyd Core) that owns projects, sessions, agents, memory, and evidence — with OpenCode (1.17.15+) underneath as the coding engine, never deeply forked. The promise: every Floyd surface (desktop, IDE, TUI, terminal, launcher, mobile) talks to the **same** state, not five competing copies of it.

## What's actually working today (runtime-verified)

| Capability | State | Evidence |
|---|---|---|
| Durable projects/sessions/runs/jobs | **Shipped** | Core SQLite + golden-path acceptance |
| Five local presentation surfaces | **Shipped** | Desktop, IDE, TUI, TerminalOne, Launcher — pinned intake commits |
| Live cross-surface session attach/steer | **Shipped** | Parity PASS 6/6 |
| Multi-provider completion relay (GLM Coding Plan + alternates) | **Shipped** | Gateway tests + live loopback probe |
| Portable experience envelope (hand-off state) | **Shipped** | Core/SDK/Cockpit + isolated five-client restore/conformance |
| SDK capability/version negotiation | **Shipped** | Typed/browser SDK + accepted + HTTP 426 integration tests |
| Floyd Core as launchd-owned durable daemon | **Shipped** | `pnpm core:install`, byte-identical `0600` plist, health-gated reload |
| Core release builder + symlink-attack rejection | **Shipped** | `b7caf23` live, `lsof` confirms cwd is exact release dir, no path back to working checkout |
| In-memory 8-hour HttpOnly session (replaced localStorage bearer) | **Shipped** | bootstrap 201, hostile Origin 403, hostile Host 421, revoke 200, post-revoke 401 |
| Encrypted device identity | **In progress** | AES-GCM/scrypt/revocation pass; Secure HttpOnly cookie for paired browsers, native Keychain storage remains |
| Deep-link + QR hand-off | **In progress** | Private HTTPS fragment link, inert local SVG QR, recoverable consume-once pairing — physical second-device scan remains |
| Private remote attach | **In progress** | 41416 allowlisted listener + Tailscale HTTPS 8443 live; scoped attach, OOB denial, logout, stream revocation pass — second physical tailnet-device proof remains |
| Connector/OAuth authority | **In progress** | AES-GCM key/OAuth storage, PKCE, refresh/revoke, mock lifecycle — real-provider OAuth proof remains |
| Unified application workspace (tabbed cockpit) | **Verified local preview** | Desktop, IDE, TerminalOne, Launcher, exact TUI continuation all render in one shell |

Test totals: **154/154 passing**, `pnpm typecheck` exit 0, `pnpm verify:surfaces` PASS, `git diff --check` clean.

## What's not done yet (be honest about it)

1. **Native platform-secure client storage** — browser pairing uses a Secure HttpOnly cookie (good); native clients still need Keychain integration.
2. **Physical second-device QR acceptance** — the local five-surface restore conformance is done; an actual phone-or-tablet scan-and-accept is still open.
3. **Real-provider OAuth acceptance** — PKCE, refresh, revoke all pass against mocks; a live grant from a real provider (Notion did one test grant at revision 744) needs to be repeatable and durable.
4. **Fresh rendered visual proof** — blocked by the closed browser-control transport. No headless screenshot is being substituted for it.
5. **Reboot/login survival** — still a manual operator receipt, not an automated gate.

## Why it's not "today's workflow leader" yet

The golden path (builder → diff → test → reviewer → explicit-merge) is the only loop that has been runtime-verified end-to-end. Everything around it — mobile, real OAuth, fresh rendered proof — is *built* and *passes its own unit tests* but hasn't been **proven across the seam** to a live second device or live provider.

In plain terms: you can use it today at this desk, on this Mac, in this terminal. You can't yet hand off to your phone, sync to a real Notion/Google grant, or show a fresh screenshot of the result. Those are the last 10%.

## What "finalize the daily-driver" looks like (acceptance gates)

- [ ] Physical second-device QR scan accepted (consume-once pairing on real hardware)
- [ ] Native Keychain integration for native clients (no JS-exposed secrets)
- [ ] Repeatable real-provider OAuth grant + durable status across restart
- [ ] Fresh rendered visual proof from a working browser-control transport
- [ ] Reboot/login survival receipt

Until those five boxes tick, the workstation is a **strong local tool** and a **staged daily-driver**, not a finished one.

## What I would do next, in priority order

1. Unblock the browser-control transport (it's gating #4 and feeding into #1).
2. Knock out #5 (reboot survival) — it's mechanical and removes ambiguity.
3. Pair a real phone for #1 — that single proof retires a lot of conditional language.
4. Stand up a real-provider OAuth cycle for #3.
5. Land Keychain integration for #2 last — it's the most platform-specific and lowest-risk-to-defer.

## References (read in this order if you want depth)

1. `FLOYD.md` — repository contract
2. `FABLE5_HANDOFF.md` — implementation mission
3. `FLOYD_ECOSYSTEM_BLUEPRINT.md` — architecture
4. `docs/HANDBACK-2026-07-12-golden-path.md` — what was actually proven
5. `FEATURES.md` — feature matrix
6. `progress.md` + `CHANGELOG.md` — session logs
7. `docs/adr/ADR-001`, `ADR-002` — recorded corrections
