#!/usr/bin/env node
/**
 * floyd — CLI surface. A client of Floyd Core, never a second authority.
 * Attaches to the daemon; if the daemon is unreachable it says so and stops
 * (blueprint: never silently start a second authority).
 */
import { readFileSync } from "node:fs";

const RUNTIME_ROOT = process.env.FLOYD_RUNTIME_ROOT ?? "/Volumes/Storage/FLOYD_RUNTIME";
const CORE = `http://127.0.0.1:${process.env.FLOYD_CORE_PORT ?? 41414}`;

function token(): string {
  try {
    return readFileSync(`${RUNTIME_ROOT}/core/gateway.token`, "utf8").trim();
  } catch {
    fail(`cannot read gateway token under ${RUNTIME_ROOT}/core — is Floyd Core provisioned?`);
  }
}

function fail(msg: string): never {
  console.error(`floyd: ${msg}`);
  process.exit(1);
}

async function api(method: string, path: string, body?: unknown): Promise<unknown> {
  let r: Response;
  try {
    r = await fetch(`${CORE}${path}`, {
      method,
      headers: { authorization: `Bearer ${token()}`, ...(body ? { "content-type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    fail(`Floyd Core is not reachable at ${CORE}. Start it with: pnpm core (refusing to start a second authority from the CLI)`);
  }
  const text = await r.text();
  let data: unknown;
  try { data = JSON.parse(text); } catch { data = text; }
  if (!r.ok) fail(`${method} ${path} -> ${r.status}: ${typeof data === "string" ? data : JSON.stringify(data)}`);
  return data;
}

function printJson(v: unknown): void {
  console.log(typeof v === "string" ? v : JSON.stringify(v, null, 2));
}

const [cmd, ...rest] = process.argv.slice(2);

switch (cmd) {
  case "status": {
    printJson(await api("GET", "/api/health"));
    break;
  }
  case "state": {
    printJson(await api("GET", "/api/state"));
    break;
  }
  case "projects": {
    const s = (await api("GET", "/api/state")) as { projects: unknown[] };
    printJson(s.projects);
    break;
  }
  case "project-add": {
    const [name, root, ...testCmd] = rest;
    if (!name || !root) fail("usage: floyd project-add <name> <root_path> [test command...]");
    printJson(await api("POST", "/api/projects", { name, root_path: root, test_command: testCmd.length ? testCmd.join(" ") : undefined }));
    break;
  }
  case "submit": {
    const [projectId, ...goal] = rest;
    if (!projectId || goal.length === 0) fail("usage: floyd submit <project_id> <goal...>");
    printJson(await api("POST", "/api/runs", { project_id: projectId, goal: goal.join(" ") }));
    break;
  }
  case "run": {
    const [runId] = rest;
    if (!runId) fail("usage: floyd run <run_id>");
    printJson(await api("GET", `/api/runs/${runId}`));
    break;
  }
  case "diff": {
    const [runId] = rest;
    if (!runId) fail("usage: floyd diff <run_id>");
    printJson(await api("GET", `/api/runs/${runId}/artifact/diff`));
    break;
  }
  case "tests": {
    const [runId] = rest;
    if (!runId) fail("usage: floyd tests <run_id>");
    printJson(await api("GET", `/api/runs/${runId}/artifact/test_output`));
    break;
  }
  case "review": {
    const [runId] = rest;
    if (!runId) fail("usage: floyd review <run_id>");
    printJson(await api("GET", `/api/runs/${runId}/artifact/review`));
    break;
  }
  case "retry": {
    const [runId] = rest;
    if (!runId) fail("usage: floyd retry <run_id>");
    printJson(await api("POST", `/api/runs/${runId}/retry`));
    break;
  }
  case "accept":
  case "reject":
  case "escalate": {
    const [runId] = rest;
    if (!runId) fail(`usage: floyd ${cmd} <run_id>`);
    printJson(await api("POST", `/api/runs/${runId}/decision`, { action: cmd, actor: "douglas-cli" }));
    break;
  }
  case "memory": {
    const [projectId] = rest;
    if (!projectId) fail("usage: floyd memory <project_id>");
    printJson(await api("GET", `/api/memory?project_id=${encodeURIComponent(projectId)}`));
    break;
  }
  case "evidence": {
    const [runId] = rest;
    const q = runId ? `?run_id=${encodeURIComponent(runId)}` : "";
    printJson(await api("GET", `/api/evidence${q}`));
    break;
  }
  default:
    console.log(`floyd — Floyd Core CLI surface

usage:
  floyd status                     core + engine health
  floyd state                      projects/sessions/runs/jobs/leases
  floyd projects                   list projects
  floyd project-add <name> <root> [test cmd]
  floyd submit <project_id> <goal...>
  floyd run <run_id>               run detail (jobs, artifacts)
  floyd diff|tests|review <run_id> show run artifacts
  floyd accept|reject|escalate <run_id>
  floyd evidence [run_id]          evidence ledger`);
}
