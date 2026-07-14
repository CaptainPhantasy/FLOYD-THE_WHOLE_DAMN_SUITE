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
- All five copied presentation surfaces now negotiate and restore the portable
  envelope. Desktop, IDE, and TUI restore durable Core transcripts; TerminalOne
  and launcher remain explicit transport/presence surfaces and never infer
  semantic state from shell bytes.
- The IDE's Open Folder flow now propagates the host workspace to its terminal
  and Floyd coding pane. Host Git/search remain explicitly disabled until real
  host-backed adapters exist, preventing operations against the stale virtual
  workspace.
- TUI cursor publications are generation-guarded and coalesced rather than
  producing an envelope revision for every token. Explicit initial input starts
  a new task unless the operator supplies `--continue`.
- TerminalOne launches a hash-pinned arm64 TUI artifact built from the admitted
  copied commit. Relative overrides and fallback to the global direct-provider
  `omp` binary are rejected.
- Launcher browser shells now require a short-lived, single-use same-origin
  WebSocket ticket before allocating a PTY. Its cold `npm test` owns server
  startup, readiness, and shutdown instead of assuming port 11000 is prebound.
- The admitted TUI now reconnects its Experience stream after Core restarts,
  restores authoritative state even after revision rollback, advertises its
  transcript/cursor capabilities, and preserves divergent local drafts.
- Desktop and IDE now preserve divergent local drafts, reconnect with a fresh
  authoritative restore, parse split SSE frames, and expose selected artifacts,
  pending questions, pending permissions, and the active provider/model route.
- The admitted TUI restores the selected artifact, pending questions,
  pending permissions, and provider/model route while sanitizing terminal
  control bytes and bounding rendered artifact content.
- TerminalOne resolves the Core-owned project before continuation and launches
  the admitted TUI from the canonical project root with an explicit project ID.
  Launcher attach commands carry the active run ID and recover their Experience
  watch after Core restarts.
- The root CLI accepts `floyd attach <session> [seq] --run <run>` so transport
  surfaces cannot accidentally resume a newer run in the same session.
- Desktop, IDE, and TUI semantic coding streams now treat unexpected EOF as an
  interruption, restore durable Core truth, and resume from the last observed
  run-scoped event ID. Partial output is never promoted to a completed answer.
- TUI answers, permission responses, and artifact reads now abort on context
  changes; artifact work no longer serially blocks later envelope revisions,
  and model-route changes update the running terminal header.
- Admitted browser copies use a dedicated loopback port block (13010–13014)
  instead of the separately preserved donor processes and their claimed ports.
- The admitted TUI accepts an exact `--session`, `--run`, and optional `--event`
  handoff, validates it against the Core project selected by the current working
  directory, and reuses the reconnecting semantic session lifecycle instead of
  falling back to a raw CLI stream.
- TerminalOne resolves and validates the Core-owned project/session/run before
  writing that exact semantic TUI handoff into its PTY; missing or mismatched
  context fails closed instead of degrading to `--continue`.
- Provider streams that end without an explicit vendor terminal frame now emit
  `upstream_stream_incomplete`; both SDKs and the Cockpit reject bare EOF rather
  than presenting partial paid output as a successful answer.
- Cockpit OAuth callback parameters are captured and removed from the address
  bar before health, state, connector exchange, or any other awaited work.
- Admitted LaunchAgents derive their runtime identity from each copy's actual
  Git HEAD, while Core loads the expected commit from the locked surface
  manifest at startup. A mismatch remains fail-closed.
- Cockpit HTML and the browser SDK are served with `Cache-Control: no-store`,
  preventing an existing developer browser from resurrecting a stale surface
  contract after Core restarts on a newer checkout.

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
  and real-provider OAuth acceptance remain open until their direct runtime
  gates pass. Local five-surface restore conformance is now implemented.
