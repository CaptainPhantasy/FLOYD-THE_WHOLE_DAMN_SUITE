# PLAN 2026-07-20: Ecosystem roles, browser/terminal as services, ChatGPT-subscription provider, shared persistence

Douglas's directive (verbatim intent): FLOYD_WORKSTATION is the homebrewed Claude
Ecosystem. Browser and TerminalOne are *services available to every plane and
every model*, not sidebar residents. Desktop runs on the ChatGPT subscription.
Every permanent model instance is internally prompted for its environment. No
plane may ever lose state on close; all generated assets land in a shared
persistent space owned by Core.

---

## 1. Browser as an overlay service (not a sidebar app)

**Today:** `apps/frame/registry.json` lists `browser` as `kind: "action"` →
`POST /api/action/open-chrome` which just opens external Chrome. CURSEM has no
in-app browser affordance.

**Target:**
- New frame concept `kind: "overlay"`. Overlay apps do not occupy the stage or
  the drawer as planes; they mount as a dismissible overlay (z-index above the
  stage) toggled by a titlebar button, available from *any* active plane.
- The browser overlay hosts the CDP-controlled Chrome instance (isolated
  profile, per native-browser-control policy) rendered via window management,
  positioned over the frame like a browser next to an IDE. Not embedded in the
  plane's iframe. Escape/close hides it; the Chrome process and its tabs
  persist.
- CURSEM gets a "Browser" button that calls the same frame overlay API
  (`POST /api/overlay/browser/show|hide`), so the IDE can summon it exactly
  like an IDE's built-in browser.
- Assistant drive path: every model instance reaches the same Chrome via the
  MCP-GATEWAY route to the native-browser-control / CDP server. One browser,
  N drivers, human always able to see what the agent is doing.
- **Permanent extensions (mandate 2026-07-20):** every internal browser launch
  MUST load both `/Volumes/SanDisk1Tb/open-anvil/extension` (Open Anvil —
  Agent Pilot) and `/Volumes/Storage/Floyd TTY Bridge for Chrome/extension`
  (Floyd's Labs TTY Bridge). A launch that cannot load both is an error, not a
  degraded browser. The internal browser runs on its own persistent profile at
  `FLOYD_RUNTIME/internal-browser-profile` so `--load-extension` always
  applies and its state survives independent of the human's Chrome.

**Files:** `apps/frame/registry.json` (schema: add `kind: overlay`),
`apps/frame/public/index.html` (overlay layer + button),
`apps/frame/server/frame-server.mjs` (overlay lifecycle, replaces bare
`open-chrome`).

## 2. TerminalOne as a service, same shape

**Today:** TerminalOne (`:13013`) is a drawer plane; CURSEM already embeds it.

**Target:** keep the plane for humans, but also register it as an overlay
service and as a Core-mediated capability so Desktop/Browser/ChromeExt models
can request a PTY (through Core's session-channel, never raw). No sidebar
requirement. CURSEM's built-in stays authoritative for the IDE.

## 3. Global MCP baseline: DesktopCommander + MCP-GATEWAY everywhere

**Rule:** every AI instance in the ecosystem boots with two MCP servers wired
by default: DesktopCommander and MCP-GATEWAY. The gateway is the fan-out to
the rest of the fleet (git, browser control, memory, etc.).

**Mechanism:** one shared config, not five copies.
- Add `ecosystem/mcp-baseline.json` — single source listing the two default
  servers (command, args, env), plus per-surface extras.
- Floyd Core (`core/daemon/src/connected-app-authority.ts`) serves it at
  `GET /v1/mcp-baseline`; each surface's MCP client (Desktop:
  `dist-server/mcp-client.js`, CURSEM assistant, Browork, ChromeExt bridge,
  CLI) loads baseline at boot and merges local additions.
- Surfaces MUST NOT hardcode their own copies; drift is a bug.

## 4. Desktop = ChatGPT subscription provider

**Today:** Desktop (`intake/surfaces/desktop/dist-server/index.js`) defaults to
GLM via Z.AI with a static hardcoded `PROVIDER_MODELS` table (stale: gpt-4o
era) and `.env.local` already loaded via dotenv.

**Target:**
1. New provider `chatgpt` using the Codex-CLI-style OAuth device/browser flow
   that authenticates against the ChatGPT site (subscription auth, not a raw
   platform API key). Loader flow: on first boot with no valid token, Desktop
   surfaces a "Sign in with ChatGPT" step; the flow verifies against
   chatgpt.com and stores `CHATGPT_ACCESS_TOKEN` / `CHATGPT_REFRESH_TOKEN` /
   `CHATGPT_ACCOUNT_ID` in `.env.local` (0600, gitignored). Refresh handled
   server-side; UI never sees tokens.
2. Dynamic model list: on every server boot (and on token refresh) query the
   models endpoint with the subscription token and replace the static
   `PROVIDER_MODELS.openai`/`chatgpt` entry with the live list (gpt-5.x etc.).
   Cache last-known-good list in `.floyd-data/models-chatgpt.json` so offline
   boot still works.
3. Default Desktop provider becomes `chatgpt`; GLM route remains as fallback.
4. Core's `provider-gateway.ts` gains a `chatgpt` route so other surfaces can
   borrow the subscription through Core (Core stays the credential authority
   long-term; Desktop-local `.env.local` is the near-term requirement).

## 5. Role prompts: every permanent instance knows its environment

One shared registry: `ecosystem/prompts/roles/` (markdown per role), served by
Core and injected as the instance's internal system preamble at session start.

| Instance | Role prompt | Capabilities it is told about |
|---|---|---|
| CLI (floydcode / ff) | **Terminal coding partner** — repo-first, diff-driven | MCP baseline; may request media assets from Desktop via Core |
| Desktop | **MediaCenter / ContentCreator** — media generation, content pipelines, asset production | MCP baseline; serves asset requests from other surfaces; ChatGPT models |
| Chrome Extension | **Browser-Aware / Dogfooding** — sees the live page, exercises real user flows, files evidence | MCP baseline; browser overlay is its home turf |
| Browork | **AXIOM Tank Commander w/ Fleet** — multi-repo bulk operations, dispatches recon sub-agents | MCP baseline; fleet orchestration |
| CURSEM Assistant | **IDE assistant — the integrator** | ALL of the above: browser overlay, TerminalOne, and asset requests to Desktop, from inside the IDE |

Cross-calling contract: "asset request" message over Core's connected-app
transport (`connected-app-transport.ts`): requester → Core → Desktop instance →
result stored as a Core artifact → artifact id returned to requester. Browser
and CLI-Terminal instances use the same path to pull Desktop media into the IDE.

## 6. Persistence: closing a plane NEVER loses work

**Today:** switching planes is safe (iframes kept alive,
`public/index.html:149`). But the per-app quit button warns "Its session state
will be lost", removes the iframe, and SIGTERMs the server
(`index.html:363`, `frame-server.mjs /api/quit/`). That is the violation.

**Fix, both halves (belt and suspenders):**
1. **Quit becomes detach.** Default close = hide overlay/iframe only; the
   managed process keeps running (chrono idle-reaper already handles true
   abandonment). A separate explicit "Force quit (frees the port)" remains for
   humans, and even that is safe because of (2).
2. **All state flows to Core's shared space.** This is the architecture the
   repo already promises: `docs/SURFACE_CONTINUITY.md` (ExperienceEnvelope:
   restore/publish per surface) + `core/daemon/src/artifacts.ts`
   (content-addressed store at `FLOYD_RUNTIME/artifacts/`). Requirements:
   - Every surface that generates assets (Desktop media, browser downloads,
     CLI outputs) MUST publish them as Core artifacts, never plane-local temp
     files.
   - Every plane MUST checkpoint its envelope fields on
     visibility-change/close (`publish` set per surface table in
     SURFACE_CONTINUITY.md) so a killed process restores mid-thought.
   - Frame quit flow changes copy: no more "state will be lost" — instead
     "App will detach. Work is preserved in Floyd Core."

## Execution order (each step independently verifiable)

1. Persistence fix (frame quit → detach + copy change) — smallest, highest pain.
2. `ecosystem/mcp-baseline.json` + Core endpoint + Desktop/CURSEM consumption.
3. Browser overlay kind in frame + CURSEM button + CDP drive via gateway.
4. ChatGPT subscription loader + dynamic model list in Desktop, `.env.local`.
5. Role prompt registry + injection per instance.
6. Cross-surface asset-request contract over connected-app transport.
7. TerminalOne overlay/service registration.

Each step lands as its own commit on `fix/floyd-daily-driver-hardening` with
tests where the daemon is touched (`core/daemon/test/`).
