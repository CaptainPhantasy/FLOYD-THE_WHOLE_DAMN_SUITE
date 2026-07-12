import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { Db } from "./db.ts";
import type { OpenCodeEngine } from "./engine.ts";
import { CORE_PORT, LOOPBACK, gatewayToken, nowIso, newId } from "./config.ts";
import { appendEvidence, listEvidence } from "./evidence.ts";
import { createRun, executeRun, decideRun, getRunDetail, readRunArtifact } from "./runs.ts";
import { getArtifact } from "./artifacts.ts";
import { recallMemory } from "./memory.ts";
import { normalizeEngineEvent, type SessionMap } from "./live-channel.ts";
import { classifyEngineEvent, SessionBuffer } from "./session-channel.ts";

const COCKPIT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "apps", "cockpit", "public");

type SseClient = { res: ServerResponse; run_id?: string };
const sseClients = new Set<SseClient>();

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
type SessionSseClient = { res: ServerResponse; session_id: string };
const sessionClients = new Set<SessionSseClient>();

function floydSessionOfRun(db: Db, runId: string): string | null {
  const r = db.prepare(`SELECT session_id FROM runs WHERE id = ?`).get(runId) as Record<string, unknown> | undefined;
  return r ? String(r.session_id) : null;
}

function writeSessionEvent(res: ServerResponse, seq: number, type: string, payload: unknown): boolean {
  try {
    res.write(`id: ${seq}\nevent: ${type}\ndata: ${JSON.stringify(payload)}\n\n`);
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
  const seq = sessionBuffer.append(floydSession, { type: cls.type, payload });
  for (const c of sessionClients) {
    if (c.session_id !== floydSession) continue;
    if (!writeSessionEvent(c.res, seq, cls.type, payload)) sessionClients.delete(c);
  }
}

/** Newest engine session able to receive steer/answers for a Floyd session. */
function activeEngineSession(db: Db, floydSessionId: string): { engine_session_id: string; job_id: string; run_id: string } | null {
  const row = db
    .prepare(
      `SELECT j.engine_session_id, j.id AS job_id, j.run_id FROM jobs j
       JOIN runs r ON r.id = j.run_id
       WHERE r.session_id = ? AND j.engine_session_id IS NOT NULL
       ORDER BY j.updated_at DESC LIMIT 1`,
    )
    .get(floydSessionId) as Record<string, unknown> | undefined;
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
  return raw ? JSON.parse(raw) : {};
}

function send(res: ServerResponse, code: number, body: unknown, mime = "application/json"): void {
  const out = mime === "application/json" ? JSON.stringify(body, null, 2) : String(body);
  res.writeHead(code, { "content-type": mime });
  res.end(out);
}

export function startGateway(db: Db, engine: OpenCodeEngine, corePid: number, startedAt: string): ReturnType<typeof createServer> {
  const token = gatewayToken();

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://${LOOPBACK}:${CORE_PORT}`);
    const path = url.pathname;

    // --- auth: loopback bind + bearer/query token (cockpit browser bootstrap) ---
    const auth = req.headers.authorization?.replace(/^Bearer\s+/i, "") ?? url.searchParams.get("token") ?? "";
    const isStatic = !path.startsWith("/api/");
    if (!isStatic && auth !== token) {
      return send(res, 401, { error: "unauthorized: missing/invalid gateway token" });
    }

    try {
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
        });
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
        if (isAttach) {
          const body = (await readBody(req).catch(() => ({}))) as { actor?: string };
          actor = body.actor ?? "anonymous";
          appendEvidence(db, "session.participant_attached", actor, { transport: "sse" }, { session_id: sessionId });
        }
        // Replay ONLY when the client supplies Last-Event-ID (contract §attach);
        // a fresh attach starts live — replaying history caused surfaces to act
        // on stale permission events (parity test finding, 2026-07-12).
        const lastRaw = req.headers["last-event-id"] ?? url.searchParams.get("lastEventId");
        const hasResume = lastRaw !== undefined && lastRaw !== null;
        const lastSeq = hasResume ? Number(Array.isArray(lastRaw) ? lastRaw[0] : lastRaw) || 0 : sessionBuffer.lastSeq(sessionId);
        res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache", connection: "keep-alive" });
        res.write(`event: hello\ndata: ${JSON.stringify({ session_id: sessionId, last_seq: sessionBuffer.lastSeq(sessionId), replay_from: lastSeq })}\n\n`);
        for (const e of sessionBuffer.since(sessionId, lastSeq)) {
          const rec = e.event as { type: string; payload: unknown };
          if (!writeSessionEvent(res, e.seq, rec.type, rec.payload)) break;
        }
        const client = { res, session_id: sessionId };
        sessionClients.add(client);
        req.on("close", () => sessionClients.delete(client));
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
        };
        const target = activeEngineSession(db, sessionId);
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
          appendEvidence(db, "engine.question.answered", actor, { request_id: body.request_id }, {
            session_id: sessionId, run_id: target.run_id, job_id: target.job_id,
          });
        } else if (body.type === "permission") {
          if (!body.request_id || !body.reply) return send(res, 400, { error: "request_id and reply required" });
          try {
            await engine.replyPermission(target.engine_session_id, body.request_id, body.reply);
          } catch (err) {
            return send(res, 410, { error: `permission request not pending (already decided or expired): ${String(err).slice(0, 120)}` });
          }
          appendEvidence(db, "policy.decision", actor, { request_id: body.request_id, decision: body.reply, source: "surface" }, {
            session_id: sessionId, run_id: target.run_id, job_id: target.job_id,
          });
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
        req.on("close", () => sseClients.delete(client));
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
        req.on("close", () => sseClients.delete(client));
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
      return send(res, 500, { error: String(err) });
    }
  });

  server.listen(CORE_PORT, LOOPBACK);
  return server;
}
