import test from "node:test";
import assert from "node:assert/strict";
import { FloydApiError, FloydBrowserClient } from "../browser/floyd-sdk.js";

test("browser client preserves Core status and error payload", async () => {
  const requests = [];
  const client = new FloydBrowserClient({
    baseUrl: "http://127.0.0.1:41414/",
    token: "browser-token",
    fetch: async (input, init) => {
      const request = input instanceof Request ? input : new Request(input, init);
      requests.push(request.clone());
      if (request.url.endsWith("/api/health")) {
        return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" } });
      }
      return new Response(JSON.stringify({ error: "permission expired", request_id: "per_1" }), {
        status: 410,
        headers: { "content-type": "application/json" },
      });
    },
  });
  assert.deepEqual(await client.health(), { ok: true });
  assert.equal(requests[0].headers.get("authorization"), "Bearer browser-token");
  await assert.rejects(
    () => client.permission("ses_1", "per_1", "once", "cockpit"),
    (error) => error instanceof FloydApiError
      && error.status === 410
      && error.payload.request_id === "per_1",
  );
});

test("browser client calls an unbound fetch implementation safely", async () => {
  const receiver = { expected: true };
  function receiverSensitiveFetch() {
    assert.equal(this, globalThis);
    return Promise.resolve(new Response(JSON.stringify(receiver), { headers: { "content-type": "application/json" } }));
  }
  const client = new FloydBrowserClient({ token: "token", fetch: receiverSensitiveFetch });
  assert.deepEqual(await client.health(), receiver);
});
