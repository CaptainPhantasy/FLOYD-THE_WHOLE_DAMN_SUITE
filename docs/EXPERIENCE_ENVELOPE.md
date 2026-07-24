# Floyd portable experience envelope

## Purpose

The experience envelope is the Core-owned state that lets a user leave one
Floyd surface and continue in another without reconstructing the interaction.
It complements the existing durable run/session/job model; it never replaces
that model or makes a presentation surface authoritative.

Envelope schema version `1.0.0` contains:

- active project, Floyd session, and run;
- non-secret model route metadata and Core credential references;
- transcript cursor and last observed event ID;
- Core stream epoch, allowing a safe cursor reset after a Core restart;
- pending questions and permissions hydrated from the active engine session;
- unsent composer draft;
- selected artifact and view;
- selected connected-application IDs, never their credentials;
- negotiated surface SDK version and capabilities;
- update revision, timestamp, and device attribution.

## Authority and merge rules

Core stores the envelope in SQLite. Every mutation includes
`expected_revision`; stale mutations receive HTTP 409 with the latest envelope
so an SDK may consciously retry. There is no silent last-writer overwrite.

Clients may update presentation state and their own capability/cursor record.
They may not author pending questions or permissions. Core derives those from
the active OpenCode engine session. Model keys and OAuth tokens are forbidden
from the envelope; only encrypted Core credential references may persist.
Model-provider credentials and connected-application credentials are separate
authorities. OpenCode Zen/Go, OpenAI, and Anthropic use the model connector
store and cannot receive an MCP token. Remote MCP applications use the
connected-app authority and cannot be selected by the model gateway.
Connected-application selection is an optimistic envelope mutation. Core
validates every selected ID against a durable connected-app profile, sorts and
deduplicates the list, and carries only those IDs into a handoff snapshot.
Changing the active session or run automatically clears pending asks, selected
artifact, cursor, event ID, and per-surface replay positions. Selected
artifacts must belong to the active run.

## Protocol

- `POST /api/experience/negotiate`
- `GET /api/experience/{id}`
- `PATCH /api/experience/{id}`
- `GET /api/experience/{id}/stream`
- `POST /api/devices/enroll`
- `POST /api/devices/authenticate`
- `DELETE /api/device-sessions/current`
- `DELETE /api/devices/{id}`
- `POST /api/handoffs`
- `POST /api/handoffs/consume`
- `POST /api/handoffs/pair`
- `DELETE /api/handoffs/{id}`
- `GET /api/connected-apps`
- `POST /api/connected-apps/{id}/invoke`
- `DELETE /api/connected-apps/{id}`

The initial canonical envelope ID is `primary`. The stream uses the envelope
revision as its SSE ID. Reconnecting surfaces send `Last-Event-ID`, fetch the
current envelope if they missed a revision, then continue live.

Session event cursors are run-scoped and paired with a process-unique stream epoch. When Core
restarts, the new epoch authorizes a reset to cursor zero even though the Floyd
session itself did not change. Interactive transcript, steering, questions,
and permissions always target the run's builder session, never the reviewer.
Frame cursor writes carry their originating run and epoch and are discarded
after either changes. Concurrent run selections use a monotonic generation so
an older network response cannot attach or publish over a newer selection.
Active-context publications are serialized across run, new-task, and model-chat
transitions; the newest generation publishes last and is the only one attached.

## Security boundary

Local surfaces initially authenticate through the existing loopback Core token.
Device metadata is encrypted with AES-256-GCM under a Core-owned 0600 master
key. Device enrollment secrets use scrypt verifiers; short-lived handoff
secrets are hashed at rest, revision-bound, consume-once, and revocable. Deep
links contain a bearer handoff secret, so surfaces must never log them or leave
them in history.

The admin HTTP listener remains loopback-only on port 41414 and authenticated
by the Core token. A separate loopback listener on port 41416 is the remote
boundary; the live host publishes that boundary through a private overlay.
Tailscale has been removed from this system, so no overlay is currently
configured. Four additional Core-owned loopback relays on ports 41420-41423 are
reserved for the admitted Desktop, IDE, PTY, and Launcher copies and will be
published on private HTTPS ports once an overlay is in place. No application
port is published directly. The remote listener and relays reject the Core token
and provider relay, accept only short-lived device sessions, and apply an
explicit route, capability, and resource allowlist. The private overlay is
transport defense in depth, not application identity. Funnel/public exposure
remains prohibited.

`surface:access` is intentionally a broad single-developer grant: after fixed
source-root/commit health verification, it carries the authenticated
application's HTTP and WebSocket traffic to its loopback server. That includes
the IDE's filesystem operations and the terminal applications' host-shell
authority. The relay strips browser credentials before forwarding, rewrites
the upstream Origin/Host to the fixed loopback target, requires the exact
external Origin for cookie-authenticated mutations and WebSockets, terminates
active sockets on expiry/revocation, and prevents upstream cookies from
escaping. This is a testing baseline, not a least-privilege multi-user policy;
remove `surface:access` from a handoff or revoke its device session to cut off
all application authority.

Permanent device credentials exchange for a default health-only session.
Native handoff consumption atomically issues a session whose scopes are the
intersection of the device grant and handoff grant and whose resources are
bound to an immutable snapshot of the envelope's active project, session, run,
current artifacts, and selected connected-application IDs. Handoff sessions
may receive `connected_app:read` and `connected_app:invoke`; they never receive
connected-app creation, OAuth, refresh, selection, or revocation authority.
Browser pairing instead consumes the one-time token at
the exact configured private HTTPS origin, creates a transient device, and
returns only a short-lived Secure, HttpOnly, SameSite=Strict session cookie.
The enrollment secret and session token never enter browser JavaScript.
Remote session attach/input requires an explicit bound run. Server-derived
device attribution replaces any untrusted actor field. Revocation closes open
SSE streams immediately; token expiry has its own stream termination timer.

Native handoff consumption requires all three factors in one request: the
one-time handoff token, an enrolled device ID, and that device's enrollment
secret. Browser pairing treats the one-time bearer as its enrollment
capability, is separately rate-limited, and accepts only the exact normalized
private HTTPS origin. A lost browser-pair response can recover the same bounded
session without minting a second identity. Closing or superseding the issuer's
handoff revokes that recovery window even after the first successful pair.

Sharp edges remain: a copied QR bearer can recover the shared session until the
issuer revokes it or it expires; screenshots, camera rolls, extensions, and a
compromised receiver can capture the fragment before it is scrubbed. Native
clients still need platform-secure storage, and the private HTTPS lifecycle has
been proved from the host and from a second physical device on the then-active
private overlay. That run consumed a new one-time handoff, rendered Floyd
Desktop in the unified remote shell, revoked the device session, and received
401 on its next state request.
QR issuance also fails closed when the local system
`qrencode` binary is missing, incompatible, timed out, or returns disallowed
SVG geometry.

Connected-application OAuth is local-authority-only. Core performs RFC 9728
protected-resource discovery, pins the exact MCP resource and issuer, uses
RFC 8414 or OpenID metadata, requires S256 PKCE, and falls back to RFC 7591
dynamic client registration when a public client is not pre-registered. The
authorization code is delivered directly to Core's loopback callback and is
immediately replaced by a 303 to a clean Cockpit URL; browser JavaScript never
receives the code, state, access token, refresh token, or client secret. Access,
refresh, client, and PKCE secrets use a separate 0600 Core key and AES-256-GCM
contexts bound to the connected-app ID, issuer, and exact resource URL. Refresh
is serialized and rotating refresh tokens are replaced atomically. Disconnect
revokes the refresh token before the access token and erases local ciphertext
even when upstream revocation is uncertain.

MCP credentials are resolved only inside Core from
`floyd-connected-app:<id>` references. Core pins the HTTPS resource URL,
canonicalizes Bearer authentication, refuses redirects, performs the MCP
initialize/initialized handshake itself, and retains the session ID privately.
JSON and SSE replies are bounded and matched to the caller's JSON-RPC ID. A
browser disconnect, device-session revocation, app revocation, or normal
completion aborts/cancels the upstream body and sends a bounded MCP session
DELETE when a session was established. Upstream HTTP status and error content
are preserved after credential redaction.

The sharp edge is deliberate for the current single-developer baseline:
selection grants the receiving handoff permission to invoke any MCP method the
connected application exposes, including methods that can write or delete
remote data. Core blocks callers from spoofing the lifecycle handshake, but it
does not yet implement per-tool read/write policy, interactive confirmation,
or semantic argument inspection. A selected app is therefore a broad delegated
capability for that app, not a read-only bookmark. Remove it from the envelope
before issuing a handoff, revoke the device session, or revoke the app to cut
off that authority. Upstream revocation may also be best-effort; Floyd erases
its local ciphertext even if a provider fails to confirm invalidation.

## Completion boundary

The envelope is not ecosystem completion by itself. Completion additionally
requires enrolled/revocable devices, private remote transport, deep-link and QR
handoff, connector/OAuth authority, five-surface conformance, and rendered
cross-device acceptance proof.
