import test from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { once } from "node:events";
import {
  normalizeProviderFrame,
  relayProviderRequest,
  resolveProviderEndpoint,
  translatePayload,
} from "../src/provider-gateway.ts";

async function listen(server: Server): Promise<number> {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("test server has no TCP port");
  return address.port;
}

async function close(server: Server): Promise<void> {
  server.close();
  await once(server, "close");
}

test("routes Zen/Go and compatible endpoints to the invariant completion paths", () => {
  assert.equal(resolveProviderEndpoint("opencode-zen", undefined, "glm").endpoint.href, "https://opencode.ai/zen/v1/chat/completions");
  assert.equal(resolveProviderEndpoint("opencode-go", undefined, "kimi",).endpoint.href, "https://opencode.ai/zen/go/v1/chat/completions");
  assert.equal(resolveProviderEndpoint("anthropic", "https://proxy.example/v1/chat/completions", "claude-x").endpoint.href, "https://proxy.example/v1/messages");
  assert.throws(() => resolveProviderEndpoint("openai", "http://public.example/v1", "gpt"), /HTTPS/);
});

test("translates Anthropic system messages and normalizes both stream dialects", () => {
  const translated = translatePayload({
    model: "claude-test",
    stream: true,
    messages: [
      { role: "system", content: "first" },
      { role: "system", content: [{ type: "text", text: "second" }] },
      { role: "user", content: "hello" },
    ],
  }, "anthropic");
  assert.equal(translated.system, "first\n\nsecond");
  assert.deepEqual(translated.messages, [{ role: "user", content: "hello" }]);
  assert.deepEqual(normalizeProviderFrame("openai", { choices: [{ delta: { content: "A" } }] }), { text: "A" });
  assert.deepEqual(normalizeProviderFrame("anthropic", { type: "content_block_delta", delta: { type: "text_delta", text: "B" } }), { text: "B" });
});

test("relay preserves bearer auth and produces one normalized SSE contract", async () => {
  let seenPath = "";
  let seenAuthorization = "";
  let seenBody: unknown;
  const upstream = createServer(async (req, res) => {
    seenPath = req.url ?? "";
    seenAuthorization = req.headers.authorization ?? "";
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(Buffer.from(chunk));
    seenBody = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    res.writeHead(200, { "content-type": "text/event-stream" });
    res.write('data: {"choices":[{"delta":{"content":"hel"}}]}\n\n');
    res.write('data: {"choices":[{"delta":{"content":"lo"},"finish_reason":"stop"}]}\n\n');
    res.end("data: [DONE]\n\n");
  });
  const upstreamPort = await listen(upstream);
  const relay = createServer((req, res) => { void relayProviderRequest(req, res).catch((error) => res.destroy(error)); });
  const relayPort = await listen(relay);
  try {
    const response = await fetch(`http://127.0.0.1:${relayPort}/gateway`, {
      method: "POST",
      headers: {
        authorization: "Bearer provider-secret",
        "content-type": "application/json",
        "x-floyd-provider": "openai",
        "x-floyd-base-url": `http://127.0.0.1:${upstreamPort}/v1`,
      },
      body: JSON.stringify({ model: "gpt-test", messages: [{ role: "user", content: "hi" }], stream: true }),
    });
    assert.equal(response.status, 200);
    assert.equal(await response.text(), [
      'event: delta\ndata: {"text":"hel"}\n\n',
      'event: delta\ndata: {"text":"lo"}\n\n',
      'event: done\ndata: {"finish_reason":"stop"}\n\n',
    ].join(""));
    assert.equal(seenPath, "/v1/chat/completions");
    assert.equal(seenAuthorization, "Bearer provider-secret");
    assert.deepEqual(seenBody, { model: "gpt-test", messages: [{ role: "user", content: "hi" }], stream: true });
  } finally {
    await close(relay);
    await close(upstream);
  }
});

test("relay echoes the vendor's exact non-200 status and error payload", async () => {
  const upstream = createServer((_req, res) => {
    res.writeHead(429, { "content-type": "application/json", "retry-after": "17" });
    res.end('{"error":{"type":"rate_limit","message":"slow down"}}');
  });
  const upstreamPort = await listen(upstream);
  const relay = createServer((req, res) => { void relayProviderRequest(req, res).catch((error) => res.destroy(error)); });
  const relayPort = await listen(relay);
  try {
    const response = await fetch(`http://127.0.0.1:${relayPort}/gateway`, {
      method: "POST",
      headers: {
        "x-api-key": "anthropic-secret",
        "x-floyd-provider": "anthropic",
        "x-floyd-base-url": `http://127.0.0.1:${upstreamPort}/v1`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ model: "claude-test", messages: [{ role: "system", content: "code" }, { role: "user", content: "hi" }], stream: true }),
    });
    assert.equal(response.status, 429);
    assert.equal(response.headers.get("retry-after"), "17");
    assert.equal(await response.text(), '{"error":{"type":"rate_limit","message":"slow down"}}');
  } finally {
    await close(relay);
    await close(upstream);
  }
});

test("client abort destroys the active upstream response/socket", async () => {
  let upstreamClosed = false;
  const upstream = createServer((_req, res) => {
    res.on("close", () => { upstreamClosed = true; });
    res.writeHead(200, { "content-type": "text/event-stream" });
    res.write('data: {"choices":[{"delta":{"content":"open"}}]}\n\n');
  });
  const upstreamPort = await listen(upstream);
  const relay = createServer((req, res) => { void relayProviderRequest(req, res).catch(() => {}); });
  const relayPort = await listen(relay);
  try {
    const controller = new AbortController();
    const response = await fetch(`http://127.0.0.1:${relayPort}/gateway`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        authorization: "Bearer provider-secret",
        "x-floyd-provider": "openai",
        "x-floyd-base-url": `http://127.0.0.1:${upstreamPort}/v1`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ model: "gpt-test", messages: [{ role: "user", content: "hi" }], stream: true }),
    });
    assert.equal(response.status, 200);
    controller.abort();
    await new Promise((resolve) => setTimeout(resolve, 50));
    assert.equal(upstreamClosed, true);
  } finally {
    await close(relay);
    await close(upstream);
  }
});
