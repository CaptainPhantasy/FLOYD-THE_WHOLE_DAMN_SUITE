# Multi-provider model routing

Floyd Core exposes one loopback relay at `POST /gateway`. Presentation code uses
`FloydModelClient` from `@floyd/sdk`; it does not call a public model endpoint
from the browser.

## Routes

| Route | Default base URL | Dialect |
|---|---|---|
| `opencode-zen` | `https://opencode.ai/zen/v1` | OpenAI chat completions |
| `opencode-go` | `https://opencode.ai/zen/go/v1` | OpenAI chat completions |
| `openai` | `https://api.openai.com/v1` | OpenAI chat completions |
| `anthropic` | `https://api.anthropic.com/v1` | Anthropic messages |
| `auto` | Selected from the model and override URL | OpenAI or Anthropic |

An `x-floyd-base-url` override may be any HTTPS OpenAI-compatible or
Anthropic-compatible base URL. HTTP is rejected except for `localhost`,
`127.0.0.1`, and `::1` development endpoints. The relay strips a supplied
`/chat/completions` or `/messages` suffix and appends the path required by the
detected dialect.

## Authentication boundary

The relay needs two independent credentials:

- `x-floyd-token` authenticates the caller to loopback Floyd Core.
- `Authorization: Bearer ...` is forwarded unchanged to OpenAI-compatible
  routes.
- `x-api-key` is forwarded unchanged to Anthropic-compatible routes.
- `anthropic-version` is forwarded when supplied and otherwise defaults to
  `2023-06-01`.

This separation is deliberate. Reusing `Authorization` for Core authentication
would overwrite the provider credential and make transparent forwarding
impossible. Provider keys exist only in the request and are not written to the
Floyd database or runtime files by this module.

```ts
import { FloydModelClient } from "@floyd/sdk";

const models = new FloydModelClient({
  token: () => readCoreToken(),
});

for await (const event of models.streamChat({
  route: { provider: "opencode-go", apiKey: userSuppliedKey },
  model: "user-selected-model",
  messages: [{ role: "user", content: "Explain this failing test." }],
  signal: abortController.signal,
})) {
  if (event.type === "delta") render(event.data.text ?? "");
}
```

## Normalized stream

Both upstream dialects become the same SSE vocabulary:

```text
event: delta
data: {"text":"partial text"}

event: done
data: {"finish_reason":"stop"}
```

OpenAI `choices[0].delta.content` and Anthropic
`content_block_delta.delta.text` map to `delta`. Vendor finish events map to
`done`. Non-2xx vendor responses bypass normalization: Floyd returns the same
status code, content type, payload bytes, `retry-after`, and request ID.

## Lifecycle

The relay owns the outbound Node `ClientRequest`. Incoming aborts, browser tab
closure, response closure, or client network loss immediately destroy both the
provider response stream and the outbound request/socket. Backpressure pauses
the provider stream until the Floyd client drains. Normal completion closes the
SSE response and releases the reader buffers.

Cross-origin browser access is limited to loopback HTTP origins. Browser
preflight is accepted only for that origin class; the subsequent POST still
requires `x-floyd-token`. Non-loopback origins receive 403. Server-side bridges
do not send an Origin header and continue to work normally.

## Sharp edges

- This relay provides model completions. Floyd's durable coding runs still use
  the supervised OpenCode engine because raw chat APIs do not provide its tool,
  worktree, permission, or review lifecycle.
- A caller holding the Core token can select an arbitrary HTTPS host. That is
  intentional for compatible private gateways, but it also grants an outbound
  request capability; do not expose the Core token to untrusted content.
- `auto` detection is intentionally conservative. A custom Anthropic-compatible
  gateway with neither `anthropic` in its URL nor a `claude-` model name must be
  selected explicitly as `anthropic`.
- Non-streaming success bodies remain vendor-native. Only streaming responses
  use Floyd's unified event contract.
- The relay caps request bodies at 4 MiB. It does not currently implement image
  upload staging, provider file APIs, automatic retries, fallback routing, token
  accounting, or provider-specific tool-call normalization.
