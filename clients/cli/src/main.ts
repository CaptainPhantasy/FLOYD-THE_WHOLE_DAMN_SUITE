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
    fail(`Floyd Core is not running — verify launchd service com.floyd.core (launchctl list | grep com.floyd.core). Surfaces never start Core themselves.`);
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
  case "attach": {
    const [sessionId, lastId] = rest;
    if (!sessionId) fail("usage: floyd attach <session_id> [last_event_id]");
    const r = await fetch(`${CORE}/api/sessions/${sessionId}/attach`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token()}`,
        "content-type": "application/json",
        ...(lastId ? { "last-event-id": lastId } : {}),
      },
      body: JSON.stringify({ actor: "douglas-cli" }),
    });
    if (!r.ok || !r.body) fail(`attach failed: ${r.status}`);
    console.error(`[attached to ${sessionId}${lastId ? ` resuming after seq ${lastId}` : ""} — ctrl-c to stop]`);
    const reader = r.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    let curSeq = "";
    let curType = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        if (line.startsWith("id:")) curSeq = line.slice(3).trim();
        else if (line.startsWith("event:")) curType = line.slice(6).trim();
        else if (line.startsWith("data:")) {
          try {
            const e = JSON.parse(line.slice(5).trim()) as Record<string, unknown>;
            if (curType === "token") {
              const d = (e.data ?? {}) as Record<string, unknown>;
              process.stdout.write(String(d.delta ?? d.text ?? ""));
            } else if (curType === "hello") {
              console.error(`[hello last_seq=${(e as { last_seq?: number }).last_seq}]`);
            } else {
              const d = JSON.stringify(e.data ?? {}).slice(0, 160);
              console.log(`\n[seq ${curSeq}] ${String(e.kind ?? "")} ${curType} ${d}`);
              if (curType === "question") console.log(`  -> answer with: floyd answer ${sessionId} <request_id> <label>`);
              if (curType === "permission") console.log(`  -> decide with: floyd grant|deny ${sessionId} <request_id>`);
            }
          } catch { /* skip */ }
        }
      }
    }
    break;
  }
  case "say": {
    const [sessionId, ...text] = rest;
    if (!sessionId || text.length === 0) fail("usage: floyd say <session_id> <text...>");
    printJson(await api("POST", `/api/sessions/${sessionId}/steer`, { type: "steer", text: text.join(" "), actor: "douglas-cli" }));
    break;
  }
  case "answer": {
    const [sessionId, requestId, ...labels] = rest;
    if (!sessionId || !requestId || labels.length === 0) fail("usage: floyd answer <session_id> <request_id> <label...>");
    printJson(await api("POST", `/api/sessions/${sessionId}/steer`, { type: "answer", request_id: requestId, answers: [labels], actor: "douglas-cli" }));
    break;
  }
  case "grant":
  case "deny": {
    const [sessionId, requestId] = rest;
    if (!sessionId || !requestId) fail(`usage: floyd ${cmd} <session_id> <request_id>`);
    printJson(await api("POST", `/api/sessions/${sessionId}/steer`, { type: "permission", request_id: requestId, reply: cmd === "grant" ? "once" : "reject", actor: "douglas-cli" }));
    break;
  }
  case "watch": {
    const [runId] = rest;
    if (!runId) fail("usage: floyd watch <run_id>");
    const r = await fetch(`${CORE}/api/runs/${runId}/stream`, { headers: { authorization: `Bearer ${token()}` } });
    if (!r.ok || !r.body) fail(`stream unavailable: ${r.status}`);
    console.error(`[watching ${runId} — ctrl-c to stop]`);
    const reader = r.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        try {
          const e = JSON.parse(line.slice(5).trim()) as { type?: string; kind?: string; properties?: unknown };
          const detail = JSON.stringify(e.properties ?? {}).slice(0, 140);
          console.log(`${new Date().toISOString().slice(11, 19)} ${e.kind ?? "-"} ${e.type ?? "hello"} ${detail}`);
        } catch { /* skip */ }
      }
    }
    break;
  }
  case "steer": {
    const [runId, ...text] = rest;
    if (!runId || text.length === 0) fail("usage: floyd steer <run_id> <text...>");
    printJson(await api("POST", `/api/runs/${runId}/steer`, { text: text.join(" "), actor: "douglas-cli" }));
    break;
  }
  case "skills": {
    const s = (await api("GET", "/api/skills")) as { skills: unknown[] };
    printJson(s.skills);
    break;
  }
  case "skill": {
    const [name, version] = rest;
    if (!name) fail("usage: floyd skill <name> [version]");
    printJson(await api("GET", `/api/skills/${name}${version ? "/" + version : ""}`));
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
  floyd evidence [run_id]          evidence ledger
  floyd attach <session> [seq]     live bidirectional channel (resume w/ seq)
  floyd say <session> <text...>    steer the active turn
  floyd answer <session> <req> <label...>   answer a question event
  floyd grant|deny <session> <req> decide a permission event
  floyd watch <run>                run-scoped event stream
  floyd steer <run> <text...>      run-scoped steer (legacy)
  floyd memory <project_id>        recalled memory with provenance`);
}
