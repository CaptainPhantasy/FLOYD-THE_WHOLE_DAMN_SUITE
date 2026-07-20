#!/usr/bin/env node
/**
 * FLOYD Frame server — the single-surface shell host.
 * - Serves the frame UI (spring-loaded drawer + background stage).
 * - Owns interchangeable app processes declared in registry.json (nothing built in).
 * - Spawns dedicated TerminalOne instances whose shell IS the CLI app (ff / floydcode),
 *   so terminal apps present already open.
 * - Backgrounds: PNG served as-is, TIFF auto-converted once via macOS sips.
 * - Solo use: binds 127.0.0.1 by default; put Tailscale/tailserve in front for remote.
 */
import http from "node:http";
import { spawn, execFile } from "node:child_process";
import { createReadStream, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import net from "node:net";

const ROOT = dirname(fileURLToPath(import.meta.url));
const FRAME_DIR = resolve(ROOT, "..");
const PUBLIC_DIR = join(FRAME_DIR, "public");
const BACKGROUNDS_DIR = join(FRAME_DIR, "backgrounds");
const REGISTRY_PATH = join(FRAME_DIR, "registry.json");
const HOST = process.env.FRAME_HOST || "127.0.0.1";
const PORT = Number(process.env.FRAME_PORT || 13030);

// ---- managed process table -------------------------------------------------
// Every app the frame can own. Terminal apps get their own TerminalOne server
// whose SHELL is a wrapper that execs the CLI, so the frame shows it pre-open.
// All apps run from monorepo copies under intake/surfaces/ — originals
// elsewhere on disk are never touched by the frame.
const SURFACES = "/Volumes/Storage/FLOYD_WORKSTATION/intake/surfaces";
const PTY_COPY = join(SURFACES, "pty");
// One node for everything: homebrew node (native modules in the copies are
// built against it). No per-service pins.
const NODE_BIN = "/opt/homebrew/bin/node";
const WRAPPER_DIR = join(FRAME_DIR, "server", "shells");
mkdirSync(WRAPPER_DIR, { recursive: true });
mkdirSync(BACKGROUNDS_DIR, { recursive: true });

function wrapperFor(id, execLine) {
  const path = join(WRAPPER_DIR, `${id}.sh`);
  writeFileSync(path, `#!/bin/zsh\n# frame-managed shell for ${id} — TerminalOne spawns this as SHELL\nexec ${execLine}\n`, { mode: 0o755 });
  return path;
}

const MANAGED = {
  "cursem-ide": {
    port: 13020,
    cwd: join(SURFACES, "ide"),
    cmd: NODE_BIN, args: ["server/cursem-server.mjs"],
    env: {
      CURSEM_PORT: "13020",
      // Allow embedding ONLY by the frame's own origins (local + tailnet).
      CURSEM_FRAME_ANCESTORS: "http://127.0.0.1:13030 http://localhost:13030 http://floyd.localhost:13030 https://douglass-mac-mini.tail58d565.ts.net:8450 https://douglass-mac-mini.tail58d565.ts.net:10041",
    },
  },
  "floyd-desktop": {
    port: 13021,
    cwd: join(SURFACES, "desktop"),
    cmd: NODE_BIN, args: ["dist-server/index.js"],
    env: { PORT: "13021" },
  },
  "harness-launcher": {
    port: 11000,
    cwd: join(SURFACES, "launcher"),
    cmd: NODE_BIN, args: ["src/server.js"],
    env: { PORT: "11000", HOST: "127.0.0.1" },
  },
  "floyd-code-cli": {
    port: 13022,
    cwd: PTY_COPY,
    cmd: NODE_BIN, args: ["src/server.js"],
    env: () => ({ PORT: "13022", SHELL: wrapperFor("floyd-code-cli", "/Users/douglastalley/.local/bin/ff") }),
  },
  "ohmyfloyd": {
    port: 13023,
    cwd: PTY_COPY,
    cmd: NODE_BIN, args: ["src/server.js"],
    // Launch via the branding guard so upstream updates can't strip the Floyd
    // home screen: it re-applies customizations/ overlays, rebuilds if needed,
    // then execs floydcode.
    env: () => ({ PORT: "13023", SHELL: wrapperFor("ohmyfloyd", "/Volumes/SanDisk1Tb/OhMyFloyd/customizations/floydcode-launch.sh") }),
  },
  "terminalone": {
    port: 13013,
    cwd: PTY_COPY,
    cmd: NODE_BIN, args: ["src/server.js"],
    // Plain shell — no SHELL override, TerminalOne falls back to zsh.
    env: { PORT: "13013", TERMINALONE_ALLOWED_ORIGIN: "http://127.0.0.1:13013" },
  },
};

const children = new Map(); // id -> ChildProcess

function portOpen(port) {
  return new Promise((done) => {
    const sock = net.connect({ port, host: "127.0.0.1" });
    const finish = (up) => { sock.destroy(); done(up); };
    sock.once("connect", () => finish(true));
    sock.once("error", () => finish(false));
    sock.setTimeout(900, () => finish(false));
  });
}

async function ensureApp(id) {
  const spec = MANAGED[id];
  if (!spec) return { id, managed: false };
  if (await portOpen(spec.port)) return { id, managed: true, up: true, port: spec.port };
  if (!existsSync(spec.cwd)) return { id, managed: true, up: false, error: `missing cwd ${spec.cwd}` };
  const env = { ...process.env, ...(typeof spec.env === "function" ? spec.env() : spec.env) };
  const child = spawn(spec.cmd, spec.args, { cwd: spec.cwd, env, stdio: ["ignore", "pipe", "pipe"], detached: false });
  children.set(id, child);
  child.stdout.on("data", (d) => process.stdout.write(`[${id}] ${d}`));
  child.stderr.on("data", (d) => process.stderr.write(`[${id}] ${d}`));
  child.on("exit", (code) => { children.delete(id); console.log(`[frame] ${id} exited code=${code}`); });
  for (let i = 0; i < 40; i++) {
    if (await portOpen(spec.port)) return { id, managed: true, up: true, port: spec.port, started: true };
    await new Promise((r) => setTimeout(r, 250));
  }
  return { id, managed: true, up: false, error: "did not open its port within 10s" };
}

function openChrome(url) {
  const ext = "/Volumes/Storage/Floyd TTY Bridge for Chrome/extension";
  const args = ["-na", "Google Chrome", "--args", `--load-extension=${ext}`];
  if (url) args.splice(3, 0, url);
  return new Promise((done, fail) =>
    execFile("open", args, (err) => (err ? fail(err) : done(true))));
}

// ---- chrono sandbox bridge -------------------------------------------------
// Exposes the Python time-manipulation controller (ops/chrono/chrono_sandbox.py)
// per surface. Only surfaces that are git repos are eligible. The UI drives
// this through /api/chrono/<surface>/<op>.
const CHRONO_PY = "/opt/homebrew/bin/python3";
const CHRONO_CLI = "/Volumes/Storage/FLOYD_WORKSTATION/ops/chrono/chrono_sandbox.py";
const CHRONO_SURFACES = {
  ide: join(SURFACES, "ide"),
  desktop: join(SURFACES, "desktop"),
  launcher: join(SURFACES, "launcher"),
  pty: PTY_COPY,
  workstation: "/Volumes/Storage/FLOYD_WORKSTATION",
};
// op -> argv builder. Validation is strict: no free-form strings reach the CLI.
const CHRONO_OPS = {
  snapshot: (q) => ["snapshot", ...(q.message ? ["-m", q.message] : [])],
  rewind: (q) => ["rewind", ...(q.to ? ["--to", q.to] : []), ...(q.hard === "1" ? ["--hard"] : [])],
  fork: (q) => {
    const names = String(q.names || "").split(",").map((s) => s.trim()).filter(Boolean);
    if (!names.length || names.some((n) => !/^[\w-]{1,40}$/.test(n))) return null;
    return ["fork", ...names];
  },
  forks: () => ["forks"],
  diff: (q) => (/^[\w-]{1,40}$/.test(q.name || "") ? ["diff", q.name] : null),
  "merge-winner": (q) => (/^[\w-]{1,40}$/.test(q.name || "") ? ["merge-winner", q.name] : null),
  prune: (q) => (q.all === "1" ? ["prune", "--all"] : (/^[\w-]{1,40}$/.test(q.name || "") ? ["prune", q.name] : null)),
  ledger: (q) => ["ledger", "-n", String(Math.min(Number(q.n) || 20, 100))],
  log: () => null, // handled inline below (read-only git log)
};
function chronoRun(repo, argv) {
  return new Promise((done) => {
    execFile(CHRONO_PY, [CHRONO_CLI, repo, ...argv], { timeout: 60000, maxBuffer: 8 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (stdout) { try { return done(JSON.parse(stdout)); } catch {} }
      done({ ok: false, error: (stderr || String(err) || "chrono failed").slice(0, 500) });
    });
  });
}
function chronoLog(repo, n) {
  return new Promise((done) => {
    execFile("git", ["log", "--pretty=%h|%ad|%s", "--date=format:%H:%M:%S", `-${n}`], { cwd: repo, timeout: 15000 }, (err, stdout) => {
      if (err) return done({ ok: false, error: String(err).slice(0, 300) });
      done({ ok: true, commits: stdout.trim().split("\n").filter(Boolean).map((l) => { const [sha, time, ...s] = l.split("|"); return { sha, time, subject: s.join("|") }; }) });
    });
  });
}

// ---- http ------------------------------------------------------------------
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".svg": "image/svg+xml", ".tiff": "image/tiff", ".tif": "image/tiff" };
const json = (res, code, body) => { res.writeHead(code, { "content-type": "application/json" }); res.end(JSON.stringify(body)); };

function listBackgrounds() {
  return readdirSync(BACKGROUNDS_DIR)
    .filter((f) => /\.(png|jpe?g|webp|tiff?)$/i.test(f) && !f.startsWith("."))
    .sort();
}

/** TIFFs do not render in Chromium; convert once with sips and serve the PNG twin. */
function servableBackground(file) {
  if (!/\.tiff?$/i.test(file)) return join(BACKGROUNDS_DIR, file);
  const png = join(BACKGROUNDS_DIR, file.replace(/\.tiff?$/i, ".converted.png"));
  if (!existsSync(png)) {
    try {
      const r = spawn("sips", ["-s", "format", "png", join(BACKGROUNDS_DIR, file), "--out", png], { stdio: "ignore" });
      return new Promise((done) => r.on("exit", () => done(existsSync(png) ? png : join(BACKGROUNDS_DIR, file))));
    } catch { return join(BACKGROUNDS_DIR, file); }
  }
  return png;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname;
  try {
    if (path === "/api/registry") {
      res.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
      return res.end(readFileSync(REGISTRY_PATH));
    }
    if (path === "/api/status") {
      const registry = JSON.parse(readFileSync(REGISTRY_PATH, "utf8"));
      const out = {};
      for (const app of registry.apps) {
        const spec = MANAGED[app.id];
        out[app.id] = spec ? { managed: true, up: await portOpen(spec.port), port: spec.port } : { managed: false, up: null };
      }
      return json(res, 200, { apps: out, backgrounds: listBackgrounds() });
    }
    if (path === "/api/heartbeat" && req.method === "POST") {
      let body = ""; for await (const c of req) body += c;
      let apps = [];
      try { apps = JSON.parse(body).apps ?? []; } catch {}
      writeFileSync(join(ROOT, "heartbeat.json"), JSON.stringify({ ts: Date.now(), apps }));
      return json(res, 200, { ok: true });
    }
    if (path.startsWith("/api/launch/") && req.method === "POST") {
      const id = decodeURIComponent(path.slice("/api/launch/".length));
      return json(res, 200, await ensureApp(id));
    }
    if (path.startsWith("/api/quit/") && req.method === "POST") {
      const id = decodeURIComponent(path.slice("/api/quit/".length));
      const spec = MANAGED[id];
      if (!spec) return json(res, 404, { id, error: "not a managed app" });
      // Prefer our child handle; fall back to whoever owns the port (e.g. a
      // server that survived a frame restart).
      const child = children.get(id);
      if (child) { try { child.kill("SIGTERM"); } catch {} children.delete(id); }
      else {
        await new Promise((done) => {
          execFile("lsof", ["-nP", "-ti", `tcp:${spec.port}`, "-sTCP:LISTEN"], (err, stdout) => {
            const pid = Number((stdout || "").trim().split("\n")[0]);
            if (pid) { try { process.kill(pid, "SIGTERM"); } catch {} }
            done();
          });
        });
      }
      // Confirm the port actually closed (graceful shutdown can take a moment).
      for (let i = 0; i < 20; i++) {
        if (!(await portOpen(spec.port))) return json(res, 200, { id, quit: true });
        await new Promise((r) => setTimeout(r, 250));
      }
      return json(res, 200, { id, quit: false, error: "port still open after SIGTERM" });
    }
    // chrono sandbox: GET /api/chrono/surfaces | POST /api/chrono/<surface>/<op>?...
    if (path === "/api/chrono/surfaces" && req.method === "GET") {
      const out = {};
      for (const [name, repo] of Object.entries(CHRONO_SURFACES)) out[name] = { repo, git: existsSync(join(repo, ".git")) };
      return json(res, 200, { ok: true, surfaces: out });
    }
    if (path.startsWith("/api/chrono/")) {
      const [surface, op] = path.slice("/api/chrono/".length).split("/");
      const repo = CHRONO_SURFACES[surface];
      if (!repo) return json(res, 404, { ok: false, error: `unknown surface ${surface}` });
      if (!existsSync(join(repo, ".git"))) return json(res, 400, { ok: false, error: `${surface} is not a git repo` });
      const q = Object.fromEntries(url.searchParams);
      const readOnly = ["forks", "diff", "ledger", "log"].includes(op);
      if (!readOnly && req.method !== "POST") return json(res, 405, { ok: false, error: "mutating chrono ops require POST" });
      if (op === "log") return json(res, 200, await chronoLog(repo, Math.min(Number(q.n) || 15, 60)));
      const build = CHRONO_OPS[op];
      if (!build) return json(res, 404, { ok: false, error: `unknown op ${op}` });
      const argv = build(q);
      if (!argv) return json(res, 400, { ok: false, error: `invalid arguments for ${op}` });
      return json(res, 200, await chronoRun(repo, argv));
    }
    if (path === "/api/action/open-chrome" && req.method === "POST") {
      let body = ""; for await (const c of req) body += c;
      const target = body ? (JSON.parse(body).url ?? null) : null;
      await openChrome(target);
      return json(res, 200, { opened: true });
    }
    if (path === "/api/backgrounds" && req.method === "GET") return json(res, 200, { backgrounds: listBackgrounds() });
    if (path === "/api/backgrounds" && req.method === "POST") {
      const name = url.searchParams.get("name") || `bg-${Date.now()}.png`;
      if (!/^[\w. -]+\.(png|jpe?g|webp|tiff?)$/i.test(name)) return json(res, 400, { error: "png/jpg/webp/tiff only" });
      const chunks = []; for await (const c of req) chunks.push(c);
      writeFileSync(join(BACKGROUNDS_DIR, name), Buffer.concat(chunks));
      return json(res, 201, { saved: name });
    }
    if (path.startsWith("/backgrounds/")) {
      const file = decodeURIComponent(path.slice("/backgrounds/".length));
      if (!listBackgrounds().includes(file)) return json(res, 404, { error: "no such background" });
      const real = await servableBackground(file);
      res.writeHead(200, { "content-type": MIME[extname(real).toLowerCase()] || "application/octet-stream" });
      return createReadStream(real).pipe(res);
    }
    // static shell
    const file = path === "/" ? "index.html" : path.slice(1);
    const full = join(PUBLIC_DIR, file);
    if (!full.startsWith(PUBLIC_DIR) || !existsSync(full) || !statSync(full).isFile()) return json(res, 404, { error: "not found" });
    res.writeHead(200, { "content-type": MIME[extname(full).toLowerCase()] || "text/plain", "cache-control": "no-store" });
    return createReadStream(full).pipe(res);
  } catch (err) {
    return json(res, 500, { error: String(err) });
  }
});

server.listen(PORT, HOST, () => console.log(`[frame] FLOYD frame at http://${HOST}:${PORT}`));
process.on("SIGTERM", () => { for (const c of children.values()) c.kill(); process.exit(0); });
process.on("SIGINT", () => { for (const c of children.values()) c.kill(); process.exit(0); });
