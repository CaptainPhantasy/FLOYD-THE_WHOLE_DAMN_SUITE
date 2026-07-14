import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { Db } from "./db.ts";
import type { OpenCodeEngine } from "./engine.ts";
import { CORE_PORT, LOOPBACK, gatewayToken, nowIso, newId } from "./config.ts";
import { PATHS } from "./config.ts";
import { appendEvidence, listEvidence } from "./evidence.ts";
import { createRun, executeRun, decideRun, getRunDetail, readRunArtifact } from "./runs.ts";
import { getArtifact } from "./artifacts.ts";
import { recallMemory } from "./memory.ts";
import { listSkills, loadSkill, registerSkill } from "./skills.ts";
import { normalizeEngineEvent, type SessionMap } from "./live-channel.ts";
import { classifyEngineEvent, SessionBuffer } from "./session-channel.ts";
import { relayProviderRequest } from "./provider-gateway.ts";
import {
  ExperienceConflictError,
  getExperience,
  registerSurface,
  synchronizePendingInteractions,
  updateExperience,
} from "./experience.ts";
import { ExperienceSecurityError, ExperienceSecurityService } from "./experience-security.ts";
import type { ExperienceEnvelope, ExperienceEnvelopePatch, ExperienceNegotiationRequest } from "@floyd/contracts";

const COCKPIT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "apps", "cockpit", "public");
const BROWSER_SDK = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "packages", "sdk", "browser", "floyd-sdk.js");

type SseClient = { res: ServerResponse; run_id?: string };
const sseClients = new Set<SseClient>();

type ExperienceSseClient = { res: ServerResponse; envelope_id: string };
const experienceClients = new Set<ExperienceSseClient>();

function writeExperienceEvent(res: ServerResponse, envelope: ExperienceEnvelope): boolean {
  try {
    const writable = res.write(`id: ${envelope.revision}\nevent: experience\ndata: ${JSON.stringify(envelope)}\n\n`);
    if (!writable) res.destroy(new Error("experience stream backpressure limit reached"));
    return writable;
  } catch {
    return false;
  }
}

function broadcastExperience(envelope: ExperienceEnvelope): void {
  for (const client of experienceClients) {
    if (client.envelope_id !== envelope.id) continue;
    if (!writeExperienceEvent(client.res, envelope)) experienceClients.delete(client);
  }
}

export function broadcast(event: string, data: unknown, runId?: string): void {
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const c of sseClients) {
    if (runId && c.run_id && c.run_id !== runId) continue;
    if (!runId && c.run_id) continue; // run-scoped clients only get their run's events
    try { c.res.write(msg); } catch { sseClients.delete(c); }
  }
}

/** Engine-session → Floyd attribution, refreshed from the jobs table. */
export function loadSessionMap(db: Db): SessionMap {
  const rows = db
    .prepare(`SELECT engine_session_id, run_id, id, kind FROM jobs WHERE engine_session_id IS NOT NULL`)
    .all() as Array<Record<string, unknown>>;
  const map: SessionMap = new Map();
  for (const r of rows) {
    map.set(String(r.engine_session_id), { run_id: String(r.run_id), job_id: String(r.id), kind: String(r.kind) });
  }
  return map;
}

// ---------- bidirectional session channel (Objective 1) ----------

const sessionBuffer = new SessionBuffer(5000);
const sessionStreamEpoch = randomUUID();
type SessionSseClient = { res: ServerResponse; session_id: string; run_id?: string; buffer_key: string };
const sessionClients = new Set<SessionSseClient>();
const pendingInteractionVersions = new Map<string, number>();

function sessionBufferKey(sessionId: string, runId?: string): string {
  return runId ? `${sessionId}::${runId}` : `${sessionId}::*`;
}

function pendingInteractionVersion(sessionId: string, runId?: string): number {
  return pendingInteractionVersions.get(sessionBufferKey(sessionId, runId)) ?? 0;
}

function bumpPendingInteractionVersion(sessionId: string, runId: string): void {
  for (const key of [sessionBufferKey(sessionId, runId), sessionBufferKey(sessionId)]) {
    pendingInteractionVersions.set(key, (pendingInteractionVersions.get(key) ?? 0) + 1);
  }
}

function floydSessionOfRun(db: Db, runId: string): string | null {
  const r = db.prepare(`SELECT session_id FROM runs WHERE id = ?`).get(runId) as Record<string, unknown> | undefined;
  return r ? String(r.session_id) : null;
}

function writeSessionEvent(res: ServerResponse, seq: number, type: string, payload: unknown): boolean {
  try {
    if (!res.write(`id: ${seq}\nevent: ${type}\ndata: ${JSON.stringify(payload)}\n\n`)) {
      res.destroy();
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

function writeSessionSnapshotEvent(res: ServerResponse, type: string, payload: unknown): boolean {
  try {
    if (!res.write(`event: ${type}\ndata: ${JSON.stringify(payload)}\n\n`)) {
      res.destroy();
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/** Classify + sequence + fan out one attributed engine event to session subscribers. */
export function pumpSessionChannel(db: Db, out: ReturnType<typeof normalizeEngineEvent>): void {
  if (!out) return;
  const cls = classifyEngineEvent(out.type, out.properties);
  if (!cls) return;
  const floydSession = floydSessionOfRun(db, out.run_id);
  if (!floydSession) return;
  const payload = {
    type: cls.type,
    channel: cls.channel,
    run_id: out.run_id,
    job_id: out.job_id,
    kind: out.kind,
    engine_session_id: out.engine_session_id,
    engine_type: out.type,
    data: out.properties,
  };
  const aggregateSeq = sessionBuffer.append(sessionBufferKey(floydSession), { type: cls.type, payload });
  const runSeq = sessionBuffer.append(sessionBufferKey(floydSession, out.run_id), { type: cls.type, payload });
  for (const c of sessionClients) {
    if (c.session_id !== floydSession) continue;
    if (c.run_id && c.run_id !== out.run_id) continue;
    if (!writeSessionEvent(c.res, c.run_id ? runSeq : aggregateSeq, cls.type, payload)) sessionClients.delete(c);
  }
}

/**
 * Snapshot of interactive asks currently open on a Floyd session's active
 * engine session. A surface joining mid-run must see what's waiting for a human
 * even if the ask fired before it attached (cross-surface continuity).
 */
async function pendingAsksSnapshot(
  db: Db,
  engine: OpenCodeEngine,
  floydSessionId: string,
  runId?: string,
): Promise<{
  asks: Array<{ type: "permission" | "question"; payload: unknown }>;
  complete: boolean;
  engine_session_id: string | null;
  interaction_version: number;
}> {
  const interactionVersion = pendingInteractionVersion(floydSessionId, runId);
  const target = activeEngineSession(db, floydSessionId, runId);
  if (!target) return { asks: [], complete: true, engine_session_id: null, interaction_version: interactionVersion };
  const attribution = { run_id: target.run_id, job_id: target.job_id, kind: "builder", engine_session_id: target.engine_session_id };
  const out: Array<{ type: "permission" | "question"; payload: unknown }> = [];
  let complete = true;
  try {
    for (const p of await engine.pendingPermissions(target.engine_session_id)) {
      out.push({ type: "permission", payload: { type: "permission", ...attribution, engine_type: "snapshot.permission", data: p } });
    }
  } catch { complete = false; }
  try {
    const qs = (await engine.pendingQuestions(target.engine_session_id)) as Array<Record<string, unknown>>;
    for (const q of qs) {
      out.push({ type: "question", payload: { type: "question", ...attribution, engine_type: "snapshot.question", data: q } });
    }
  } catch { complete = false; }
  return { asks: out, complete, engine_session_id: target.engine_session_id, interaction_version: interactionVersion };
}

async function synchronizeEnvelopePendingForSession(db: Db, engine: OpenCodeEngine, sessionId: string, runId: string): Promise<void> {
  const snapshot = await pendingAsksSnapshot(db, engine, sessionId, runId);
  if (!snapshot.complete) return;
  if (pendingInteractionVersion(sessionId, runId) !== snapshot.interaction_version) return;
  const target = activeEngineSession(db, sessionId, runId);
  if (target?.engine_session_id !== snapshot.engine_session_id) return;
  const pendingQuestions = snapshot.asks.filter((ask) => ask.type === "question").map((ask) => ask.payload);
  const pendingPermissions = snapshot.asks.filter((ask) => ask.type === "permission").map((ask) => ask.payload);
  const rows = db.prepare(`SELECT id FROM experience_envelopes`).all() as Array<{ id: string }>;
  for (const row of rows) {
    let envelope = getExperience(db, row.id);
    if (envelope.active.session_id !== sessionId || envelope.active.run_id !== runId) continue;
    if (JSON.stringify(pendingQuestions) === JSON.stringify(envelope.pending_questions)
      && JSON.stringify(pendingPermissions) === JSON.stringify(envelope.pending_permissions)) continue;
    envelope = synchronizePendingInteractions(db, row.id, envelope.revision, pendingQuestions, pendingPermissions);
    broadcastExperience(envelope);
  }
}

/** Newest engine session able to receive steer/answers for a Floyd session. */
function activeEngineSession(db: Db, floydSessionId: string, runId?: string): { engine_session_id: string; job_id: string; run_id: string } | null {
  const row = runId
    ? db.prepare(
      `SELECT j.engine_session_id, j.id AS job_id, j.run_id FROM jobs j
       JOIN runs r ON r.id = j.run_id
       WHERE r.session_id = ? AND j.run_id = ? AND j.kind = 'builder' AND j.engine_session_id IS NOT NULL
       ORDER BY j.updated_at DESC LIMIT 1`,
    ).get(floydSessionId, runId) as Record<string, unknown> | undefined
    : db.prepare(
      `SELECT j.engine_session_id, j.id AS job_id, j.run_id FROM jobs j
       JOIN runs r ON r.id = j.run_id
       WHERE r.session_id = ? AND j.kind = 'builder' AND j.engine_session_id IS NOT NULL
       ORDER BY j.updated_at DESC LIMIT 1`,
    ).get(floydSessionId) as Record<string, unknown> | undefined;
  return row
    ? { engine_session_id: String(row.engine_session_id), job_id: String(row.job_id), run_id: String(row.run_id) }
    : null;
}

/** Wire the engine's /event stream into Floyd-attributed SSE broadcasts. */
export function startLiveChannel(db: Db, engine: OpenCodeEngine): { stop: () => void } {
  return engine.subscribeEvents((evt) => {
    const out = normalizeEngineEvent(evt, loadSessionMap(db));
    if (!out) return;
    broadcast("engine", out, out.run_id);
    pumpSessionChannel(db, out);
    const sessionId = floydSessionOfRun(db, out.run_id);
    if (sessionId && out.type.includes("asked") && (out.type.includes("question") || out.type.includes("permission"))) {
      bumpPendingInteractionVersion(sessionId, out.run_id);
      void synchronizeEnvelopePendingForSession(db, engine, sessionId, out.run_id).catch((error) => {
        appendEvidence(db, "experience.pending_sync_failed", "floyd-core", { error: String(error) }, { session_id: sessionId, run_id: out.run_id });
      });
    }
    if (out.is_permission_ask) {
      appendEvidence(db, "engine.permission_ask_observed", "floyd-core", { event: out.type, properties: out.properties }, {
        run_id: out.run_id,
        job_id: out.job_id,
      });
    }
  });
}

async function readBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const ch of req) chunks.push(ch as Buffer);
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    throw new RequestJsonError();
  }
}

class RequestJsonError extends Error {
  constructor() { super("request body is not valid JSON"); }
}

function send(res: ServerResponse, code: number, body: unknown, mime = "application/json"): void {
  const out = mime === "application/json" ? JSON.stringify(body, null, 2) : String(body);
  res.writeHead(code, { "content-type": mime });
  res.end(out);
}

export function startGateway(db: Db, engine: OpenCodeEngine, corePid: number, startedAt: string): ReturnType<typeof createServer> {
  const token = gatewayToken();
  const selfAuthAttempts = new Map<string, { windowStarted: number; count: number }>();
  const experienceSecurity = new ExperienceSecurityService(db, {
    masterKeyPath: PATHS.experienceMasterKey,
    evidence: (event) => appendEvidence(db, event.type, event.actor, event.payload),
  });

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://${LOOPBACK}:${CORE_PORT}`);
    const path = url.pathname;

    // /gateway reserves Authorization and x-api-key for the upstream provider,
    // so local Core authentication uses a distinct header on that route.
    const isProviderGateway = path === "/gateway";
    if (isProviderGateway && req.headers.origin) {
      let allowedOrigin = "";
      try {
        const origin = new URL(req.headers.origin);
        if (["localhost", "127.0.0.1", "::1"].includes(origin.hostname)) allowedOrigin = origin.origin;
      } catch { /* malformed or opaque origin remains denied */ }
      if (!allowedOrigin) return send(res, 403, { error: "gateway CORS permits loopback origins only" });
      res.setHeader("access-control-allow-origin", allowedOrigin);
      res.setHeader("vary", "origin");
      if (req.method === "OPTIONS") {
        res.writeHead(204, {
          "access-control-allow-methods": "POST, OPTIONS",
          "access-control-allow-headers": "content-type, authorization, x-api-key, anthropic-version, x-floyd-token, x-floyd-provider, x-floyd-base-url",
          "access-control-max-age": "600",
        });
        return res.end();
      }
    }
    const gatewayAuth = Array.isArray(req.headers["x-floyd-token"])
      ? req.headers["x-floyd-token"][0]
      : req.headers["x-floyd-token"];
    const auth = isProviderGateway
      ? gatewayAuth ?? ""
      : req.headers.authorization?.replace(/^Bearer\s+/i, "") ?? "";
    const isStatic = !path.startsWith("/api/") && !isProviderGateway;
    const selfAuthenticating = req.method === "POST"
      && (path === "/api/devices/authenticate" || path === "/api/handoffs/consume");
    if (selfAuthenticating) {
      if (req.headers.origin) {
        try {
          const origin = new URL(req.headers.origin);
          if (!["localhost", "127.0.0.1", "::1"].includes(origin.hostname)) {
            return send(res, 403, { error: "self-authentication permits loopback origins only" });
          }
        } catch {
          return send(res, 403, { error: "self-authentication origin is invalid" });
        }
      }
      const now = Date.now();
      const key = `${req.socket.remoteAddress ?? "unknown"}:${path}`;
      const prior = selfAuthAttempts.get(key);
      const attempt = !prior || now - prior.windowStarted >= 60_000
        ? { windowStarted: now, count: 1 }
        : { ...prior, count: prior.count + 1 };
      selfAuthAttempts.set(key, attempt);
      const limit = path === "/api/devices/authenticate" ? 8 : 30;
      if (attempt.count > limit) return send(res, 429, { error: "self-authentication rate limit exceeded" });
    }
    if (!isStatic && !selfAuthenticating && auth !== token) {
      return send(res, 401, { error: "unauthorized: missing/invalid gateway token" });
    }

    try {
      if (isProviderGateway) {
        if (req.method !== "POST") return send(res, 405, { error: "gateway is POST" });
        await relayProviderRequest(req, res);
        return;
      }
      // ---------- API ----------
      if (path === "/api/health") {
        return send(res, 200, {
          ok: true,
          service: "floyd-core",
          version: "0.1.0",
          pid: corePid,
          started_at: startedAt,
          now: nowIso(),
          engine: { ok: await engine.isHealthy(), url: engine.baseUrl, pid: engine.child?.pid ?? null },
        });
      }
      if (path === "/api/state") {
        return send(res, 200, {
          projects: db.prepare(`SELECT * FROM projects`).all(),
          sessions: db.prepare(`SELECT * FROM sessions`).all(),
          runs: db.prepare(`SELECT * FROM runs ORDER BY created_at DESC LIMIT 50`).all(),
          jobs: db.prepare(`SELECT id, run_id, kind, status, engine_session_id, worktree_lease_id, created_at, updated_at FROM jobs ORDER BY created_at DESC LIMIT 100`).all(),
          leases: db.prepare(`SELECT * FROM leases ORDER BY acquired_at DESC LIMIT 50`).all(),
          provider_profiles: db.prepare(`SELECT id, vendor, billing_class, plan_name, region, credential_ref, approved FROM provider_profiles`).all(),
          experience: getExperience(db),
        });
      }
      // ---------- portable cross-surface experience ----------
      if (path === "/api/experience/negotiate" && req.method === "POST") {
        const body = (await readBody(req)) as ExperienceNegotiationRequest & { envelope_id?: string; device_id?: string | null };
        if (body.device_id !== undefined) {
          return send(res, 400, { error: "device attribution requires a device-scoped session credential" });
        }
        const envelopeId = body.envelope_id ?? "primary";
        const request: ExperienceNegotiationRequest = {
          surface_id: body.surface_id,
          sdk_version: body.sdk_version,
          supported_envelope_versions: body.supported_envelope_versions,
          capabilities: body.capabilities,
        };
        let current = getExperience(db, envelopeId);
        let result;
        try {
          result = registerSurface(db, envelopeId, { ...request, expected_revision: current.revision, device_id: body.device_id ?? null });
        } catch (error) {
          if (!(error instanceof ExperienceConflictError)) throw error;
          current = getExperience(db, envelopeId);
          result = registerSurface(db, envelopeId, { ...request, expected_revision: current.revision, device_id: body.device_id ?? null });
        }
        if (!result.negotiation.accepted) {
          return send(res, 426, { error: "sdk_upgrade_required", ...result.negotiation });
        }
        broadcastExperience(result.envelope);
        return send(res, 200, result.negotiation);
      }
      const experienceMatch = path.match(/^\/api\/experience\/([^/]+)(?:\/(stream))?$/);
      if (experienceMatch) {
        const envelopeId = decodeURIComponent(experienceMatch[1] ?? "");
        if (experienceMatch[2] === "stream") {
          if (req.method !== "GET") return send(res, 405, { error: "experience stream is GET" });
          const envelope = getExperience(db, envelopeId);
          const lastRaw = req.headers["last-event-id"] ?? url.searchParams.get("lastEventId");
          const lastRevision = Number(Array.isArray(lastRaw) ? lastRaw[0] : lastRaw) || 0;
          res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache", connection: "keep-alive" });
          res.write(`event: hello\ndata: ${JSON.stringify({ envelope_id: envelopeId, revision: envelope.revision })}\n\n`);
          if (lastRevision < envelope.revision && !writeExperienceEvent(res, envelope)) return;
          const client = { res, envelope_id: envelopeId };
          experienceClients.add(client);
          res.on("close", () => experienceClients.delete(client));
          return;
        }
        if (req.method === "GET") {
          let envelope = getExperience(db, envelopeId);
          const sessionId = envelope.active.session_id;
          const runId = envelope.active.run_id ?? undefined;
          const snapshot = sessionId
            ? await pendingAsksSnapshot(db, engine, sessionId, runId)
            : { asks: [], complete: true, engine_session_id: null, interaction_version: 0 };
          // Re-read after the provider calls: another surface may have changed
          // the active session or revision while the snapshot was in flight.
          envelope = getExperience(db, envelopeId);
          const currentTarget = sessionId ? activeEngineSession(db, sessionId, runId) : null;
          if (sessionId && snapshot.complete && envelope.active.session_id === sessionId
            && envelope.active.run_id === (runId ?? null)
            && pendingInteractionVersion(sessionId, runId) === snapshot.interaction_version
            && currentTarget?.engine_session_id === snapshot.engine_session_id) {
            const pendingQuestions = snapshot.asks.filter((ask) => ask.type === "question").map((ask) => ask.payload);
            const pendingPermissions = snapshot.asks.filter((ask) => ask.type === "permission").map((ask) => ask.payload);
            if (JSON.stringify(pendingQuestions) !== JSON.stringify(envelope.pending_questions)
              || JSON.stringify(pendingPermissions) !== JSON.stringify(envelope.pending_permissions)) {
              envelope = synchronizePendingInteractions(db, envelopeId, envelope.revision, pendingQuestions, pendingPermissions);
              broadcastExperience(envelope);
            }
          }
          return send(res, 200, envelope);
        }
        if (req.method === "PATCH") {
          const raw = await readBody(req);
          if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
            return send(res, 400, { error: "experience patch must be a JSON object" });
          }
          const rawPatch = raw as Record<string, unknown>;
          if ("pending_questions" in rawPatch || "pending_permissions" in rawPatch) {
            return send(res, 400, { error: "pending questions and permissions are Core-owned" });
          }
          if ("device_id" in rawPatch) {
            return send(res, 400, { error: "device attribution requires a device-scoped session credential" });
          }
          const patch = rawPatch as unknown as ExperienceEnvelopePatch;
          try {
            const envelope = updateExperience(db, envelopeId, patch, { actor: "surface:http", device_id: patch.device_id });
            broadcastExperience(envelope);
            return send(res, 200, envelope);
          } catch (error) {
            if (error instanceof ExperienceConflictError) {
              const envelope = getExperience(db, envelopeId);
              return send(res, 409, {
                error: "revision_conflict",
                expected_revision: patch.expected_revision,
                actual_revision: envelope.revision,
                envelope,
              });
            }
            throw error;
          }
        }
        return send(res, 405, { error: "experience envelope supports GET and PATCH" });
      }
      // Device enrollment remains Core-token protected. Authentication and
      // handoff consumption are still loopback-only until private HTTPS remote
      // attach is enabled; never expose this listener on a public interface.
      if (path === "/api/devices/enroll" && req.method === "POST") {
        const body = (await readBody(req)) as { metadata?: Record<string, unknown>; device_id?: string };
        const enrolled = await experienceSecurity.enrollDevice(body.metadata ?? {}, body.device_id);
        return send(res, 201, {
          device_id: enrolled.deviceId,
          secret: enrolled.secret,
          created_at: enrolled.createdAt,
          key_id: enrolled.keyId,
        });
      }
      if (path === "/api/devices/authenticate" && req.method === "POST") {
        const body = (await readBody(req)) as { device_id?: string; secret?: string };
        if (!body.device_id || !body.secret) return send(res, 400, { error: "device_id and secret required" });
        const authenticated = await experienceSecurity.authenticateDevice(body.device_id, body.secret);
        return send(res, 200, {
          device_id: authenticated.deviceId,
          metadata: authenticated.metadata,
          authenticated_at: authenticated.authenticatedAt,
        });
      }
      if (path.match(/^\/api\/devices\/[^/]+$/) && req.method === "DELETE") {
        const deviceId = decodeURIComponent(path.split("/")[3] ?? "");
        return experienceSecurity.revokeDevice(deviceId)
          ? send(res, 200, { device_id: deviceId, revoked: true })
          : send(res, 404, { error: "no active device" });
      }
      if (path === "/api/handoffs" && req.method === "POST") {
        const body = (await readBody(req)) as { envelope_id?: string; envelope_revision?: number; created_by_device_id?: string; ttl_ms?: number };
        const envelope = getExperience(db, body.envelope_id ?? "primary");
        const revision = body.envelope_revision ?? envelope.revision;
        if (revision !== envelope.revision) {
          return send(res, 409, { error: "revision_conflict", expected_revision: revision, actual_revision: envelope.revision, envelope });
        }
        const issued = experienceSecurity.issueHandoff({
          envelopeId: envelope.id,
          envelopeRevision: revision,
          createdByDeviceId: body.created_by_device_id,
          ttlMs: body.ttl_ms,
        });
        return send(res, 201, {
          handoff_id: issued.handoffId,
          token: issued.token,
          envelope_id: issued.envelopeId,
          envelope_revision: issued.envelopeRevision,
          expires_at: issued.expiresAt,
          deep_link: issued.deepLink,
          deep_link_payload: {
            version: issued.deepLinkPayload.version,
            handoff_id: issued.deepLinkPayload.handoffId,
            token: issued.deepLinkPayload.token,
            envelope_id: issued.deepLinkPayload.envelopeId,
            envelope_revision: issued.deepLinkPayload.envelopeRevision,
          },
        });
      }
      if (path === "/api/handoffs/consume" && req.method === "POST") {
        const body = (await readBody(req)) as { token?: string; device_id?: string; device_secret?: string };
        if (!body.token || !body.device_id || !body.device_secret) {
          return send(res, 400, { error: "token, device_id, and device_secret required" });
        }
        await experienceSecurity.authenticateDevice(body.device_id, body.device_secret);
        const consumed = experienceSecurity.consumeHandoff(body.token, body.device_id, (envelopeId, envelopeRevision) => {
          const row = db.prepare(`SELECT revision FROM experience_envelopes WHERE id = ?`).get(envelopeId) as { revision: number } | undefined;
          if (!row || Number(row.revision) !== envelopeRevision) {
            throw new ExperienceSecurityError(
              "handoff_stale",
              `handoff authorized ${envelopeId} revision ${envelopeRevision}, which is no longer current`,
              409,
            );
          }
        });
        return send(res, 200, {
          handoff_id: consumed.handoffId,
          envelope_id: consumed.envelopeId,
          envelope_revision: consumed.envelopeRevision,
          created_by_device_id: consumed.createdByDeviceId,
          consumed_at: consumed.consumedAt,
          envelope: getExperience(db, consumed.envelopeId),
        });
      }
      if (path.match(/^\/api\/handoffs\/[^/]+$/) && req.method === "DELETE") {
        const handoffId = decodeURIComponent(path.split("/")[3] ?? "");
        return experienceSecurity.revokeHandoff(handoffId)
          ? send(res, 200, { handoff_id: handoffId, revoked: true })
          : send(res, 404, { error: "no active handoff" });
      }
      if (path === "/api/skills" && req.method === "GET") {
        return send(res, 200, { skills: listSkills(db) });
      }
      if (path === "/api/skills" && req.method === "POST") {
        const b = (await readBody(req)) as { name?: string; version?: string; body?: string; permissions?: string[] };
        if (!b.name || !b.version || !b.body) return send(res, 400, { error: "name, version, body required" });
        return send(res, 201, registerSkill(db, { name: b.name, version: b.version, body: b.body, permissions: b.permissions ?? [] }));
      }
      if (path.startsWith("/api/skills/") && req.method === "GET") {
        const parts = path.split("/");
        const sk = loadSkill(db, parts[3] ?? "", parts[4]);
        return sk ? send(res, 200, sk) : send(res, 404, { error: "no such skill/version" });
      }
      if (path === "/api/memory") {
        const project_id = url.searchParams.get("project_id") ?? "";
        return send(res, 200, { items: recallMemory(db, project_id) });
      }
      if (path === "/api/evidence") {
        const run_id = url.searchParams.get("run_id") ?? undefined;
        return send(res, 200, { events: listEvidence(db, { run_id, limit: 500 }) });
      }
      // ---------- bidirectional session channel (Objective 1) ----------
      if (path.match(/^\/api\/sessions\/[^/]+\/(events|attach)$/)) {
        const sessionId = path.split("/")[3] ?? "";
        const isAttach = path.endsWith("/attach");
        if (isAttach && req.method !== "POST") return send(res, 405, { error: "attach is POST" });
        if (!isAttach && req.method !== "GET") return send(res, 405, { error: "events is GET" });
        if (!db.prepare(`SELECT id FROM sessions WHERE id = ?`).get(sessionId)) {
          return send(res, 404, { error: "no such session" });
        }
        let actor = "anonymous";
        let runId = url.searchParams.get("run_id") ?? undefined;
        if (isAttach) {
          const body = (await readBody(req).catch(() => ({}))) as { actor?: string; run_id?: string };
          actor = body.actor ?? "anonymous";
          runId = body.run_id ?? runId;
        }
        if (runId) {
          const scopedRun = db.prepare(`SELECT id FROM runs WHERE id = ? AND session_id = ?`).get(runId, sessionId);
          if (!scopedRun) return send(res, 404, { error: "run does not belong to session" });
        }
        if (isAttach) {
          appendEvidence(db, "session.participant_attached", actor, { transport: "sse" }, { session_id: sessionId, run_id: runId });
        }
        const bufferKey = sessionBufferKey(sessionId, runId);
        // Resume replays the bounded run-scoped event buffer. A fresh attach
        // receives the durable provider transcript, then only events that
        // arrived while that transcript snapshot was in flight.
        const lastRaw = req.headers["last-event-id"] ?? url.searchParams.get("lastEventId");
        const hasResume = lastRaw !== undefined && lastRaw !== null;
        const lastSeq = hasResume ? Number(Array.isArray(lastRaw) ? lastRaw[0] : lastRaw) || 0 : sessionBuffer.lastSeq(bufferKey);
        res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache", connection: "keep-alive" });
        let clientClosed = false;
        let client: SessionSseClient | null = null;
        res.on("close", () => {
          clientClosed = true;
          if (client) sessionClients.delete(client);
        });
        if (!writeSessionSnapshotEvent(res, "hello", {
          session_id: sessionId,
          run_id: runId ?? null,
          stream_epoch: sessionStreamEpoch,
          last_seq: sessionBuffer.lastSeq(bufferKey),
          replay_from: lastSeq,
        })) return;
        let transcriptEngineSessionId: string | null = null;
        if (isAttach && !hasResume) {
          // A fresh surface needs the durable conversation, not only events
          // emitted after it connected.
          let target = activeEngineSession(db, sessionId, runId);
          if (target) {
            let transcriptWritten = false;
            for (let attempt = 0; attempt < 2 && target && !transcriptWritten; attempt += 1) {
              const snapshotTarget: { engine_session_id: string; job_id: string; run_id: string } = target;
              try {
                const messages = await engine.messages(snapshotTarget.engine_session_id);
                if (clientClosed || res.destroyed) return;
                const currentTarget = activeEngineSession(db, sessionId, runId);
                if (currentTarget?.engine_session_id !== snapshotTarget.engine_session_id) {
                  target = currentTarget;
                  continue;
                }
                if (!writeSessionEvent(res, lastSeq, "transcript", {
                  session_id: sessionId,
                  engine_session_id: snapshotTarget.engine_session_id,
                  replay_from_seq: lastSeq,
                  messages,
                })) return;
                transcriptEngineSessionId = snapshotTarget.engine_session_id;
                transcriptWritten = true;
              } catch (error) {
                if (clientClosed || res.destroyed) return;
                const currentTarget = activeEngineSession(db, sessionId, runId);
                if (currentTarget?.engine_session_id !== snapshotTarget.engine_session_id && attempt === 0) {
                  target = currentTarget;
                  continue;
                }
                if (!writeSessionSnapshotEvent(res, "transcript", {
                  session_id: sessionId,
                  engine_session_id: snapshotTarget.engine_session_id,
                  messages: [],
                  unavailable: String(error),
                })) return;
                transcriptWritten = true;
              }
            }
            if (!transcriptWritten && !clientClosed && !res.destroyed) {
              if (!writeSessionSnapshotEvent(res, "transcript", {
                session_id: sessionId,
                engine_session_id: target?.engine_session_id ?? null,
                messages: [],
                unavailable: "builder changed repeatedly during transcript snapshot",
              })) return;
            }
          }
        }
        for (const e of sessionBuffer.since(bufferKey, lastSeq)) {
          const rec = e.event as { type: string; payload: unknown };
          const payloadEngineSessionId = typeof rec.payload === "object" && rec.payload && "engine_session_id" in rec.payload
            ? String(rec.payload.engine_session_id)
            : null;
          if (isAttach && !hasResume && transcriptEngineSessionId && payloadEngineSessionId
            && payloadEngineSessionId !== transcriptEngineSessionId) continue;
          if (!writeSessionEvent(res, e.seq, rec.type, rec.payload)) return;
        }
        if (clientClosed || res.destroyed) return;
        client = { res, session_id: sessionId, run_id: runId, buffer_key: bufferKey };
        sessionClients.add(client);
        // continuity: replay any interactive asks currently open, so a surface
        // that joined after the ask fired still sees what needs a human.
        void pendingAsksSnapshot(db, engine, sessionId, runId).then((snapshot) => {
          if (clientClosed || res.destroyed || !snapshot.complete) return;
          if (pendingInteractionVersion(sessionId, runId) !== snapshot.interaction_version) return;
          const currentTarget = activeEngineSession(db, sessionId, runId);
          if (currentTarget?.engine_session_id !== snapshot.engine_session_id) return;
          for (const a of snapshot.asks) {
            if (!writeSessionSnapshotEvent(res, a.type, a.payload)) break;
          }
        }).catch(() => {});
        return;
      }
      if (path.match(/^\/api\/sessions\/[^/]+\/steer$/) && req.method === "POST") {
        const sessionId = path.split("/")[3] ?? "";
        const body = (await readBody(req)) as {
          type?: "steer" | "answer" | "permission";
          text?: string;
          request_id?: string;
          answers?: string[][];
          reply?: "once" | "always" | "reject";
          actor?: string;
          run_id?: string;
        };
        if (body.run_id && !db.prepare(`SELECT id FROM runs WHERE id = ? AND session_id = ?`).get(body.run_id, sessionId)) {
          return send(res, 404, { error: "run does not belong to session" });
        }
        const target = activeEngineSession(db, sessionId, body.run_id);
        if (!target) return send(res, 409, { error: "session has no engine session to receive input" });
        const actor = body.actor ?? "anonymous";
        if (body.type === "steer") {
          if (!body.text) return send(res, 400, { error: "text required for steer" });
          await engine.steer(target.engine_session_id, body.text);
          appendEvidence(db, "engine.steer.submitted", actor, { chars: body.text.length, text: body.text.slice(0, 500) }, {
            session_id: sessionId, run_id: target.run_id, job_id: target.job_id,
          });
        } else if (body.type === "answer") {
          if (!body.request_id) return send(res, 400, { error: "request_id required for answer" });
          const answers = body.answers ?? (body.text ? [[body.text]] : null);
          if (!answers) return send(res, 400, { error: "answers or text required" });
          try {
            await engine.replyQuestion(target.engine_session_id, body.request_id, answers);
          } catch (err) {
            return send(res, 410, { error: `question request not pending: ${String(err).slice(0, 120)}` });
          }
          bumpPendingInteractionVersion(sessionId, target.run_id);
          appendEvidence(db, "engine.question.answered", actor, { request_id: body.request_id }, {
            session_id: sessionId, run_id: target.run_id, job_id: target.job_id,
          });
          await synchronizeEnvelopePendingForSession(db, engine, sessionId, target.run_id);
        } else if (body.type === "permission") {
          if (!body.request_id || !body.reply) return send(res, 400, { error: "request_id and reply required" });
          try {
            await engine.replyPermission(target.engine_session_id, body.request_id, body.reply);
          } catch (err) {
            return send(res, 410, { error: `permission request not pending (already decided or expired): ${String(err).slice(0, 120)}` });
          }
          bumpPendingInteractionVersion(sessionId, target.run_id);
          appendEvidence(db, "policy.decision", actor, { request_id: body.request_id, decision: body.reply, source: "surface" }, {
            session_id: sessionId, run_id: target.run_id, job_id: target.job_id,
          });
          await synchronizeEnvelopePendingForSession(db, engine, sessionId, target.run_id);
        } else {
          return send(res, 400, { error: "type must be steer | answer | permission" });
        }
        return send(res, 202, { session_id: sessionId, type: body.type, delivered_to: target.engine_session_id });
      }
      if (path.match(/^\/api\/runs\/[^/]+\/stream$/) && req.method === "GET") {
        const runId = path.split("/")[3] ?? "";
        if (!db.prepare(`SELECT id FROM runs WHERE id = ?`).get(runId)) return send(res, 404, { error: "no such run" });
        res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache", connection: "keep-alive" });
        res.write(`event: hello\ndata: ${JSON.stringify({ run_id: runId })}\n\n`);
        const client = { res, run_id: runId };
        sseClients.add(client);
        res.on("close", () => sseClients.delete(client));
        return;
      }
      if (path.startsWith("/api/runs/") && req.method === "GET") {
        const parts = path.split("/");
        const runId = parts[3] ?? "";
        if (parts[4] === "artifact") {
          const role = parts[5] ?? "diff";
          const content = readRunArtifact(db, runId, role);
          if (content === null) return send(res, 404, { error: "no such artifact role" });
          return send(res, 200, content, "text/plain; charset=utf-8");
        }
        const detail = getRunDetail(db, runId);
        return detail ? send(res, 200, detail) : send(res, 404, { error: "no such run" });
      }
      if (path === "/api/runs" && req.method === "POST") {
        const body = (await readBody(req)) as { project_id?: string; goal?: string };
        if (!body.project_id || !body.goal) return send(res, 400, { error: "project_id and goal required" });
        const created = createRun(db, body.project_id, body.goal);
        if (!created.duplicate) {
          broadcast("run", { run_id: created.run_id, status: "created" });
          // async execution; failures land in evidence + run status
          executeRun(db, engine, created.run_id)
            .then(() => broadcast("run", { run_id: created.run_id, status: "waiting_review" }))
            .catch((err) => {
              db.prepare(`UPDATE runs SET status='failed', updated_at=? WHERE id=?`).run(nowIso(), created.run_id);
              appendEvidence(db, "run.failed", "floyd-core", { error: String(err) }, { run_id: created.run_id });
              broadcast("run", { run_id: created.run_id, status: "failed" });
            });
        }
        return send(res, created.duplicate ? 200 : 202, created);
      }
      if (path.match(/^\/api\/runs\/[^/]+\/retry$/) && req.method === "POST") {
        const runId = path.split("/")[3] ?? "";
        const run = db.prepare(`SELECT status FROM runs WHERE id = ?`).get(runId) as Record<string, unknown> | undefined;
        if (!run) return send(res, 404, { error: "no such run" });
        if (!["created", "failed", "interrupted"].includes(String(run.status))) {
          return send(res, 409, { error: `run is ${String(run.status)}; retry only for created/failed/interrupted` });
        }
        appendEvidence(db, "run.retry", "floyd-core", { prior_status: run.status }, { run_id: runId });
        executeRun(db, engine, runId)
          .then(() => broadcast("run", { run_id: runId, status: "waiting_review" }))
          .catch((err) => {
            db.prepare(`UPDATE runs SET status='failed', updated_at=? WHERE id=?`).run(nowIso(), runId);
            appendEvidence(db, "run.failed", "floyd-core", { error: String(err) }, { run_id: runId });
            broadcast("run", { run_id: runId, status: "failed" });
          });
        return send(res, 202, { run_id: runId, retrying: true });
      }
      if (path.match(/^\/api\/runs\/[^/]+\/decision$/) && req.method === "POST") {
        const runId = path.split("/")[3] ?? "";
        const body = (await readBody(req)) as { action?: "accept" | "reject" | "escalate"; actor?: string };
        if (!body.action) return send(res, 400, { error: "action required" });
        const result = decideRun(db, engine, runId, body.action, body.actor ?? "douglas");
        broadcast("run", { run_id: runId, status: body.action });
        return send(res, 200, result);
      }
      if (path === "/api/projects" && req.method === "POST") {
        const body = (await readBody(req)) as { name?: string; root_path?: string; test_command?: string };
        if (!body.name || !body.root_path) return send(res, 400, { error: "name and root_path required" });
        const id = newId("prj");
        db.prepare(
          `INSERT INTO projects (id, name, root_path, repo_path, test_command, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
        ).run(id, body.name, body.root_path, body.root_path, body.test_command ?? "node --test", nowIso());
        appendEvidence(db, "project.registered", "floyd-core", { name: body.name, root_path: body.root_path }, { project_id: id });
        return send(res, 201, { id });
      }
      if (path.startsWith("/api/artifacts/")) {
        const id = path.split("/")[3] ?? "";
        const art = getArtifact(db, id);
        if (!art) return send(res, 404, { error: "no such artifact" });
        return send(res, 200, art.content.toString("utf8"), String(art.meta.mime ?? "text/plain"));
      }
      if (path === "/api/events") {
        res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache", connection: "keep-alive" });
        res.write(`event: hello\ndata: {"service":"floyd-core"}\n\n`);
        const client = { res };
        sseClients.add(client);
        res.on("close", () => sseClients.delete(client));
        return;
      }
      if (path.match(/^\/api\/runs\/[^/]+\/steer$/) && req.method === "POST") {
        const runId = path.split("/")[3] ?? "";
        const body = (await readBody(req)) as { text?: string; actor?: string };
        if (!body.text) return send(res, 400, { error: "text required" });
        const builder = db
          .prepare(`SELECT id, engine_session_id, status FROM jobs WHERE run_id = ? AND kind = 'builder'`)
          .get(runId) as Record<string, unknown> | undefined;
        if (!builder?.engine_session_id) return send(res, 409, { error: "run has no active builder engine session" });
        await engine.steer(String(builder.engine_session_id), body.text);
        appendEvidence(db, "engine.steer.submitted", body.actor ?? "douglas", { chars: body.text.length, text: body.text.slice(0, 500) }, {
          run_id: runId,
          job_id: String(builder.id),
        });
        broadcast("engine", { type: "floyd.steer.submitted", run_id: runId, job_id: String(builder.id), kind: "builder", properties: { text: body.text } }, runId);
        return send(res, 202, { run_id: runId, steered: true });
      }

      // ---------- cockpit static ----------
      if (isStatic) {
        if (path === "/floyd-sdk.js") {
          return send(res, 200, readFileSync(BROWSER_SDK, "utf8"), "text/javascript; charset=utf-8");
        }
        const file = path === "/" ? "index.html" : path.slice(1);
        const full = join(COCKPIT_DIR, file);
        if (!full.startsWith(COCKPIT_DIR)) return send(res, 403, { error: "forbidden" });
        if (existsSync(full)) {
          const mime = file.endsWith(".html") ? "text/html; charset=utf-8" : file.endsWith(".js") ? "text/javascript" : "text/plain";
          return send(res, 200, readFileSync(full, "utf8"), mime);
        }
        return send(res, 404, { error: "not found" });
      }
      return send(res, 404, { error: "not found" });
    } catch (err) {
      if (res.headersSent || res.destroyed) {
        res.destroy(err instanceof Error ? err : new Error(String(err)));
        return;
      }
      const status = err instanceof ExperienceSecurityError
        ? err.httpStatus
        : err instanceof RequestJsonError ? 400
        : typeof err === "object" && err && "statusCode" in err ? Number(err.statusCode) : 500;
      const body = err instanceof ExperienceSecurityError
        ? { error: err.code, message: err.message }
        : err instanceof RequestJsonError ? { error: "invalid_json", message: err.message }
        : { error: String(err) };
      return send(res, Number.isInteger(status) && status >= 400 && status <= 599 ? status : 500, body);
    }
  });

  server.listen(CORE_PORT, LOOPBACK);
  return server;
}
