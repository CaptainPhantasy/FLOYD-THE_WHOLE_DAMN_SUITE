# Changelog

## Unreleased

### Added

- Versioned `ExperienceEnvelope` contract and Core persistence schema.
- Portable experience specification and explicit ecosystem completion boundary.
- Cockpit integration work for Core-owned drafts, active context, selected
  view/artifact, model route metadata, transcript cursor, capability handshake,
  and live envelope restoration.
- Typed and browser SDK APIs for experience negotiation, optimistic updates,
  SSE resume, device enrollment/authentication/revocation, and one-time handoffs.
- Core HTTP routes for the experience stream and encrypted device/handoff
  lifecycle, with exact 409 revision conflicts and HTTP 426 upgrade guidance.
- Fresh cross-surface session attach restores the selected run's durable
  builder transcript, replays events that arrived during the snapshot, and deduplicates only
  provider parts proven present in the snapshot.
- Session replay epochs recover cleanly after a Core restart; active-session
  or active-run changes automatically reset cursor, pending-interaction, and
  artifact state.
- Transcript, steering, question, and permission continuity explicitly target
  builder sessions rather than newer completed reviewer sessions.
- Run-selection generations and run/epoch-bound cursor writes prevent delayed
  browser work from overwriting a newer active run. Pending ask snapshots are
  revalidated and never added to replay history.
- Active-context writes are serialized through the latest UI generation, and
  transcript hydration retries builder replacement without mixing old-engine
  replay into the restored conversation.
- A separate loopback remote boundary on port 41416 accepts short-lived device
  sessions only, exposes an explicit route allowlist, and is published privately
  through Tailscale HTTPS on port 8443 without replacing the existing 443 route.
- Device authentication now exchanges the permanent enrollment secret for a
  least-privilege access session; one-time handoff consumption atomically mints
  an envelope/session/run-bound session and returns its expiry and capabilities.
- Typed and browser SDKs expose device-session logout while preserving exact
  401/403 responses and cancellation of remote SSE readers.

### Security

- Experience state forbids raw provider/OAuth credentials and persists only
  Core-owned credential references.
- Envelope writes use optimistic revisions rather than silent last-writer wins.
- Device metadata uses AES-256-GCM under a 0600 Core key; device enrollment
  secrets use scrypt and handoff secrets are hashed, expiring, consume-once,
  revision-bound, and revocable.
- Handoff consumption requires possession of both an enrolled device secret
  and the one-time handoff token. Self-authentication is origin-checked and
  rate-limited; API query-token authentication has been removed.
- Security mutations and their evidence events commit or roll back together.
- Device access tokens are opaque and hash-at-rest, capped at 15 minutes for
  handoffs, intersected with explicit device grants, and bound to resource IDs.
  Remote actors are derived from the authenticated device, not request JSON.
- Remote routes deny the global Core bearer, provider relay, global state,
  global evidence, mutation/admin routes, and out-of-bound session/run/artifact
  access. Device/session revocation closes already-open remote SSE streams.

### Still incomplete

- Platform-secure client storage, second-device remote acceptance, QR rendering,
  connector/OAuth authority, and five-surface restore conformance remain open
  until their direct runtime gates pass.
