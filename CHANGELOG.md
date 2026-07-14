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
- The Cockpit can issue a private HTTPS-fragment handoff with a locally rendered
  SVG QR. The receiving remote surface scrubs the fragment before network work,
  atomically consumes the handoff, and receives a short-lived Secure, HttpOnly,
  SameSite=Strict session cookie without exposing a device secret to JavaScript.
- QR output is constrained to an inert geometry allowlist and loaded only as an
  image blob. The full bearer URL is hidden unless the user explicitly copies
  it, and closing or replacing the QR revokes the outstanding handoff.
- Handoffs retain an immutable sanitized experience/resource snapshot, so later
  primary-envelope revisions do not corrupt the intended continuation context;
  the paired session can update its own Core-persisted snapshot independently.
  Pair retries recover the exact original session after a lost HTTP response.
  Transient paired identities are revoked on logout and swept after expiry.
- Typed and browser SDKs expose device-session logout while preserving exact
  401/403 responses and cancellation of remote SSE readers.
- A zero-dependency connector authority stores API keys and OAuth tokens under
  AES-256-GCM, performs PKCE authorization and refresh/revocation lifecycle,
  and exposes sanitized local-only management routes plus typed/browser SDKs.
- Model relay calls may use an opaque `floyd-connector:*` reference. Core
  resolves it server-side, binds it to the configured provider endpoint, and
  rejects ambiguous raw-secret plus reference requests.

### Security

- Experience state forbids raw provider/OAuth credentials and persists only
  Core-owned credential references.
- Envelope writes use optimistic revisions rather than silent last-writer wins.
- Device metadata uses AES-256-GCM under a 0600 Core key; device enrollment
  secrets use scrypt and handoff secrets are hashed, expiring, consume-once,
  revision-bound, and revocable.
- Existing-device handoff consumption requires both an enrolled device secret
  and the one-time token. First-browser pairing accepts the one-time token as
  the enrollment capability, atomically consumes it, and returns credentials
  only in an HttpOnly cookie. Pair recovery is idempotent until handoff expiry.
  Browser pairing requires the normalized configured HTTPS Origin and is
  rate-limited; API query-token authentication has been removed.
- Security mutations and their evidence events commit or roll back together.
- Device access tokens are opaque and hash-at-rest, capped at 15 minutes for
  handoffs, intersected with explicit device grants, and bound to resource IDs.
  Remote actors are derived from the authenticated device, not request JSON.
- Remote routes deny the global Core bearer, provider relay, global state,
  global evidence, mutation/admin routes, and out-of-bound session/run/artifact
  access. Device/session revocation closes already-open remote SSE streams.
- Connector credential values, OAuth verifiers, state values, and client
  secrets are excluded from list responses and evidence; the remote listener
  does not expose connector management or connector-backed provider calls.
- OAuth callback and refresh claims are SQLite-coordinated across Core
  instances, stale claims recover after bounded upstream deadlines, and
  provider-issued credentials survive evidence-sink failure through a replayed
  durable outbox.
- Provider SSE errors are terminal and preserved as normalized `error` events;
  response-header, idle-stream, OAuth-body, and SSE-frame limits prevent
  dangling sockets and unbounded buffering.

### Still incomplete

- Native platform-secure client storage, physical second-device QR acceptance,
  real-provider OAuth acceptance, and five-surface restore conformance remain
  open until their direct runtime gates pass.
