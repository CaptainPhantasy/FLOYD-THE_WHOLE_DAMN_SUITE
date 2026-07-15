# Floyd Gateway Session Contract

Version: 1.0 (2026-07-12). Any surface — CLI, Cockpit, future mobile — can be
built against this document alone; no additional gateway changes are required.

## Transport and authentication

- Base URL: `http://127.0.0.1:41414` (loopback; remote surfaces arrive via
  private overlay in a later phase — same contract).
- Native and server-side clients carry `Authorization: Bearer <gateway token>`
  (`FLOYD_RUNTIME/core/gateway.token`, 0600). API query-token authentication is
  forbidden.
- The local Cockpit never persists that gateway token in browser storage. A
  `#token=...` fragment may bootstrap the page once; the page removes the
  fragment from the visible URL before network activity, exchanges the bearer
  through `POST /api/local-session`, then erases its JavaScript reference.
  Core returns only an eight-hour, random HttpOnly `SameSite=Strict` loopback
  session cookie, stores only its SHA-256 digest in memory, rejects non-loopback
  Host headers, and requires the exact loopback Origin for cookie-authenticated
  mutations. Core restart or `DELETE /api/local-session` revokes the session.
  Never put the fragment bootstrap in a process command line.
- Private remote browsers use the separate scoped device-session HttpOnly
  cookie and never receive the workstation gateway token.
- Session IDs are Floyd session IDs (`ses_…`) from `GET /api/state`. One Floyd
  session is the project continuity container. Active conversation streams,
  transcript cursors, steering, questions, and permissions are additionally
  scoped by `run_id` so runs cannot cross-talk.

## POST `/api/sessions/{sessionId}/attach`

Registers the calling surface as an active participant and begins streaming.

Request body (JSON, optional):
`{ "actor": "<surface identity string>", "run_id": "run_…" }`.
`run_id` is recommended for every active-run surface. Omitting it attaches to
the aggregate session channel for backward compatibility.
Response: `200` with `Content-Type: text/event-stream` — the response IS the
event stream (see next section for frame format). Attaching also appends a
`session.participant_attached` evidence event with the actor.

`Last-Event-ID` behavior: WITHOUT the header, Core first emits a durable
`transcript` snapshot and then starts live. Events that arrive while the
snapshot is being read are replayed after it. WITH a
`Last-Event-ID: <seq>` header (or `?lastEventId=<seq>`), all buffered events
with `seq > <seq>` are replayed, in order, before live events resume. Replay depth is bounded by the
gateway buffer (5000 events per session/run scope, in-memory; a Core restart clears it —
clients reconnecting after a gateway restart receive `last_seq: 0` in the hello
frame and should treat history as truncated).

Errors: `404` unknown session; `405` non-POST; `401` bad token.

## GET `/api/sessions/{sessionId}/events`

Identical stream to `attach` without participant registration. Honors
`Last-Event-ID` the same way. Intended for read-only observers.

### SSE frame format

```
id: <seq>
event: <type>
data: <json payload>
```

- `seq` — monotonically increasing integer scoped to the selected session/run
  channel and engine emission order.
- First frame is always `event: hello` with
  `{"session_id", "run_id", "stream_epoch", "last_seq", "replay_from"}`
  (no `id`).
- A fresh attach then receives `event: transcript` with the active engine
  session's durable messages and the replay boundary. This frame is display
  state only; it is never an interactive permission action.
- If the active builder is replaced while its messages are loading, Core
  discards that snapshot and retries the replacement once. Fresh-attach replay
  is filtered to the stable transcript engine so two builder generations are
  never mixed into one restored conversation.
- Currently open question/permission snapshots may follow as unsequenced state
  frames without `id`. Core revalidates their engine target and interaction
  generation after the provider calls; these snapshots are not inserted into
  the replay buffer, so a resolved ask cannot be resurrected on reconnect.

### Event types and payload schema

All five data payloads share this envelope:

```json
{
  "type": "token | tool_call_start | tool_call_finish | question | permission",
  "channel": "text | reasoning",        // token only
  "run_id": "run_…",
  "job_id": "job_…",
  "kind": "builder | reviewer",
  "engine_session_id": "ses_…",
  "engine_type": "<raw engine frame type>",
  "data": { /* raw engine frame data, verbatim */ }
}
```

| type | emitted on | `data` highlights |
|---|---|---|
| `token` | model text/reasoning deltas | `data.delta`/`data.text`, `assistantMessageID` |
| `tool_call_start` | engine `…tool.called` | `data.tool`, `data.input`, `callID` |
| `tool_call_finish` | engine `…tool.success` / `…tool.error` | `data.result` or error |
| `question` | engine question request | `data.id` (request id), questions/options |
| `permission` | engine permission ask | `data.id` (request id), `action`, `resources` |

## POST `/api/sessions/{sessionId}/steer`

Single inbound endpoint; `type` selects the primitive.

| body.type | required fields | forwarded to |
|---|---|---|
| `steer` | `text` | engine prompt with `delivery: "steer"` on the selected run's newest builder session |
| `answer` | `request_id`, and `answers: string[][]` (or `text` shorthand → `[[text]]`) | engine question reply |
| `permission` | `request_id`, `reply: "once" \| "always" \| "reject"` | engine permission reply |

Optional on all: `actor` (recorded in evidence) and `run_id`. Active-run
surfaces should always send `run_id`; a run outside the URL session returns
`404`.
Response: `202 {"session_id", "type", "delivered_to"}`.
Errors: `400` missing fields / unknown type; `409` no engine session exists to
receive input; `401`/`404` as above.

Every inbound message appends evidence (`engine.steer.submitted`,
`engine.question.answered`, `policy.decision` with `source: "surface"`).

## Permission split (who answers what)

Floyd Core auto-answers permission asks that the run's AgentSpec explicitly
allows or denies (`policy.decision` evidence, actor `floyd-core`). Kinds the
spec leaves unlisted stay pending (`policy.pending_surface_decision` evidence)
and surface as `permission` events on this channel for a human to answer via
`steer type=permission`. The run does not proceed past a pending ask.

## Authority rule

Surfaces never spawn Floyd Core. If the gateway is unreachable, display:
"Floyd Core is not running — verify launchd service com.floyd.core" and stop.
