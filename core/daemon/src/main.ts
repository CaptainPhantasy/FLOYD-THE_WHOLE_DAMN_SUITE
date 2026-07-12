import { verifyRuntimeRoot, nowIso, CORE_PORT, LOOPBACK, PATHS } from "./config.ts";
import { openDb } from "./db.ts";
import { OpenCodeEngine } from "./engine.ts";
import { appendEvidence } from "./evidence.ts";
import { seed } from "./seed.ts";
import { recoverInterrupted } from "./runs.ts";
import { startGateway, startLiveChannel } from "./http.ts";

async function main(): Promise<void> {
  const startedAt = nowIso();
  verifyRuntimeRoot();
  const db = openDb();
  seed(db);
  recoverInterrupted(db);

  const engine = new OpenCodeEngine();
  const bin = engine.verifyBinary();
  appendEvidence(db, "core.starting", "floyd-core", {
    pid: process.pid,
    core: `${LOOPBACK}:${CORE_PORT}`,
    engine_binary: bin,
    runtime_root: PATHS.coreDir,
  });

  const { pid, version, credential_source } = await engine.start();
  appendEvidence(db, "engine.started", "floyd-core", {
    pid,
    version,
    url: engine.baseUrl,
    pure: true,
    isolation: "XDG+OPENCODE_CONFIG under FLOYD_RUNTIME",
    credential_source,
    credential_note:
      credential_source === "omp-auth-broker:zai"
        ? "canonical broker credential"
        : "broker zai credential failed validation (HTTP 401, 2026-07-12); using validated user opencode config key for the same GLM Coding Plan — refresh the broker credential",
  });

  startGateway(db, engine, process.pid, startedAt);
  const live = startLiveChannel(db, engine);
  appendEvidence(db, "core.gateway_listening", "floyd-core", { url: `http://${LOOPBACK}:${CORE_PORT}`, live_channel: true });
  console.log(`[floyd-core] up pid=${process.pid} gateway=http://${LOOPBACK}:${CORE_PORT} engine=${engine.baseUrl} (opencode ${version} pid=${pid})`);

  const shutdown = async (sig: string) => {
    appendEvidence(db, "core.shutdown", "floyd-core", { signal: sig });
    live.stop();
    await engine.stop();
    process.exit(0);
  };
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

main().catch((err) => {
  console.error("[floyd-core] fatal:", err);
  process.exit(1);
});
