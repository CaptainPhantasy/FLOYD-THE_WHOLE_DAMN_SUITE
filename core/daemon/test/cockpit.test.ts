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
