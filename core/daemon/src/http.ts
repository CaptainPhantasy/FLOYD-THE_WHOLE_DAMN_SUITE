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

const COCKPIT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "apps", "cockpit", "public");

type SseClient = { res: ServerResponse };
const sseClients = new Set<SseClient>();

export function broadcast(event: string, data: unknown): void {
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const c of sseClients) {
    try { c.res.write(msg); } catch { sseClients.delete(c); }
  }
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
