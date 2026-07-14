# Floyd surface continuity

Floyd Core owns one versioned `ExperienceEnvelope`. Presentation surfaces
negotiate their capabilities, restore the current envelope, watch later
revisions, and publish only fields they actually understand. Every write is
optimistic; HTTP 409 returns the newer Core envelope and is never retried
blindly.

## Admitted surfaces

| Surface | Semantic ownership | Restores | Publishes | Deliberate boundary |
|---|---|---|---|---|
| Desktop | Conversation UI | Active run/session, draft, durable transcript, artifact/view, pending asks, model route | Active context, draft, selected view, presence | Legacy direct-provider route remains quarantined from the coding pane |
| IDE | Conversation and workspace UI | Active run/session, draft, transcript, host workspace, artifact/view, pending asks, model route | Active context, draft, workspace, selected view, presence | Dirty editor buffers win locally; host Git/search are explicitly unavailable rather than pointed at a stale virtual root |
| TUI | Conversation UI | Active run/session, draft, transcript, cursor, artifact/view, pending asks, model route | Active context, draft, selected view, coalesced cursor, presence | Handoff flags pin the exact project/session/run/event; ordinary initial input starts a new task unless `--continue` is explicit |
| TerminalOne | PTY transport into the admitted TUI | Active project/session/run and project working directory | Presence only | Raw ANSI/input never becomes transcript or composer state; semantic continuation belongs to the TUI launched inside the PTY |
| Launcher | Harness transport into the admitted TUI | Active project/session/run/event for explicit attach plus bounded raw PTY replay | Presence only | Exact semantic continuation belongs to the TUI; resume tokens are tab-scoped and shell arguments are validated and quoted server-side |

The TUI admitted for TerminalOne is the compiled arm64 artifact at
`/Volumes/Storage/FLOYD_RUNTIME/bin/floyd-tui`. Its provenance file binds it to
the copied TUI repository commit and SHA-256 recorded in
`ecosystem/surfaces.json`. TerminalOne rejects relative binary overrides and
has no fallback to the globally installed direct-provider `omp` command.

## Handoff and remote access

QR/deep-link issuance stays in the Core Cockpit. Other browser surfaces do not
duplicate the bearer-fragment lifecycle. The receiver uses the private HTTPS
remote boundary, scrubs the fragment before network activity, and receives a
short-lived Secure, HttpOnly session cookie. Closing or superseding the issuer
revokes the recovery window.

Floyd's active product objective is a Claude-like maintained experience across
all admitted Floyd applications: a user can move between Desktop, IDE, TUI,
TerminalOne, Launcher, and remote Cockpit without losing the active work. The
preview baseline is a test milestone toward that objective, not a scope
reduction or deferral. Floyd uses its own Core envelope rather than Anthropic's
vendor account, so arbitrary third-party application federation is a different
architecture; it is not being used as an excuse to weaken Floyd-to-Floyd
handoff. A PTY byte stream still remains transport rather than a semantic
conversation.

## Sharp edges

This is a local-developer preview baseline on the path to the full connected-
application experience. The items below are active product gaps or observations
to validate during real use, not reasons to redefine the requested outcome.

- The admitted TUI binary is a snapshot. Every TUI source change requires a
  rebuild, hash/provenance replacement, and a new runtime acceptance.
- Exact TUI handoff requires an interactive TTY. A concurrent envelope 409
  stops startup rather than overwriting another surface; retry after the
  competing write settles. Omitting `--event` retains run identity but loses
  exact cursor position.
- A process kill can lose the final 350 ms draft window. Cursor updates are
  coalesced to prevent a database revision and SSE broadcast per token.
- A 409 after an upstream run was created can leave a valid run that was not
  selected in the envelope. The UI shows the conflict; it does not overwrite
  the newer surface automatically.
- Desktop and IDE transcript normalizers intentionally omit unknown provider
  message shapes. The durable Core data remains intact even if a surface
  cannot render a part.
- PTY resume is bounded by TerminalOne's five-minute, 512 KiB transport ring.
  Durable conversation recovery comes from Core/TUI attach, not that ring.
- Launcher raw PTY resume is memory-only, limited to two minutes and 512 KiB,
  and its tab-scoped bearer remains readable to same-origin JavaScript. A
  Launcher or Core restart loses the raw terminal buffer; the Core-owned
  semantic transcript remains recoverable through exact TUI handoff.
- Desktop and IDE stop reconnecting after their bounded retry budgets and then
  require a user reload; Cockpit and TUI continue capped-backoff retries. Core
  state remains safe in either case.
- A provider can deliver partial deltas before its socket truncates. Floyd now
  marks that response incomplete and does not retry automatically because an
  uncoordinated replay can duplicate output and provider charges.
- The IDE's local-folder Git and search implementations are not shipped. They
  are disabled with an explicit explanation instead of silently using the
  wrong virtual workspace.
- Physical second-device QR acceptance, native Keychain storage, and a real
  provider OAuth round trip remain separate operational gates.
