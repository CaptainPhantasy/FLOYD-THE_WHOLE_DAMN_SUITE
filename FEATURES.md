# Floyd feature matrix

| Feature | State | Evidence boundary |
|---|---|---|
| Durable projects/sessions/runs/jobs | Shipped | Core SQLite and run acceptance |
| Five local presentation surfaces | Shipped | Pinned clean intake commits |
| Shared live session attach/steer | Shipped | Cross-surface parity PASS 6/6 |
| Multi-provider completion relay | Shipped | Gateway tests and live loopback probe |
| Portable experience envelope | Shipped | Core/SDK/Cockpit plus isolated five-client restore/conflict conformance |
| SDK capability/version negotiation | Shipped | Typed/browser SDK plus accepted and HTTP 426 integration tests |
| Encrypted device identity | In progress | AES-GCM/scrypt/revocation pass; paired browsers use a Secure HttpOnly session cookie, while native Keychain storage remains |
| Deep-link and QR handoff | In progress | Private HTTPS fragment link, inert local SVG QR, independently mutable session snapshot, idempotently recoverable consume-once pairing, and cookie-auth tests pass; a physical second-device scan remains |
| Private remote attach | In progress | Separate 41416 allowlisted listener is live; scoped attach, out-of-bound denial, logout, and stream revocation pass. Tailscale has been removed from this system; a replacement private overlay is required before remote attach is usable. |
| Connector/OAuth authority | In progress | AES-GCM API-key/OAuth storage, PKCE, refresh/revoke, endpoint-bound relay references, SDK parity, and mock lifecycle tests pass; real-provider OAuth proof remains |
| Five-surface local continuity | Preview baseline | Desktop, IDE, TUI, TerminalOne, and launcher commits are pinned for local developer testing; exact TUI project/session/run/event handoff and semantic/transport ownership are explicit |
| Unified application workspace | Verified local preview | Frame (`apps/frame`) renders Desktop, IDE, TerminalOne, Launcher, and exact TUI continuation in one Core-connected shell; the first-party cockpit is retired. Live PTY/Launcher close tests return active and resumable session counts to zero, while remote embedding remains an open gate |
| Unified private remote experience | In progress | Cockpit QR/private attach is implemented; physical second-device proof and native secure storage remain |

“Shipped” means direct implementation and named verification exist. “In
progress” and “Not shipped” are deliberately visible so partial architecture is
not presented as the completed ecosystem.

“Preview baseline” is an intermediate hands-on test milestone. The active
objective remains a maintained, seamless experience across every admitted Floyd
application; no connected-application requirement is deferred by that label.

Surface continuity boundaries and the difference from cross-vendor application
federation are documented in `docs/SURFACE_CONTINUITY.md`.

Connector authority operational boundaries:

- OAuth callback lookup and expired-attempt retention are not yet compacted;
  high-churn installations need scheduled cleanup before long-term operation.
- Token issuance cannot be made transactional with an external provider. A
  crash after provider issuance but before receipt can leave an unknown grant.
- The evidence outbox is at-least-once and may replay a duplicate after a crash.
- Provider response-header and stream-idle deadlines are fixed at 30 and 60
  seconds. Exceptionally cold or silent models can be terminated by policy.
- The 0600 encryption key protects a copied database, not a fully compromised
  runtime directory or user account. Real-provider OAuth acceptance is pending.

Handoff operational boundaries:

- QR rendering is local and never sends the bearer link to an image service,
  but currently depends on a compatible system `qrencode` binary. A missing,
  incompatible, timed-out, or oversized renderer response makes issuance fail
  closed and revokes the just-created handoff.
- The fragment contains a short-lived bearer secret until the receiving page
  reads and immediately removes it from browser history. Camera rolls, screen
  recording, shoulder surfing, extensions, or a compromised receiving browser
  can still capture it before consumption.
- A lost pairing response can be retried without minting a second identity: the
  same valid handoff deterministically recovers the same session. The tradeoff
  is that anyone holding a copied QR can recover that shared session until the
  handoff expires; closing or superseding the local dialog revokes the grant.
- Browser pairing stores only a 15-minute Secure, HttpOnly, SameSite=Strict
  cookie and never exposes the new device secret to JavaScript. Native clients
  still need platform Keychain integration, and no physical second-device scan
  has been accepted yet.
- Paired browser devices are transient and revoked on logout or by the one-minute
  expiry sweeper after their sessions lapse; tombstoned database rows remain for
  auditability rather than being physically deleted.
- The remote surface remains private-overlay only. Tailscale has been removed from this system. This is continuity between
  Floyd surfaces, not a cross-application identity or context federation layer.
