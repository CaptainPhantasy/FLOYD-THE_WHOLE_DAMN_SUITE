import test from "node:test";
import assert from "node:assert/strict";
import { FloydApiError, FloydClient } from "../src/index.ts";

test("client forwards bearer auth, JSON, and exact upstream errors", async () => {
  const seen: Request[] = [];
  const fetchMock: typeof fetch = async (input, init) => {
    const request = input instanceof Request ? input : new Request(input, init);
    seen.push(request.clone());
    if (new URL(request.url).pathname === "/api/fail") {
      return new Response(JSON.stringify({ error: "rate limited", retry_after: 30 }), {
        status: 429,
        headers: { "content-type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" } });
  };
  const client = new FloydClient({ baseUrl: "http://127.0.0.1:41414/", token: async () => "secret", fetch: fetchMock });

  assert.deepEqual(await client.submit({ project_id: "prj_1", goal: "make it work" }), { ok: true });
  assert.equal(seen[0]?.headers.get("authorization"), "Bearer secret");
  assert.deepEqual(JSON.parse(await seen[0]!.text()), { project_id: "prj_1", goal: "make it work" });

  await assert.rejects(
    () => client.request("GET", "/api/fail"),
    (error: unknown) => {
      assert.ok(error instanceof FloydApiError);
      assert.equal(error.status, 429);
      assert.deepEqual(error.payload, { error: "rate limited", retry_after: 30 });
      return true;
    },
  );
});

test("SSE parser normalizes CRLF, multiline data, resume id, and cancels on break", async () => {
  let cancelled = false;
  let lastEventId: string | null = null;
  const encoder = new TextEncoder();
  const fetchMock: typeof fetch = async (input, init) => {
    const request = input instanceof Request ? input : new Request(input, init);
    lastEventId = request.headers.get("last-event-id");
    return new Response(new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('id: 41\r\nevent: token\r\ndata: {"delta":\r\ndata: "hello"}\r\n\r\n'));
      },
      cancel() { cancelled = true; },
    }), { headers: { "content-type": "text/event-stream" } });
  };
  const client = new FloydClient({ token: "token", fetch: fetchMock });
  const events = client.attachSession("ses 1", "desktop", { lastEventId: "40" });
  for await (const event of events) {
    assert.deepEqual(event, { id: "41", type: "token", data: { delta: "hello" } });
    break;
  }
  assert.equal(lastEventId, "40");
  assert.equal(cancelled, true);
});

test("aborting a surface stream propagates to the network request", async () => {
  let networkAborted = false;
  const fetchMock: typeof fetch = async (input, init) => {
    const request = input instanceof Request ? input : new Request(input, init);
    return new Response(new ReadableStream({
      start(controller) {
        if (request.signal.aborted) {
          networkAborted = true;
          controller.error(new DOMException("aborted", "AbortError"));
          return;
        }
        request.signal.addEventListener("abort", () => {
          networkAborted = true;
          controller.error(new DOMException("aborted", "AbortError"));
        }, { once: true });
      },
    }), { headers: { "content-type": "text/event-stream" } });
  };
  const client = new FloydClient({ token: "token", fetch: fetchMock });
  const controller = new AbortController();
  const iterator = client.watchRun("run_1", controller.signal);
  const pending = iterator.next();
  controller.abort();
  await assert.rejects(pending, (error: unknown) => error instanceof Error && error.name === "AbortError");
  assert.equal(networkAborted, true);
});
