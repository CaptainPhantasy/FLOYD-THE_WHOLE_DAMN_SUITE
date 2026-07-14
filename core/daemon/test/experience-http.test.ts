import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import { createServer } from "node:http";

const runtimeRoot = mkdtempSync(join(tmpdir(), "floyd-experience-http-"));
process.env.FLOYD_RUNTIME_ROOT = runtimeRoot;
process.env.FLOYD_CORE_PORT = "0";
process.env.FLOYD_REMOTE_CORE_PORT = "0";
process.env.FLOYD_REMOTE_ORIGIN = "https://floyd.test";
mkdirSync(join(runtimeRoot, "core"), { recursive: true, mode: 0o700 });

const { openDb } = await import("../src/db.ts");
const { gatewayToken } = await import("../src/config.ts");
const { startGateway, startRemoteGateway, pumpSessionChannel } = await import("../src/http.ts");
const { synchronizePendingInteractions } = await import("../src/experience.ts");
const { putArtifact, linkRunArtifact } = await import("../src/artifacts.ts");

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
const remoteServer = startRemoteGateway(db, engine, process.pid, new Date().toISOString());
if (!server.listening) await once(server, "listening");
if (!remoteServer.listening) await once(remoteServer, "listening");
const address = server.address();
if (!address || typeof address === "string") throw new Error("HTTP test server did not bind TCP");
const baseUrl = `http://127.0.0.1:${address.port}`;
const remoteAddress = remoteServer.address();
if (!remoteAddress || typeof remoteAddress === "string") throw new Error("remote HTTP test server did not bind TCP");
const remotePort = remoteAddress.port;
const remoteBaseUrl = `http://127.0.0.1:${remotePort}`;
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

async function remoteApi(path: string, token: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${remoteBaseUrl}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...init.headers,
    },
  });
}

async function remoteSelfAuthenticatedPost(path: string, body: unknown, origin = "https://floyd.test"): Promise<Response> {
  return fetch(`${remoteBaseUrl}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", origin },
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

  const hostileOrigin = await remoteSelfAuthenticatedPost(
    "/api/devices/authenticate",
    { device_id: device.device_id, secret: device.secret },
    "https://attacker.test",
  );
  assert.equal(hostileOrigin.status, 403);

  const authenticated = await remoteSelfAuthenticatedPost("/api/devices/authenticate", { device_id: device.device_id, secret: device.secret });
  assert.equal(authenticated.status, 200);
  const authenticatedBody = await authenticated.json() as { metadata: unknown; session: { token: string; scopes: string[] } };
  assert.deepEqual(authenticatedBody.metadata, { surface: "test" });
  assert.deepEqual(authenticatedBody.session.scopes, ["health:read"]);
  assert.equal((await remoteApi("/api/health", authenticatedBody.session.token)).status, 200);
  assert.equal((await remoteApi("/api/state", authenticatedBody.session.token)).status, 403);
  assert.equal((await remoteApi("/api/experience/primary", authenticatedBody.session.token)).status, 403);
  assert.equal((await remoteApi("/api/connectors", authenticatedBody.session.token)).status, 403);
  assert.equal((await remoteApi("/gateway", authenticatedBody.session.token, { method: "POST" })).status, 401);

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
  const handoff = await issue.json() as { token: string; deep_link: string; qr_svg: string; qr_content_type: string };
  assert.match(handoff.deep_link, /^https:\/\/floyd\.test\/#handoff=/);
  assert.equal(handoff.qr_content_type, "image/svg+xml");
  assert.match(handoff.qr_svg, /<svg/);
  assert.equal(handoff.qr_svg.includes(handoff.token), false);

  const consumed = await remoteSelfAuthenticatedPost("/api/handoffs/consume", {
    token: handoff.token,
    device_id: device.device_id,
    device_secret: device.secret,
  });
  assert.equal(consumed.status, 200);
  const consumedBody = await consumed.json() as { envelope: { id: string; revision: number }; session: { token: string; resources: { envelope_ids: string[] } } };
  assert.equal(consumedBody.envelope.id, "primary");
  assert.equal(consumedBody.envelope.revision, envelope.revision);
  assert.deepEqual(consumedBody.session.resources.envelope_ids, ["primary"]);
  assert.equal((await remoteApi("/api/experience/primary", consumedBody.session.token)).status, 200);
  const remoteState = await remoteApi("/api/state", consumedBody.session.token);
  assert.equal(remoteState.status, 200);
  const remoteStateText = await remoteState.text();
  const remoteStateBody = JSON.parse(remoteStateText) as { experience: { model_route: { credential_ref?: unknown } } };
  assert.equal(remoteStateBody.experience.model_route.credential_ref ?? null, null);
  assert.equal(remoteStateText.includes("floyd-connector:"), false);
  assert.equal(remoteStateText.includes("root_path"), false);
  const escapedActive = await remoteApi("/api/experience/primary", consumedBody.session.token, {
    method: "PATCH",
    body: JSON.stringify({ expected_revision: envelope.revision, active: { project_id: "project-outside-grant", session_id: null, run_id: null } }),
  });
  assert.equal(escapedActive.status, 403);
  const escapedModel = await remoteApi("/api/experience/primary", consumedBody.session.token, {
    method: "PATCH",
    body: JSON.stringify({ expected_revision: envelope.revision, model_route: { provider_profile_id: "outside" } }),
  });
  assert.equal(escapedModel.status, 403);
  assert.equal((await remoteApi("/api/experience/other", consumedBody.session.token)).status, 403);
  const logout = await remoteApi("/api/device-sessions/current", consumedBody.session.token, { method: "DELETE" });
  assert.equal(logout.status, 200);
  assert.equal((await remoteApi("/api/experience/primary", consumedBody.session.token)).status, 401);

  const replay = await selfAuthenticatedPost("/api/handoffs/consume", {
    token: handoff.token,
    device_id: device.device_id,
    device_secret: device.secret,
  });
  assert.equal(replay.status, 409);
  assert.equal((await replay.json() as { error: string }).error, "handoff_consumed");

  const beforeStale = await (await api("/api/experience/primary")).json() as { revision: number; selected_view: string };
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
  assert.equal(staleConsume.status, 200);
  const snapshotConsumption = await staleConsume.json() as { envelope: { revision: number; selected_view: string } };
  assert.equal(snapshotConsumption.envelope.revision, beforeStale.revision);
  assert.equal(snapshotConsumption.envelope.selected_view, beforeStale.selected_view);

  const pairBase = await (await api("/api/experience/primary")).json() as { revision: number };
  const pairIssue = await api("/api/handoffs", {
    method: "POST",
    body: JSON.stringify({ envelope_id: "primary", envelope_revision: pairBase.revision, ttl_ms: 30_000 }),
  });
  const pairGrant = await pairIssue.json() as { handoff_id: string; token: string };
  const pairToken = pairGrant.token;
  const missingOriginPair = await fetch(`${remoteBaseUrl}/api/handoffs/pair`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token: pairToken }),
  });
  assert.equal(missingOriginPair.status, 403);
  const loopbackOriginPair = await remoteSelfAuthenticatedPost("/api/handoffs/pair", { token: pairToken }, "http://127.0.0.1");
  assert.equal(loopbackOriginPair.status, 403);
  const paired = await remoteSelfAuthenticatedPost("/api/handoffs/pair", { token: pairToken });
  assert.equal(paired.status, 200);
  const pairCookie = paired.headers.get("set-cookie") ?? "";
  assert.match(pairCookie, /__Host-floyd_session=/);
  assert.match(pairCookie, /HttpOnly/);
  assert.match(pairCookie, /Secure/);
  assert.match(pairCookie, /SameSite=Strict/);
  const pairedText = await paired.text();
  assert.equal(pairedText.includes("fds_"), false);
  const pairedBody = JSON.parse(pairedText) as { session: { session_id: string; device_id: string } };
  const recoveredPair = await remoteSelfAuthenticatedPost("/api/handoffs/pair", { token: pairToken });
  assert.equal(recoveredPair.status, 200);
  const recoveredBody = await recoveredPair.json() as { session: { session_id: string; device_id: string } };
  assert.deepEqual(recoveredBody.session, pairedBody.session);
  const closeRecoveryWindow = await api(`/api/handoffs/${pairGrant.handoff_id}`, { method: "DELETE" });
  assert.equal(closeRecoveryWindow.status, 200);
  const revokedPairRetry = await remoteSelfAuthenticatedPost("/api/handoffs/pair", { token: pairToken });
  assert.equal(revokedPairRetry.status, 410);
  assert.equal((await revokedPairRetry.json() as { error: string }).error, "handoff_revoked");
  const cookieState = await fetch(`${remoteBaseUrl}/api/state`, { headers: { cookie: pairCookie.split(";")[0]! } });
  assert.equal(cookieState.status, 200);

  const malformedCookie = await fetch(`${remoteBaseUrl}/api/state`, {
    headers: { cookie: "__Host-floyd_session=%ZZ" },
  });
  assert.equal(malformedCookie.status, 401);

  const invalidPairBody = await remoteSelfAuthenticatedPost("/api/handoffs/pair", null);
  assert.equal(invalidPairBody.status, 400);
  assert.equal((await invalidPairBody.json() as { error: string }).error, "invalid_input");

  const priorQrBinary = process.env.FLOYD_QRENCODE_BIN;
  process.env.FLOYD_QRENCODE_BIN = join(runtimeRoot, "missing-qrencode");
  const failedQrIssue = await api("/api/handoffs", {
    method: "POST",
    body: JSON.stringify({ envelope_id: "primary", envelope_revision: pairBase.revision }),
  });
  if (priorQrBinary === undefined) delete process.env.FLOYD_QRENCODE_BIN;
  else process.env.FLOYD_QRENCODE_BIN = priorQrBinary;
  assert.equal(failedQrIssue.status, 503);
  const failedQrRow = db.prepare(`SELECT revoked_at FROM experience_handoffs ORDER BY rowid DESC LIMIT 1`).get() as { revoked_at: string | null };
  assert.notEqual(failedQrRow.revoked_at, null);

  const currentEnvelope = await (await api("/api/experience/primary")).json() as { revision: number };
  const streamIssue = await api("/api/handoffs", {
    method: "POST",
    body: JSON.stringify({ envelope_id: "primary", envelope_revision: currentEnvelope.revision }),
  });
  const streamHandoff = await streamIssue.json() as { token: string };
  const streamConsume = await remoteSelfAuthenticatedPost("/api/handoffs/consume", {
    token: streamHandoff.token,
    device_id: device.device_id,
    device_secret: device.secret,
  });
  const streamSession = await streamConsume.json() as { session: { token: string } };
  const streamResponse = await remoteApi("/api/experience/primary/stream", streamSession.session.token, {
    headers: { accept: "text/event-stream" },
  });
  assert.equal(streamResponse.status, 200);
  const streamReader = streamResponse.body!.getReader();
  assert.equal((await streamReader.read()).done, false);
  const revokedDevice = await api(`/api/devices/${encodeURIComponent(device.device_id)}`, { method: "DELETE" });
  assert.equal(revokedDevice.status, 200);
  const closed = await Promise.race([
    (async () => {
      for (let read = 0; read < 5; read += 1) {
        try {
          if ((await streamReader.read()).done) return true;
        } catch {
          return true;
        }
      }
      return false;
    })(),
    new Promise<false>((resolve) => setTimeout(() => resolve(false), 500)),
  ]);
  assert.equal(closed, true);
  assert.equal((await remoteApi("/api/experience/primary", streamSession.session.token)).status, 403);
});

test("HTTP connector authority keeps secrets opaque and injects only endpoint-bound references", async () => {
  let upstreamAuthorization = "";
  const upstream = createServer(async (req, res) => {
    upstreamAuthorization = req.headers.authorization ?? "";
    for await (const _chunk of req) { /* drain */ }
    res.writeHead(200, { "content-type": "application/json" });
    res.end('{"connector":"ok"}');
  });
  upstream.listen(0, "127.0.0.1");
  await once(upstream, "listening");
  const upstreamAddress = upstream.address();
  if (!upstreamAddress || typeof upstreamAddress === "string") throw new Error("connector upstream did not bind");
  const apiKey = "connector-http-secret-value";
  try {
    const malformed = await api("/api/connectors", { method: "POST", body: "null" });
    assert.equal(malformed.status, 400);
    assert.equal((await malformed.json() as { error: string }).error, "invalid_input");

    const created = await api("/api/connectors", {
      method: "POST",
      body: JSON.stringify({
        id: "http-openai",
        displayName: "HTTP OpenAI",
        provider: "openai",
        baseUrl: `http://127.0.0.1:${upstreamAddress.port}/v1`,
      }),
    });
    assert.equal(created.status, 201);
    assert.equal(created.headers.get("cache-control"), "no-store");
    assert.doesNotMatch(await created.clone().text(), /secret/i);

    const stored = await api("/api/connectors/http-openai/api-key", {
      method: "POST",
      body: JSON.stringify({ apiKey }),
    });
    assert.equal(stored.status, 201);
    const storedBody = await stored.json() as { credentialRef: string };
    assert.equal(storedBody.credentialRef, "floyd-connector:http-openai");

    const listed = await api("/api/connectors");
    const listedText = await listed.text();
    assert.equal(listed.status, 200);
    assert.equal(listed.headers.get("cache-control"), "no-store");
    assert.doesNotMatch(listedText, new RegExp(apiKey));
    assert.match(listedText, /floyd-connector:http-openai/);

    const gateway = await fetch(`${baseUrl}/gateway`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-floyd-token": gatewayToken(),
        "x-floyd-provider": "openai",
        "x-floyd-credential-ref": storedBody.credentialRef,
      },
      body: JSON.stringify({ model: "gpt-test", messages: [{ role: "user", content: "hello" }], stream: false }),
    });
    assert.equal(gateway.status, 200);
    assert.equal(await gateway.text(), '{"connector":"ok"}');
    assert.equal(upstreamAuthorization, `Bearer ${apiKey}`);

    const ambiguous = await fetch(`${baseUrl}/gateway`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-floyd-token": gatewayToken(),
        "x-floyd-credential-ref": storedBody.credentialRef,
        authorization: "Bearer attacker-substitute",
      },
      body: JSON.stringify({ model: "gpt-test", messages: [], stream: false }),
    });
    assert.equal(ambiguous.status, 400);
    assert.equal((await ambiguous.json() as { error: string }).error, "credential_ambiguous");
  } finally {
    await new Promise<void>((resolve, reject) => upstream.close((error) => error ? reject(error) : resolve()));
  }
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

  const readerEnrollment = await api("/api/devices/enroll", {
    method: "POST",
    body: JSON.stringify({
      device_id: "device-run-reader",
      metadata: { surface: "bounded-continuation" },
      allowed_scopes: ["health:read", "state:read", "experience:read", "experience:write", "run:read", "artifact:read"],
    }),
  });
  const readerDevice = await readerEnrollment.json() as { device_id: string; secret: string };
  const boundEnvelope = await (await api("/api/experience/primary")).json() as { revision: number };
  const readerIssue = await api("/api/handoffs", {
    method: "POST",
    body: JSON.stringify({ envelope_id: "primary", envelope_revision: boundEnvelope.revision }),
  });
  const readerHandoff = await readerIssue.json() as { token: string };
  const readerConsume = await remoteSelfAuthenticatedPost("/api/handoffs/consume", {
    token: readerHandoff.token,
    device_id: readerDevice.device_id,
    device_secret: readerDevice.secret,
  });
  const readerSession = await readerConsume.json() as { session: { token: string; scopes: string[] } };
  assert.equal(readerSession.session.scopes.includes("run:read"), true);
  assert.equal(readerSession.session.scopes.includes("artifact:read"), true);
  const lateArtifact = putArtifact(db, "created after handoff", "text/plain", "late artifact");
  linkRunArtifact(db, "run-http", "job-http", lateArtifact, "late");
  assert.equal((await remoteApi("/api/runs/run-http", readerSession.session.token)).status, 200);
  assert.equal((await remoteApi("/api/runs/run-http/artifact/late", readerSession.session.token)).status, 403);
  assert.equal((await remoteApi(`/api/artifacts/${lateArtifact}`, readerSession.session.token)).status, 403);
  const filteredState = await remoteApi("/api/state", readerSession.session.token);
  assert.equal(filteredState.status, 200);
  const filtered = await filteredState.json() as { projects: Array<{ id: string }>; sessions: Array<{ id: string }>; runs: Array<{ id: string }>; leases: unknown[] };
  assert.deepEqual(filtered.projects.map((item) => item.id), ["project-http"]);
  assert.deepEqual(filtered.sessions.map((item) => item.id), ["session-http"]);
  assert.deepEqual(filtered.runs.map((item) => item.id), ["run-http"]);
  assert.deepEqual(filtered.leases, []);
  const contextStreamResponse = await remoteApi("/api/experience/primary/stream", readerSession.session.token, {
    headers: { accept: "text/event-stream" },
  });
  const contextStreamReader = contextStreamResponse.body!.getReader();
  assert.equal((await contextStreamReader.read()).done, false);
  const beforeMove = await (await api("/api/experience/primary")).json() as { revision: number };
  const remoteBeforeMove = await (await remoteApi("/api/experience/primary", readerSession.session.token)).json() as { revision: number };
  const remoteClear = await remoteApi("/api/experience/primary", readerSession.session.token, {
    method: "PATCH",
    body: JSON.stringify({ expected_revision: remoteBeforeMove.revision, active: { project_id: null, session_id: null, run_id: null } }),
  });
  assert.equal(remoteClear.status, 403);
  const afterDeniedClear = await (await api("/api/experience/primary")).json() as { revision: number; active: { run_id: string | null } };
  assert.equal(afterDeniedClear.revision, beforeMove.revision);
  assert.equal(afterDeniedClear.active.run_id, "run-http");
  const moveAway = await api("/api/experience/primary", {
    method: "PATCH",
    body: JSON.stringify({ expected_revision: beforeMove.revision, active: { project_id: null, session_id: null, run_id: null } }),
  });
  assert.equal(moveAway.status, 200);
  const snapshotStateResponse = await remoteApi("/api/state", readerSession.session.token);
  assert.equal(snapshotStateResponse.status, 200);
  const snapshotState = await snapshotStateResponse.json() as { experience: { active: { run_id: string } } };
  assert.equal(snapshotState.experience.active.run_id, "run-http");
  const snapshotEnvelopeResponse = await remoteApi("/api/experience/primary", readerSession.session.token);
  assert.equal(snapshotEnvelopeResponse.status, 200);
  const snapshotEnvelope = await snapshotEnvelopeResponse.json() as { revision: number; active: { run_id: string } };
  assert.equal(snapshotEnvelope.active.run_id, "run-http");
  const contextStreamStayedOpen = await Promise.race([
    contextStreamReader.read().then(() => false, () => false),
    new Promise<true>((resolve) => setTimeout(() => resolve(true), 100)),
  ]);
  assert.equal(contextStreamStayedOpen, true);
  await contextStreamReader.cancel();
  const remoteDraft = await remoteApi("/api/experience/primary", readerSession.session.token, {
    method: "PATCH",
    body: JSON.stringify({ expected_revision: snapshotEnvelope.revision, composer_draft: "session-local continuation" }),
  });
  const remoteDraftText = await remoteDraft.text();
  assert.equal(remoteDraft.status, 200, remoteDraftText);
  const globalAfterRemoteDraft = await (await api("/api/experience/primary")).json() as { composer_draft: string };
  assert.notEqual(globalAfterRemoteDraft.composer_draft, "session-local continuation");
  const movedEnvelope = await moveAway.json() as { revision: number };
  const restoreBound = await api("/api/experience/primary", {
    method: "PATCH",
    body: JSON.stringify({ expected_revision: movedEnvelope.revision, active: { project_id: "project-http", session_id: "session-http", run_id: "run-http" } }),
  });
  assert.equal(restoreBound.status, 200);
});

test.after(async () => {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  await new Promise<void>((resolve, reject) => remoteServer.close((error) => error ? reject(error) : resolve()));
  db.close();
});
