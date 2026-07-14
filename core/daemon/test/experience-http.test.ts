import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";

const runtimeRoot = mkdtempSync(join(tmpdir(), "floyd-experience-http-"));
process.env.FLOYD_RUNTIME_ROOT = runtimeRoot;
process.env.FLOYD_CORE_PORT = "0";
mkdirSync(join(runtimeRoot, "core"), { recursive: true, mode: 0o700 });

const { openDb } = await import("../src/db.ts");
const { gatewayToken } = await import("../src/config.ts");
const { startGateway, pumpSessionChannel } = await import("../src/http.ts");
const { synchronizePendingInteractions } = await import("../src/experience.ts");

const db = openDb(join(runtimeRoot, "core", "http.db"));
let pendingProviderAvailable = false;
let pendingSnapshotHook: (() => void) | null = null;
let pendingPermissionsResult: Array<Record<string, unknown>> = [];
let pendingPermissionPause: Promise<void> | null = null;
let pendingPermissionEntered: (() => void) | null = null;
let messageSnapshotHook: (() => void) | null = null;
const engine = {
  isHealthy: async () => true,
  baseUrl: "http://127.0.0.1:9",
  child: null,
  messages: async (engineSessionId: string) => {
    pumpSessionChannel(db, {
      type: "message.part.text.delta",
      run_id: "run-http",
      job_id: "job-http",
      kind: "builder",
      engine_session_id: engineSessionId,
      is_permission_ask: false,
      properties: { delta: "duplicate live delta" },
    });
    messageSnapshotHook?.();
    messageSnapshotHook = null;
    return [
      { id: "message-assistant", type: "assistant", time: { created: 2 }, content: [{ type: "text", text: "snapshot answer" }] },
      { id: "message-user", type: "user", time: { created: 1 }, content: [{ type: "text", text: "snapshot question" }] },
    ];
  },
  pendingPermissions: async () => {
    if (!pendingProviderAvailable) throw new Error("provider unavailable");
    const result = pendingPermissionsResult;
    pendingSnapshotHook?.();
    pendingSnapshotHook = null;
    pendingPermissionEntered?.();
    pendingPermissionEntered = null;
    const pause = pendingPermissionPause;
    pendingPermissionPause = null;
    if (pause) await pause;
    return result;
  },
  pendingQuestions: async () => {
    if (!pendingProviderAvailable) throw new Error("provider unavailable");
    return [];
  },
  replyPermission: async () => { pendingPermissionsResult = []; },
  replyQuestion: async () => {},
  steer: async () => {},
} as never;
const server = startGateway(db, engine, process.pid, new Date().toISOString());
if (!server.listening) await once(server, "listening");
const address = server.address();
if (!address || typeof address === "string") throw new Error("HTTP test server did not bind TCP");
const baseUrl = `http://127.0.0.1:${address.port}`;
const authorization = { authorization: `Bearer ${gatewayToken()}` };

async function api(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      ...authorization,
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...init.headers,
    },
  });
}

async function selfAuthenticatedPost(path: string, body: unknown): Promise<Response> {
  return fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

test("HTTP experience integration negotiates, streams, updates, and preserves conflicts", async () => {
  const queryAuth = await fetch(`${baseUrl}/api/health?token=${encodeURIComponent(gatewayToken())}`);
  assert.equal(queryAuth.status, 401);
  const negotiation = await api("/api/experience/negotiate", {
    method: "POST",
    body: JSON.stringify({
      surface_id: "http-test",
      sdk_version: "1.0.0",
      supported_envelope_versions: ["1.0.0"],
      capabilities: ["drafts", "experience-stream"],
    }),
  });
  assert.equal(negotiation.status, 200);
  assert.equal((await negotiation.json() as { accepted: boolean }).accepted, true);

  const firstResponse = await api("/api/experience/primary");
  assert.equal(firstResponse.status, 200);
  const first = await firstResponse.json() as { revision: number; surfaces: Record<string, unknown> };
  assert.equal(first.revision, 1);
  assert.ok(first.surfaces["http-test"]);

  const streamAbort = new AbortController();
  const stream = await api("/api/experience/primary/stream", {
    headers: { accept: "text/event-stream", "last-event-id": "0" },
    signal: streamAbort.signal,
  });
  assert.equal(stream.status, 200);
  const reader = stream.body!.getReader();
  let streamText = "";
  try {
    for (let readCount = 0; readCount < 4 && !streamText.includes("event: experience"); readCount += 1) {
      const next = await reader.read();
      if (next.done) break;
      streamText += new TextDecoder().decode(next.value);
    }
    assert.match(streamText, /event: hello/);
    assert.match(streamText, /event: experience/);
    assert.match(streamText, /"revision":1/);
  } finally {
    streamAbort.abort();
    await reader.cancel().catch(() => {});
  }

  const updatedResponse = await api("/api/experience/primary", {
    method: "PATCH",
    body: JSON.stringify({ expected_revision: first.revision, composer_draft: "portable draft", selected_view: "run" }),
  });
  assert.equal(updatedResponse.status, 200);
  const updated = await updatedResponse.json() as { revision: number; composer_draft: string };
  assert.equal(updated.revision, 2);
  assert.equal(updated.composer_draft, "portable draft");

  const conflict = await api("/api/experience/primary", {
    method: "PATCH",
    body: JSON.stringify({ expected_revision: first.revision, composer_draft: "stale overwrite" }),
  });
  assert.equal(conflict.status, 409);
  const conflictBody = await conflict.json() as { error: string; actual_revision: number; envelope: { composer_draft: string } };
  assert.equal(conflictBody.error, "revision_conflict");
  assert.equal(conflictBody.actual_revision, 2);
  assert.equal(conflictBody.envelope.composer_draft, "portable draft");

  const forgedPending = await api("/api/experience/primary", {
    method: "PATCH",
    body: JSON.stringify({ expected_revision: updated.revision, pending_permissions: [{ id: "forged" }] }),
  });
  assert.equal(forgedPending.status, 400);
  assert.match((await forgedPending.json() as { error: string }).error, /Core-owned/);
  const spoofedDevice = await api("/api/experience/primary", {
    method: "PATCH",
    body: JSON.stringify({ expected_revision: updated.revision, device_id: "spoofed-device", selected_view: "spoofed" }),
  });
  assert.equal(spoofedDevice.status, 400);
  assert.match((await spoofedDevice.json() as { error: string }).error, /device-scoped/);

  for (const malformedBody of ["null", "[]", "42", JSON.stringify("text")]) {
    const malformed = await api("/api/experience/primary", { method: "PATCH", body: malformedBody });
    assert.equal(malformed.status, 400);
    assert.match((await malformed.json() as { error: string }).error, /JSON object/);
  }
  const invalidJson = await api("/api/experience/primary", { method: "PATCH", body: "{" });
  assert.equal(invalidJson.status, 400);
  assert.equal((await invalidJson.json() as { error: string }).error, "invalid_json");

  const incompatible = await api("/api/experience/negotiate", {
    method: "POST",
    body: JSON.stringify({
      surface_id: "old-surface",
      sdk_version: "0.0.1",
      supported_envelope_versions: ["0.1.0"],
      capabilities: [],
    }),
  });
  assert.equal(incompatible.status, 426);
  assert.equal((await incompatible.json() as { error: string }).error, "sdk_upgrade_required");
});

test("HTTP device and one-time handoff lifecycle returns the bound envelope", async () => {
  const blockedEnrollment = await selfAuthenticatedPost("/api/devices/enroll", { metadata: {} });
  assert.equal(blockedEnrollment.status, 401);
  const enrollment = await api("/api/devices/enroll", {
    method: "POST",
    body: JSON.stringify({ device_id: "device-http-test", metadata: { surface: "test" } }),
  });
  assert.equal(enrollment.status, 201);
  const device = await enrollment.json() as { device_id: string; secret: string };

  const authenticated = await selfAuthenticatedPost("/api/devices/authenticate", { device_id: device.device_id, secret: device.secret });
  assert.equal(authenticated.status, 200);
  assert.deepEqual((await authenticated.json() as { metadata: unknown }).metadata, { surface: "test" });

  const envelope = await (await api("/api/experience/primary")).json() as { revision: number };
  const issue = await api("/api/handoffs", {
    method: "POST",
    body: JSON.stringify({
      envelope_id: "primary",
      envelope_revision: envelope.revision,
      created_by_device_id: device.device_id,
      ttl_ms: 30_000,
    }),
  });
  assert.equal(issue.status, 201);
  const handoff = await issue.json() as { token: string; deep_link: string };
  assert.match(handoff.deep_link, /^floyd:\/\/handoff\?/);

  const consumed = await selfAuthenticatedPost("/api/handoffs/consume", {
    token: handoff.token,
    device_id: device.device_id,
    device_secret: device.secret,
  });
  assert.equal(consumed.status, 200);
  const consumedBody = await consumed.json() as { envelope: { id: string; revision: number } };
  assert.equal(consumedBody.envelope.id, "primary");
  assert.equal(consumedBody.envelope.revision, envelope.revision);

  const replay = await selfAuthenticatedPost("/api/handoffs/consume", {
    token: handoff.token,
    device_id: device.device_id,
    device_secret: device.secret,
  });
  assert.equal(replay.status, 409);
  assert.equal((await replay.json() as { error: string }).error, "handoff_consumed");

  const beforeStale = await (await api("/api/experience/primary")).json() as { revision: number };
  const staleIssue = await api("/api/handoffs", {
    method: "POST",
    body: JSON.stringify({ envelope_id: "primary", envelope_revision: beforeStale.revision, ttl_ms: 30_000 }),
  });
  const staleHandoff = await staleIssue.json() as { token: string };
  const advance = await api("/api/experience/primary", {
    method: "PATCH",
    body: JSON.stringify({ expected_revision: beforeStale.revision, selected_view: "advanced" }),
  });
  assert.equal(advance.status, 200);
  const staleConsume = await selfAuthenticatedPost("/api/handoffs/consume", {
    token: staleHandoff.token,
    device_id: device.device_id,
    device_secret: device.secret,
  });
  assert.equal(staleConsume.status, 409);
  assert.equal((await staleConsume.json() as { error: string }).error, "handoff_stale");
});

test("a fresh session attach receives a durable transcript snapshot", async () => {
  db.prepare(`INSERT INTO projects (id, name, root_path, repo_path, test_command, created_at) VALUES (?, ?, ?, ?, ?, ?)`).run(
    "project-http", "HTTP project", "/tmp/http", "/tmp/http", "true", "2026-07-14T00:00:00.000Z",
  );
  db.prepare(`INSERT INTO sessions (id, project_id, title, created_at) VALUES (?, ?, ?, ?)`).run(
    "session-http", "project-http", "HTTP session", "2026-07-14T00:00:00.000Z",
  );
  db.prepare(`INSERT INTO runs (id, session_id, project_id, goal, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
    "run-http", "session-http", "project-http", "Snapshot", "running", "2026-07-14T00:00:00.000Z", "2026-07-14T00:00:00.000Z",
  );
  db.prepare(`INSERT INTO jobs (id, run_id, kind, status, idempotency_key, agent_spec_id, engine_session_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    "job-http", "run-http", "builder", "running", "http-idempotency", "builder-default", "engine-session-http", "2026-07-14T00:00:00.000Z", "2026-07-14T00:00:00.000Z",
  );

  let envelope = await (await api("/api/experience/primary")).json() as { revision: number };
  const activated = await api("/api/experience/primary", {
    method: "PATCH",
    body: JSON.stringify({
      expected_revision: envelope.revision,
      active: { project_id: "project-http", session_id: "session-http", run_id: "run-http" },
      transcript_cursor: 0,
      last_event_id: null,
    }),
  });
  envelope = await activated.json() as { revision: number };
  synchronizePendingInteractions(db, "primary", envelope.revision, [{ id: "pending-question" }], [{ id: "pending-permission" }]);
  const preserved = await (await api("/api/experience/primary")).json() as { pending_questions: unknown[]; pending_permissions: unknown[] };
  assert.equal(preserved.pending_questions.length, 1);
  assert.equal(preserved.pending_permissions.length, 1);

  pendingProviderAvailable = true;
  pendingSnapshotHook = () => {
    db.prepare(`INSERT INTO jobs (id, run_id, kind, status, idempotency_key, agent_spec_id, engine_session_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      "job-http-new", "run-http", "builder", "running", "http-idempotency-new", "builder-default", "engine-session-http-new", "2026-07-15T00:00:00.000Z", "2026-07-15T00:00:00.000Z",
    );
  };
  const rebound = await (await api("/api/experience/primary")).json() as { pending_questions: unknown[]; pending_permissions: unknown[] };
  assert.equal(rebound.pending_questions.length, 1);
  assert.equal(rebound.pending_permissions.length, 1);
  db.prepare(`INSERT INTO jobs (id, run_id, kind, status, idempotency_key, agent_spec_id, engine_session_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    "job-http-reviewer", "run-http", "reviewer", "succeeded", "http-reviewer", "reviewer-default", "engine-session-reviewer", "2026-07-16T00:00:00.000Z", "2026-07-16T00:00:00.000Z",
  );
  db.prepare(`INSERT INTO runs (id, session_id, project_id, goal, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
    "run-http-other", "session-http", "project-http", "Other run", "running", "2026-07-17T00:00:00.000Z", "2026-07-17T00:00:00.000Z",
  );
  db.prepare(`INSERT INTO jobs (id, run_id, kind, status, idempotency_key, agent_spec_id, engine_session_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    "job-http-other", "run-http-other", "builder", "running", "http-other", "builder-default", "engine-session-other", "2026-07-17T00:00:00.000Z", "2026-07-17T00:00:00.000Z",
  );
  pumpSessionChannel(db, {
    type: "message.part.text.delta",
    run_id: "run-http-other",
    job_id: "job-http-other",
    kind: "builder",
    engine_session_id: "engine-session-other",
    is_permission_ask: false,
    properties: { delta: "other run must stay isolated" },
  });
  messageSnapshotHook = () => {
    db.prepare(`INSERT INTO jobs (id, run_id, kind, status, idempotency_key, agent_spec_id, engine_session_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      "job-http-replaced", "run-http", "builder", "running", "http-replaced", "builder-default", "engine-session-replaced", "2026-07-19T00:00:00.000Z", "2026-07-19T00:00:00.000Z",
    );
  };

  const controller = new AbortController();
  const response = await api("/api/sessions/session-http/attach", {
    method: "POST",
    body: JSON.stringify({ actor: "http-test", run_id: "run-http" }),
    headers: { accept: "text/event-stream" },
    signal: controller.signal,
  });
  assert.equal(response.status, 200);
  const reader = response.body!.getReader();
  let text = "";
  try {
    for (let reads = 0; reads < 6 && (!text.includes("event: transcript") || !text.includes("duplicate live delta")); reads += 1) {
      const next = await reader.read();
      if (next.done) break;
      text += new TextDecoder().decode(next.value);
    }
    assert.match(text, /event: transcript/);
    assert.match(text, /"stream_epoch":"[0-9a-f-]{36}"/);
    assert.match(text, /"engine_session_id":"engine-session-replaced"/);
    assert.doesNotMatch(text, /"engine_session_id":"engine-session-http-new"/);
    assert.doesNotMatch(text, /engine-session-reviewer/);
    assert.doesNotMatch(text, /engine-session-other/);
    assert.doesNotMatch(text, /other run must stay isolated/);
    assert.match(text, /snapshot question/);
    assert.match(text, /snapshot answer/);
    assert.match(text, /duplicate live delta/);
    assert.match(text, /"replay_from_seq":0/);
  } finally {
    controller.abort();
    await reader.cancel().catch(() => {});
  }

  pendingPermissionsResult = [{ id: "stale-permission" }];
  db.prepare(`UPDATE jobs SET updated_at = ? WHERE id = ?`).run("2026-07-18T00:00:00.000Z", "job-http-new");
  let releasePending!: () => void;
  pendingPermissionPause = new Promise<void>((resolve) => { releasePending = resolve; });
  const pendingEntered = new Promise<void>((resolve) => { pendingPermissionEntered = resolve; });
  const raceController = new AbortController();
  const raceResponse = await api("/api/sessions/session-http/attach", {
    method: "POST",
    body: JSON.stringify({ actor: "race-test" }),
    headers: { accept: "text/event-stream" },
    signal: raceController.signal,
  });
  const raceReader = raceResponse.body!.getReader();
  const firstRaceChunk = await raceReader.read();
  let raceText = new TextDecoder().decode(firstRaceChunk.value);
  await pendingEntered;
  const resolved = await api("/api/sessions/session-http/steer", {
    method: "POST",
    body: JSON.stringify({ type: "permission", request_id: "stale-permission", reply: "once", run_id: "run-http" }),
  });
  assert.equal(resolved.status, 202);
  releasePending();
  const nextRaceChunk = await Promise.race([
    raceReader.read(),
    new Promise<{ done: true; value?: Uint8Array }>((resolve) => setTimeout(() => resolve({ done: true }), 30)),
  ]);
  if (nextRaceChunk.value) raceText += new TextDecoder().decode(nextRaceChunk.value);
  assert.doesNotMatch(raceText, /stale-permission/);
  raceController.abort();
  await raceReader.cancel().catch(() => {});
});

test.after(async () => {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  db.close();
});
