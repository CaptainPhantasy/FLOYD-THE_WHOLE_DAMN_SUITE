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

The current HTTP listener remains loopback-only and authenticated by the Core
token. This is not remote attach. Remote use still requires private HTTPS,
device-scoped session tokens, rate limits, and a proved revoked-device denial.
A handoff token is not a provider key and must never grant unrestricted
workstation access.

Handoff consumption is self-authenticating but requires all three factors in
one request: the one-time handoff token, an enrolled device ID, and that
device's enrollment secret. Core rate-limits this path and rejects non-loopback
browser origins. A token bound to an older envelope revision is rejected
without being consumed.

## Completion boundary

The envelope is not ecosystem completion by itself. Completion additionally
requires enrolled/revocable devices, private remote transport, deep-link and QR
handoff, connector/OAuth authority, five-surface conformance, and rendered
cross-device acceptance proof.
