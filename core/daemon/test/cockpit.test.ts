import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const html = readFileSync(join(import.meta.dirname, "../../../apps/cockpit/public/index.html"), "utf8");
const browserSdk = readFileSync(join(import.meta.dirname, "../../../packages/sdk/browser/floyd-sdk.js"), "utf8");

test("cockpit is a natural-language Core client without direct engine access", () => {
  assert.match(html, /Natural-language coding partner/);
  assert.match(html, /import \{ FloydBrowserClient, FloydApiError \} from "\/floyd-sdk\.js"/);
  assert.match(html, /client\.submit\(projectId, text\)/);
  assert.match(html, /client\.attachSession\(sessionId, actor/);
  assert.match(html, /client\.steer\(app\.currentSessionId/);
  assert.doesNotMatch(html, /127\.0\.0\.1:41415|\/api\/session\/|@opencode-ai\/sdk/);
  assert.doesNotMatch(html, /EventSource\(|\bfetch\(/);
});

test("cockpit has inline question and permission controls with no emoji glyphs", () => {
  assert.match(html, /data-question-index/);
  assert.match(html, /data-permission-index/);
  assert.match(html, /Allow once/);
  assert.match(html, /Reject/);
  assert.doesNotMatch(html, /[⚙🔐😀-🙏🌀-🫿]/u);
});

test("cockpit Surface Hub exposes exactly the five admitted Floyd surfaces", () => {
  assert.match(html, /id="surfaceHub"/);
  assert.match(html, /id="surfaceDialog"/);
  const start = html.indexOf("const FLOYD_SURFACES");
  const end = html.indexOf("const app =", start);
  assert.ok(start >= 0 && end > start);
  const surfaces = new Function(`${html.slice(start, end)}; return FLOYD_SURFACES;`)() as Array<Record<string, string>>;
  assert.deepEqual(surfaces.map(({ id }) => id), ["desktop", "ide", "tui", "pty", "launcher"]);
  assert.deepEqual(surfaces.filter(({ kind }) => kind === "url").map(({ target }) => target), [
    "http://127.0.0.1:3001/",
    "http://127.0.0.1:10001/",
    "http://127.0.0.1:11001/",
    "http://127.0.0.1:11000/",
  ]);
});

test("Surface Hub launch targets are credential-free and TUI continuation is shell-safe", () => {
  const start = html.indexOf("function shellQuote");
  const end = html.indexOf("function activeSurfaceProject", start);
  assert.ok(start >= 0 && end > start);
  const helpers = new Function(`${html.slice(start, end)}; return { shellQuote, safeSurfaceUrl, continuationCommand };`)() as {
    shellQuote: (value: string) => string;
    safeSurfaceUrl: (surface: Record<string, string>) => string;
    continuationCommand: (project: { id: string; root_path: string } | null) => string | null;
  };
  assert.equal(helpers.safeSurfaceUrl({ id: "ide", kind: "url", target: "http://127.0.0.1:10001/" }), "http://127.0.0.1:10001/");
  for (const target of [
    "https://127.0.0.1:10001/",
    "http://example.com/",
    "http://user:secret@127.0.0.1:10001/",
    "http://127.0.0.1:10001/?token=secret",
    "http://127.0.0.1:10001/#run=run-1",
  ]) assert.throws(() => helpers.safeSurfaceUrl({ id: "bad", kind: "url", target }), /Unsafe launch target/);
  const command = helpers.continuationCommand({ id: "project-'one", root_path: "/tmp/Floyd's work" });
  assert.equal(command, "cd -- '/tmp/Floyd'\"'\"'s work' && '/Volumes/Storage/FLOYD_RUNTIME/bin/floyd-tui' floyd --project-id 'project-'\"'\"'one' --continue");
  assert.equal(helpers.continuationCommand(null), null);
  assert.doesNotMatch(command!, /(token|api[_-]?key|session[_-]?id|run[_-]?id|last[_-]?event)/i);
});

test("Surface Hub reports Core-restored continuity and the honest remote loopback boundary", () => {
  assert.match(html, /Core continuation envelope/);
  assert.match(html, /app\.envelope\?\.active/);
  assert.match(html, /app\.envelope\?\.last_event_id/);
  assert.match(html, /Floyd Core remains the authority and restores context/);
  assert.match(html, /loopback addresses open on this device, not on the workstation/);
  assert.match(html, /does not federate third-party applications/);
  assert.match(html, /window\.open\(target, "_blank", "noopener,noreferrer"\)/);
  assert.doesNotMatch(html, /[?&#](token|secret|api_key|session_id|run_id|last_event_id)=/i);
});

test("remote cockpit is continuation-only and disables local authority controls", () => {
  assert.match(html, /const remoteMode =/);
  assert.match(html, /Remote continuation cannot create a new run/);
  assert.match(html, /Run decisions require the local authority surface/);
  assert.match(html, /Private remote continuation/);
  assert.match(html, /\["newTask", "modelSettings", "shareHandoff", "acceptRun", "rejectRun", "escalateRun"\]/);
  assert.match(html, /client\.pairExperienceHandoff\(handoffToken\)/);
  assert.match(html, /history\.replaceState/);
  assert.match(html, /sessionStorage\.removeItem\("floyd_gateway_token"\)/);
});

test("cockpit renders a local QR handoff without emoji or external image services", () => {
  assert.match(html, /id="shareHandoff"/);
  assert.match(html, /id="handoffQr"/);
  assert.match(html, /handoff\.qr_svg/);
  assert.match(html, /client\.issueExperienceHandoff/);
  assert.match(html, /new Blob\(\[handoff\.qr_svg\]/);
  assert.match(html, /client\.revokeExperienceHandoff/);
  assert.doesNotMatch(html, /handoffQr"\)\.innerHTML/);
  assert.doesNotMatch(html, /id="handoffLink"/);
  assert.doesNotMatch(html, /api\.qrserver|chart\.googleapis|quickchart/);
});

test("cockpit exposes user-driven model routing without persisting provider keys", () => {
  assert.match(html, /id="modelSettings"/);
  assert.match(html, /opencode-go/);
  assert.match(html, /opencode-zen/);
  assert.match(html, /data-model-apply/);
  assert.match(html, /client\.modelStream/);
  assert.match(browserSdk, /x-floyd-token/);
  assert.match(browserSdk, /x-floyd-provider/);
  assert.match(browserSdk, /x-api-key/);
  assert.doesNotMatch(html, /sessionStorage\.setItem\([^\n]*modelKey|localStorage\.setItem\([^\n]*modelKey/);
  assert.match(html, /location\.hash/);
  assert.doesNotMatch(html, /query\.get\("token"\)/);
});

test("cockpit restores and publishes the portable Core experience envelope", () => {
  assert.match(html, /client\.negotiateExperience/);
  assert.match(html, /client\.experience\(envelopeId\)/);
  assert.match(html, /client\.updateExperience/);
  assert.match(html, /client\.watchExperience/);
  assert.match(html, /event\.type === "transcript"/);
  assert.match(html, /restoreTranscriptSnapshot/);
  assert.match(html, /composer_draft/);
  assert.match(html, /transcript_cursor/);
  assert.match(html, /last_event_id/);
  assert.match(html, /selected_artifact_id/);
  assert.match(html, /client\.artifactById/);
  assert.match(html, /model_route/);
  assert.match(html, /capabilities: \["coding-runs", "model-chat", "questions", "permissions", "artifacts", "drafts", "experience-stream"\]/);
  assert.doesNotMatch(html, /(sessionStorage|localStorage)\.(getItem|setItem)\([^\n]*(modelRoute|model_route|composer|draft)/);
});

test("cockpit detects conflicting cross-surface writes instead of blindly retrying", () => {
  const start = html.indexOf("function valueEqual");
  const end = html.indexOf("async function patchEnvelope");
  assert.ok(start >= 0 && end > start);
  const helpers = new Function(`${html.slice(start, end)}; return { envelopeChangeApplied, envelopeChangeConflicts };`)() as {
    envelopeChangeApplied: (envelope: Record<string, unknown>, change: Record<string, unknown>) => boolean;
    envelopeChangeConflicts: (base: Record<string, unknown>, latest: Record<string, unknown>, change: Record<string, unknown>) => boolean;
  };
  const base = { composer_draft: "base", transcript_cursor: 4, active: { run_id: "run-a" } };
  assert.equal(helpers.envelopeChangeConflicts(base, { ...base, composer_draft: "remote" }, { composer_draft: "local" }), true);
  assert.equal(helpers.envelopeChangeConflicts(base, { ...base, transcript_cursor: 9 }, { composer_draft: "local" }), false);
  assert.equal(helpers.envelopeChangeApplied({ ...base, composer_draft: "local" }, { composer_draft: "local" }), true);
});

test("cockpit's actual 409 path retains conflicting Core state and retries only independent fields", async () => {
  class MockApiError extends Error {
    status = 409;
    payload: unknown;
    constructor(envelope: unknown) { super("conflict"); this.payload = { envelope }; }
  }
  const source = html.slice(html.indexOf("function valueEqual"), html.indexOf("function scheduleDraftSave"));
  const makePatch = (app: Record<string, any>, client: Record<string, any>) => new Function(
    "app", "client", "FloydApiError", "surfaceId", "envelopeId",
    `${source}; return patchEnvelope;`,
  )(app, client, MockApiError, "cockpit-test", "primary") as (change: Record<string, unknown>) => Promise<unknown>;

  const base = { revision: 1, composer_draft: "base", transcript_cursor: 4, last_event_id: "4" };
  const remoteDraft = { ...base, revision: 2, composer_draft: "remote" };
  let calls = 0;
  const app = { envelope: base };
  const patch = makePatch(app, {
    updateExperience: async () => { calls += 1; throw new MockApiError(remoteDraft); },
    experience: async () => remoteDraft,
  });
  await assert.rejects(() => patch({ composer_draft: "local" }), /Latest Core state was kept/);
  assert.equal(calls, 1);
  assert.equal(app.envelope, remoteDraft);

  const cursorAdvanced = { ...base, revision: 2, transcript_cursor: 9, last_event_id: "9" };
  calls = 0;
  const independentApp = { envelope: base };
  const independentPatch = makePatch(independentApp, {
    updateExperience: async (_id: string, body: Record<string, unknown>) => {
      calls += 1;
      if (calls === 1) throw new MockApiError(cursorAdvanced);
      return { ...cursorAdvanced, revision: 3, composer_draft: body.composer_draft };
    },
    experience: async () => cursorAdvanced,
  });
  const merged = await independentPatch({ composer_draft: "local" }) as { composer_draft: string };
  assert.equal(calls, 2);
  assert.equal(merged.composer_draft, "local");
});

test("cockpit preserves a pending local draft when a newer remote draft arrives", async () => {
  const start = html.indexOf("function draftChangeConflicts");
  const end = html.indexOf("function clearPendingCursorSave", start);
  const callbacks: Array<() => Promise<void>> = [];
  const writes: Array<Record<string, unknown>> = [];
  const notices: Error[] = [];
  const app = {
    envelope: { revision: 1, composer_draft: "base" },
    draftBase: null,
    draftLocalValue: "",
    draftDiverged: false,
    draftTimer: null,
  };
  const schedule = new Function(
    "app", "patchEnvelope", "notify", "setTimeout", "clearTimeout",
    `${html.slice(start, end)}; return scheduleDraftSave;`,
  )(
    app,
    async (change: Record<string, unknown>) => { writes.push(change); },
    (error: Error) => notices.push(error),
    (callback: () => Promise<void>) => { callbacks.push(callback); return callbacks.length; },
    () => {},
  ) as (value: string) => void;

  schedule("local");
  app.envelope = { revision: 2, composer_draft: "remote" };
  await callbacks.shift()!();
  assert.deepEqual(writes, []);
  assert.equal(app.draftDiverged, true);
  assert.match(notices[0]?.message ?? "", /changed on another surface/);

  schedule("local explicit edit");
  await callbacks.shift()!();
  assert.deepEqual(writes, [{ composer_draft: "local explicit edit" }]);
});

test("cockpit deduplicates only provider parts proven present in the transcript snapshot", () => {
  const start = html.indexOf("function deduplicatedLiveText");
  const end = html.indexOf("async function refreshHealth");
  const app = { snapshotParts: new Map([["run-a", new Map([["part-a", "hello"]])]]) };
  const deduplicate = new Function("app", `${html.slice(start, end)}; return deduplicatedLiveText;`)(app) as (
    runId: string,
    data: unknown,
  ) => string;
  assert.equal(deduplicate("run-a", { delta: "l", part: { id: "part-a", text: "hel" } }), "");
  assert.equal(deduplicate("run-a", { delta: "lo", part: { id: "part-a", text: "hello" } }), "");
  assert.equal(deduplicate("run-a", { delta: " world", part: { id: "part-a", text: "hello world" } }), " world");
  assert.equal(deduplicate("run-a", { delta: "unidentified" }), "unidentified");
});

test("cockpit discards delayed cursor writes after a run or epoch change", () => {
  const start = html.indexOf("function clearPendingCursorSave");
  const end = html.indexOf("async function restoreEnvelope");
  const callbacks: Array<() => void> = [];
  const writes: unknown[] = [];
  const app = {
    cursorTimer: null,
    cursorPending: null,
    currentRunId: "run-a",
    envelope: { transcript_epoch: "epoch-a" },
  };
  const helpers = new Function(
    "app", "patchEnvelope", "notify", "setTimeout", "clearTimeout",
    `${html.slice(start, end)}; return { scheduleCursorSave, clearPendingCursorSave };`,
  )(
    app,
    async (change: unknown) => { writes.push(change); },
    () => {},
    (callback: () => void) => { callbacks.push(callback); return callbacks.length; },
    () => {},
  ) as { scheduleCursorSave: (id: string) => void; clearPendingCursorSave: () => void };

  helpers.scheduleCursorSave("40");
  app.currentRunId = "run-b";
  callbacks.shift()!();
  assert.deepEqual(writes, []);

  helpers.scheduleCursorSave("5");
  app.envelope.transcript_epoch = "epoch-b";
  callbacks.shift()!();
  assert.deepEqual(writes, []);

  helpers.scheduleCursorSave("6");
  helpers.clearPendingCursorSave();
  assert.equal(app.cursorPending, null);
  assert.equal(app.cursorTimer, null);
});

test("cockpit ignores a stale out-of-order run selection", async () => {
  const start = html.indexOf("async function selectRun");
  const end = html.indexOf("function attachSession", start);
  const deferred = () => {
    let resolve!: (value: Record<string, unknown>) => void;
    const promise = new Promise<Record<string, unknown>>((done) => { resolve = done; });
    return { promise, resolve };
  };
  const runA = deferred();
  const runB = deferred();
  const inspectorA = deferred();
  const attachments: string[] = [];
  const patches: Array<Record<string, unknown>> = [];
  const app = {
    runSelectionGeneration: 0,
    activeContextPublish: Promise.resolve<unknown>(undefined),
    streamAbort: null,
    cursorTimer: null,
    cursorPending: null,
    modelKey: "",
    restoredArtifactId: null,
    currentRunId: null,
    currentRun: null,
    currentSessionId: null,
    mode: "",
    transcripts: new Map(),
    restoringEnvelope: false,
  };
  const selectRun = new Function(
    "app", "client", "clearPendingCursorSave", "renderRuns", "renderHeader", "renderMessages",
    "renderInspector", "attachSession", "patchEnvelope", "queueActiveContextPublish", "el",
    `${html.slice(start, end)}; return selectRun;`,
  )(
    app,
    { run: (id: string) => id === "run-a" ? runA.promise : runB.promise },
    () => {}, () => {}, () => {}, () => {},
    async (id: string) => id === "run-a" ? (await inspectorA.promise, true) : true,
    (id: string) => attachments.push(id),
    async (change: Record<string, unknown>) => { patches.push(change); },
    async (_generation: number, change: Record<string, unknown>) => { patches.push(change); return true; },
    (id: string) => id === "prompt" ? { value: "draft" } : { textContent: "" },
  ) as (id: string) => Promise<void>;

  const selectingA = selectRun("run-a");
  runA.resolve({ id: "run-a", session_id: "session-a", project_id: "project-a", goal: "A", status: "running" });
  await new Promise((resolve) => setImmediate(resolve));
  const selectingB = selectRun("run-b");
  runB.resolve({ id: "run-b", session_id: "session-b", project_id: "project-b", goal: "B", status: "running" });
  await selectingB;
  inspectorA.resolve({});
  await selectingA;

  assert.equal(app.currentRunId, "run-b");
  assert.deepEqual(attachments, ["run-b"]);
  assert.deepEqual(patches.map((patch) => (patch.active as { run_id: string }).run_id), ["run-b"]);
});

test("cockpit serializes overlapping active-run publications and leaves the newest authoritative", async () => {
  const start = html.indexOf("async function selectRun");
  const end = html.indexOf("function attachSession", start);
  let releaseA!: () => void;
  let enteredA!: () => void;
  const aEntered = new Promise<void>((resolve) => { enteredA = resolve; });
  const aBlocked = new Promise<void>((resolve) => { releaseA = resolve; });
  const publications: string[] = [];
  const attachments: string[] = [];
  const app = {
    runSelectionGeneration: 0,
    activeContextPublish: Promise.resolve<unknown>(undefined),
    streamAbort: null,
    cursorTimer: null,
    cursorPending: null,
    modelKey: "",
    restoredArtifactId: null,
    currentRunId: null,
    currentRun: null,
    currentSessionId: null,
    mode: "",
    transcripts: new Map(),
    restoringEnvelope: false,
  };
  const queueActiveContextPublish = (generation: number, change: Record<string, any>) => {
    const publish = async () => {
      if (generation !== app.runSelectionGeneration) return false;
      const runId = change.active.run_id;
      publications.push(runId);
      if (runId === "run-a") { enteredA(); await aBlocked; }
      return generation === app.runSelectionGeneration;
    };
    const queued = app.activeContextPublish.then(publish, publish);
    app.activeContextPublish = queued.catch(() => {});
    return queued;
  };
  const selectRun = new Function(
    "app", "client", "clearPendingCursorSave", "renderRuns", "renderHeader", "renderMessages",
    "renderInspector", "attachSession", "patchEnvelope", "queueActiveContextPublish", "el",
    `${html.slice(start, end)}; return selectRun;`,
  )(
    app,
    { run: async (id: string) => ({ id, session_id: `session-${id}`, project_id: `project-${id}`, goal: id, status: "running" }) },
    () => {}, () => {}, () => {}, () => {}, async () => true,
    (id: string) => attachments.push(id), async () => {}, queueActiveContextPublish,
    (id: string) => id === "prompt" ? { value: "draft" } : { textContent: "" },
  ) as (id: string) => Promise<void>;

  const selectingA = selectRun("run-a");
  await aEntered;
  const selectingB = selectRun("run-b");
  releaseA();
  await Promise.all([selectingA, selectingB]);

  assert.deepEqual(publications, ["run-a", "run-b"]);
  assert.deepEqual(attachments, ["run-b"]);
  assert.equal(app.currentRunId, "run-b");
});

test("cockpit drops buffered attach events after abort and run selection change", async () => {
  const start = html.indexOf("function attachmentIsCurrent");
  const end = html.indexOf("async function sendPrompt", start);
  let release!: () => void;
  const blocked = new Promise<void>((resolve) => { release = resolve; });
  const cursors: unknown[] = [];
  const transcriptRestores: unknown[] = [];
  const patches: unknown[] = [];
  const app = {
    runSelectionGeneration: 1,
    currentRunId: "run-a",
    currentSessionId: "session-a",
    envelope: { transcript_epoch: "epoch-a" },
    streamAbort: null,
  };
  const attach = new Function(
    "app", "client", "actor", "patchEnvelope", "restoreTranscriptSnapshot", "scheduleCursorSave",
    "deduplicatedLiveText", "addEntry", "notify", "AbortController",
    `${html.slice(start, end)}; return attachSession;`,
  )(
    app,
    {
      async *attachSession() {
        await blocked;
        yield { id: "41", type: "transcript", data: { messages: [{ id: "old" }] } };
      },
    },
    "test",
    async (change: unknown) => { patches.push(change); },
    (...args: unknown[]) => transcriptRestores.push(args),
    (...args: unknown[]) => cursors.push(args),
    () => "",
    () => {},
    () => {},
    AbortController,
  ) as (runId: string, sessionId: string, generation: number) => void;

  attach("run-a", "session-a", 1);
  const oldController = app.streamAbort as unknown as AbortController;
  app.runSelectionGeneration = 2;
  app.currentRunId = "run-b";
  app.currentSessionId = "session-b";
  oldController.abort();
  release();
  await new Promise((resolve) => setImmediate(resolve));

  assert.deepEqual(transcriptRestores, []);
  assert.deepEqual(cursors, []);
  assert.deepEqual(patches, []);
});

test("cockpit reconnects the experience watch with capped delay and a fresh restore", async () => {
  const start = html.indexOf("function experienceRetryDelay");
  const end = html.indexOf("async function initializeExperience", start);
  const controller = new AbortController();
  let watchCalls = 0;
  const restored: number[] = [];
  const notices: unknown[] = [];
  const app = { envelope: { revision: 1 } };
  const helpers = new Function(
    "app", "client", "envelopeId", "restoreEnvelope", "notify", "setTimeout", "clearTimeout",
    `${html.slice(start, end)}; return { experienceRetryDelay, watchExperienceWithReconnect };`,
  )(
    app,
    {
      watchExperience() {
        watchCalls += 1;
        if (watchCalls === 1) return (async function* () { throw new Error("transient"); })();
        return (async function* () {
          yield { type: "experience", data: { revision: 3 } };
          controller.abort();
        })();
      },
      async experience() { return { revision: 2 }; },
    },
    "primary",
    async (envelope: { revision: number }) => { app.envelope = envelope; restored.push(envelope.revision); },
    (error: unknown) => notices.push(error),
    setTimeout,
    clearTimeout,
  ) as {
    experienceRetryDelay: (attempt: number) => number;
    watchExperienceWithReconnect: (controller: AbortController) => Promise<void>;
  };

  assert.equal(helpers.experienceRetryDelay(0), 250);
  assert.equal(helpers.experienceRetryDelay(20), 4000);
  await helpers.watchExperienceWithReconnect(controller);
  assert.equal(watchCalls, 2);
  assert.deepEqual(restored, [2, 3]);
  assert.equal(notices.length, 1);
});
