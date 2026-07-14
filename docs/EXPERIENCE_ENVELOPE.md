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
- `DELETE /api/handoffs/{id}`

The initial canonical envelope ID is `primary`. The stream uses the envelope
revision as its SSE ID. Reconnecting surfaces send `Last-Event-ID`, fetch the
current envelope if they missed a revision, then continue live.

Session event cursors are run-scoped and paired with a process-unique stream epoch. When Core
restarts, the new epoch authorizes a reset to cursor zero even though the Floyd
session itself did not change. Interactive transcript, steering, questions,
and permissions always target the run's builder session, never the reviewer.
Cockpit cursor writes carry their originating run and epoch and are discarded
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
boundary; the live host publishes only that boundary through Tailscale HTTPS
on port 8443. The remote listener rejects the Core token and provider relay,
accepts only short-lived device sessions, and applies an explicit route,
capability, and resource allowlist. Tailscale is transport defense in depth,
not application identity. Funnel/public exposure remains prohibited.

Permanent device credentials exchange for a default health-only session.
Consuming a handoff atomically issues a session whose scopes are the
intersection of the device grant and handoff grant and whose resources are
bound to the envelope's active project, session, run, and current artifacts.
Remote session attach/input requires an explicit bound run. Server-derived
device attribution replaces any untrusted actor field. Revocation closes open
SSE streams immediately; token expiry has its own stream termination timer.

Handoff consumption is self-authenticating but requires all three factors in
one request: the one-time handoff token, an enrolled device ID, and that
device's enrollment secret. Core rate-limits this path and accepts only
loopback or the exact private HTTPS origin. A token bound to an older envelope revision is rejected
without being consumed.

Sharp edges remain: the current revision binding makes handoffs brittle during
active envelope edits; a browser still needs an HttpOnly same-site session or
native secure-storage bridge; and the private HTTPS lifecycle has been proved
from the host through its tailnet name, not yet from a second physical device.

## Completion boundary

The envelope is not ecosystem completion by itself. Completion additionally
requires enrolled/revocable devices, private remote transport, deep-link and QR
handoff, connector/OAuth authority, five-surface conformance, and rendered
cross-device acceptance proof.
