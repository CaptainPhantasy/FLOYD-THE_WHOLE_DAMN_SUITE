# Floyd surface continuity

Floyd Core owns one versioned `ExperienceEnvelope`. Presentation surfaces
negotiate their capabilities, restore the current envelope, watch later
revisions, and publish only fields they actually understand. Every write is
optimistic; HTTP 409 returns the newer Core envelope and is never retried
blindly.

## Admitted surfaces

| Surface | Semantic ownership | Restores | Publishes | Deliberate boundary |
|---|---|---|---|---|
| Desktop | Conversation UI | Active run/session, draft, durable transcript | Active context, draft, selected view, presence | Legacy direct-provider route remains quarantined from the coding pane |
| IDE | Conversation and workspace UI | Active run/session, draft, transcript, host workspace | Active context, draft, workspace, selected view, presence | Dirty editor buffers win locally; host Git/search are explicitly unavailable rather than pointed at a stale virtual root |
| TUI | Conversation UI | Active run/session, draft, transcript, cursor | Active context, draft, selected view, coalesced cursor, presence | An initial message starts a new task unless `--continue` is explicit |
| TerminalOne | PTY transport | Active-context label | Presence only | Raw ANSI/input never becomes transcript or composer state |
| Launcher | Harness transport | Active-context label | Presence only | Attach is a deliberate action; shell arguments are validated and quoted server-side |

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

This is narrower than the Claude connected-application ecosystem. Claude can
carry a vendor account, conversation, and connector context between products
that participate in Anthropic's ecosystem. Floyd currently carries Core-owned
state only between admitted Floyd surfaces. It does not federate identity or
semantic application state into arbitrary third-party programs, and it does
not pretend that a PTY byte stream is a portable conversation.

## Sharp edges

This is a local-developer preview baseline. The items below are observations to
validate during real use, not enterprise release gates.

- The admitted TUI binary is a snapshot. Every TUI source change requires a
  rebuild, hash/provenance replacement, and a new runtime acceptance.
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
- Browser stream adapters do not all implement reconnect backoff. A dropped
  connection can require a reload even though Core state is safe.
- The IDE's local-folder Git and search implementations are not shipped. They
  are disabled with an explicit explanation instead of silently using the
  wrong virtual workspace.
- Physical second-device QR acceptance, native Keychain storage, and a real
  provider OAuth round trip remain separate operational gates.
