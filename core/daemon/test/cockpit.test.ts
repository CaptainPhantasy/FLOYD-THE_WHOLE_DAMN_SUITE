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
});
