export class FloydApiError extends Error {
  constructor(method, path, status, payload) {
    const detail = typeof payload === "string" ? payload : JSON.stringify(payload);
    super(`${method} ${path} -> ${status}: ${detail}`);
    this.name = "FloydApiError";
    this.method = method;
    this.path = path;
    this.status = status;
    this.payload = payload;
  }
}

/** Browser build of the dependency-free Floyd Core client. */
export class FloydBrowserClient {
  constructor({ baseUrl = "", token, fetch: fetchImpl = globalThis.fetch }) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.tokenSource = token;
    this.fetchImpl = fetchImpl.bind(globalThis);
  }

  async token() {
    return typeof this.tokenSource === "function" ? this.tokenSource() : this.tokenSource;
  }

  async request(method, path, body, signal) {
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${await this.token()}`,
        ...(body !== undefined ? { "content-type": "application/json" } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    });
    const text = await response.text();
    let payload = text;
    if (text) {
      try { payload = JSON.parse(text); } catch { /* retain exact body */ }
    }
    if (!response.ok) throw new FloydApiError(method, path, response.status, payload);
    return payload;
  }

  health(signal) { return this.request("GET", "/api/health", undefined, signal); }
  state(signal) { return this.request("GET", "/api/state", undefined, signal); }
  run(id, signal) { return this.request("GET", `/api/runs/${encodeURIComponent(id)}`, undefined, signal); }
  evidence(id, signal) { return this.request("GET", `/api/evidence?run_id=${encodeURIComponent(id)}`, undefined, signal); }
  artifact(runId, role, signal) {
    return this.request("GET", `/api/runs/${encodeURIComponent(runId)}/artifact/${encodeURIComponent(role)}`, undefined, signal);
  }
  submit(projectId, goal, signal) {
    return this.request("POST", "/api/runs", { project_id: projectId, goal }, signal);
  }
  decide(runId, action, actor, signal) {
    return this.request("POST", `/api/runs/${encodeURIComponent(runId)}/decision`, { action, actor }, signal);
  }
  steer(sessionId, text, actor, signal) {
    return this.request("POST", `/api/sessions/${encodeURIComponent(sessionId)}/steer`, { type: "steer", text, actor }, signal);
  }
  answer(sessionId, requestId, answers, actor, signal) {
    return this.request("POST", `/api/sessions/${encodeURIComponent(sessionId)}/steer`, {
      type: "answer", request_id: requestId, answers, actor,
    }, signal);
  }
  permission(sessionId, requestId, reply, actor, signal) {
    return this.request("POST", `/api/sessions/${encodeURIComponent(sessionId)}/steer`, {
      type: "permission", request_id: requestId, reply, actor,
    }, signal);
  }

  async *stream(path, { method = "GET", body, lastEventId, signal } = {}) {
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${await this.token()}`,
        accept: "text/event-stream",
        ...(body !== undefined ? { "content-type": "application/json" } : {}),
        ...(lastEventId ? { "last-event-id": lastEventId } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    });
    if (!response.ok || !response.body) {
      const text = await response.text().catch(() => "");
      let payload = text;
      try { payload = JSON.parse(text); } catch { /* retain exact body */ }
      throw new FloydApiError(method, path, response.status, payload);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true }).replace(/\r\n?/g, "\n");
        const frames = buffer.split("\n\n");
        buffer = frames.pop() ?? "";
        for (const frame of frames) {
          let id;
          let type = "message";
          const dataLines = [];
          for (const line of frame.split("\n")) {
            if (line.startsWith("id:")) id = line.slice(3).trim();
            else if (line.startsWith("event:")) type = line.slice(6).trim();
            else if (line.startsWith("data:")) dataLines.push(line.slice(5).trimStart());
          }
          if (!dataLines.length) continue;
          const raw = dataLines.join("\n");
          let data = raw;
          try { data = JSON.parse(raw); } catch { /* valid SSE may be text */ }
          yield { ...(id ? { id } : {}), type, data };
        }
      }
    } finally {
      await reader.cancel().catch(() => {});
      reader.releaseLock();
    }
  }

  attachSession(sessionId, actor, options = {}) {
    return this.stream(`/api/sessions/${encodeURIComponent(sessionId)}/attach`, {
      method: "POST",
      body: { actor },
      lastEventId: options.lastEventId,
      signal: options.signal,
    });
  }
}
