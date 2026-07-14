import { statSync, readFileSync, mkdirSync, chmodSync, existsSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

export const REPO_ROOT = join(HERE, "..", "..", "..");
export const RUNTIME_ROOT = process.env.FLOYD_RUNTIME_ROOT ?? "/Volumes/Storage/FLOYD_RUNTIME";

export const CORE_PORT = Number(process.env.FLOYD_CORE_PORT ?? 41414);
export const REMOTE_CORE_PORT = Number(process.env.FLOYD_REMOTE_CORE_PORT ?? 41416);
export const REMOTE_PUBLIC_ORIGIN = process.env.FLOYD_REMOTE_ORIGIN ?? "https://douglass-mac-mini.tail58d565.ts.net:8443";
export const ENGINE_PORT = Number(process.env.FLOYD_ENGINE_PORT ?? 41415);
export const LOOPBACK = "127.0.0.1";

export const PATHS = {
  coreDir: join(RUNTIME_ROOT, "core"),
  db: join(RUNTIME_ROOT, "core", "floyd.db"),
  gatewayToken: join(RUNTIME_ROOT, "core", "gateway.token"),
  experienceMasterKey: join(RUNTIME_ROOT, "core", "experience-master.key"),
  connectorMasterKey: join(RUNTIME_ROOT, "core", "connector-master.key"),
  artifacts: join(RUNTIME_ROOT, "artifacts"),
  worktrees: join(RUNTIME_ROOT, "worktrees"),
  projects: join(RUNTIME_ROOT, "projects"),
  engineHome: join(RUNTIME_ROOT, "engines", "opencode"),
  engineConfig: join(RUNTIME_ROOT, "engines", "opencode", "config", "opencode.json"),
  engineLog: join(RUNTIME_ROOT, "engines", "opencode", "serve.log"),
} as const;

export interface UpstreamLock {
  opencode: { version: string; binary_path: string; sha256: string };
}

export function readUpstreamLock(): UpstreamLock {
  return JSON.parse(readFileSync(join(REPO_ROOT, "upstream.lock"), "utf8")) as UpstreamLock;
}

/** Handoff requirement: runtime root ownership/mode checks on startup. Fail closed. */
export function verifyRuntimeRoot(): void {
  const st = statSync(RUNTIME_ROOT);
  if (!st.isDirectory()) throw new Error(`runtime root ${RUNTIME_ROOT} is not a directory`);
  if (typeof process.getuid === "function" && st.uid !== process.getuid()) {
    throw new Error(`runtime root ${RUNTIME_ROOT} not owned by current user (uid ${st.uid})`);
  }
  if ((st.mode & 0o077) !== 0) {
    throw new Error(`runtime root ${RUNTIME_ROOT} mode too open: ${(st.mode & 0o777).toString(8)} (need 0700)`);
  }
  for (const dir of [PATHS.coreDir, PATHS.artifacts, PATHS.worktrees, PATHS.projects]) {
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    chmodSync(dir, 0o700);
  }
}

/** Loopback gateway auth: private token, 0600, generated once. Never a provider key. */
export function gatewayToken(): string {
  if (!existsSync(PATHS.gatewayToken)) {
    writeFileSync(PATHS.gatewayToken, randomBytes(24).toString("hex"), { mode: 0o600 });
  }
  return readFileSync(PATHS.gatewayToken, "utf8").trim();
}

export function nowIso(): string {
  return new Date().toISOString();
}

let idCounter = 0;
export function newId(prefix: string): string {
  const t = Date.now().toString(36);
  const r = randomBytes(5).toString("hex");
  idCounter = (idCounter + 1) % 1296;
  return `${prefix}_${t}${idCounter.toString(36).padStart(2, "0")}${r}`;
}
