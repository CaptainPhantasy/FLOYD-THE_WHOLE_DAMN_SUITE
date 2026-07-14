import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { chmodSync, lstatSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  ExperienceSecurityError,
  ExperienceSecurityService,
  ensureExperienceSecuritySchema,
  type ExperienceSecurityEvent,
} from "../src/experience-security.ts";

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "floyd-experience-security-"));
  const keyPath = join(root, "keys", "experience.key");
  const db = new DatabaseSync(":memory:");
  ensureExperienceSecuritySchema(db);
  let now = Date.parse("2026-07-14T12:00:00.000Z");
  const events: ExperienceSecurityEvent[] = [];
  const service = new ExperienceSecurityService(db, { masterKeyPath: keyPath, now: () => now, evidence: (event) => events.push(event) });
  return { db, keyPath, service, events, advance: (ms: number) => (now += ms) };
}

test("enrollment encrypts metadata, stores only a verifier, and creates a 0600 key", async () => {
  const { db, keyPath, service, events } = fixture();
  const enrolled = await service.enrollDevice({ name: "Douglas MacBook", platform: "darwin" }, "dev_primary");
  const row = db.prepare(`SELECT * FROM experience_devices WHERE id = ?`).get(enrolled.deviceId) as Record<string, unknown>;

  assert.equal((lstatSync(keyPath).mode & 0o777).toString(8), "600");
  assert.equal(readFileSync(keyPath).length, 32);
  assert.equal(Buffer.from(row.metadata_ciphertext as Uint8Array).includes(Buffer.from("Douglas MacBook")), false);
  assert.equal(JSON.stringify(row).includes("Douglas MacBook"), false);
  assert.equal(JSON.stringify(row).includes(enrolled.secret), false);
  assert.equal(Buffer.from(row.secret_verifier as Uint8Array).length, 32);
  assert.deepEqual((await service.authenticateDevice(enrolled.deviceId, enrolled.secret)).metadata, {
    name: "Douglas MacBook",
    platform: "darwin",
  });
  assert.equal(events.some((event) => JSON.stringify(event).includes(enrolled.secret)), false);
});

test("wrong device secret is rejected and revoked devices cannot authenticate", async () => {
  const { service } = fixture();
  const enrolled = await service.enrollDevice({ name: "IDE" });
  await assert.rejects(service.authenticateDevice(enrolled.deviceId, "x".repeat(43)), (error: unknown) => {
    assert.equal((error as ExperienceSecurityError).code, "invalid_credentials");
    return true;
  });
  assert.equal(service.revokeDevice(enrolled.deviceId), true);
  await assert.rejects(service.authenticateDevice(enrolled.deviceId, enrolled.secret), (error: unknown) => {
    assert.equal((error as ExperienceSecurityError).code, "device_revoked");
    return true;
  });
});

test("device sessions are scoped, expiring, hash-at-rest, and revoked with their device", async () => {
  const { db, service, events, advance } = fixture();
  const enrolled = await service.enrollDevice({ name: "Remote phone" }, "dev_remote");
  const issued = service.issueDeviceSession(
    enrolled.deviceId,
    ["experience:read", "session:read"],
    60_000,
    enrolled.deviceId,
    { envelope_ids: ["primary"], project_ids: [], session_ids: ["ses_a"], run_ids: [], artifact_ids: [] },
  );
  const row = db.prepare(`SELECT * FROM experience_device_sessions WHERE id = ?`).get(issued.sessionId) as Record<string, unknown>;
  assert.equal(JSON.stringify(row).includes(issued.token), false);
  assert.equal(JSON.stringify(row).includes(issued.token.split(".")[1]!), false);
  assert.deepEqual(service.authenticateDeviceSession(issued.token, "experience:read").scopes, ["experience:read", "session:read"]);
  assert.equal(service.authenticateDeviceSession(issued.token, "session:read", { kind: "session_ids", id: "ses_a" }).sessionId, issued.sessionId);
  assert.throws(
    () => service.authenticateDeviceSession(issued.token, "session:read", { kind: "session_ids", id: "ses_other" }),
    (error: unknown) => {
      assert.equal((error as ExperienceSecurityError).code, "scope_denied");
      return true;
    },
  );
  assert.throws(() => service.authenticateDeviceSession(issued.token, "session:steer"), (error: unknown) => {
    assert.equal((error as ExperienceSecurityError).code, "scope_denied");
    return true;
  });
  assert.equal(events.some((event) => JSON.stringify(event).includes(issued.token)), false);

  advance(60_000);
  assert.throws(() => service.authenticateDeviceSession(issued.token), (error: unknown) => {
    assert.equal((error as ExperienceSecurityError).code, "device_session_expired");
    return true;
  });

  const replacement = service.issueDeviceSession(enrolled.deviceId, ["experience:read"], 60_000);
  assert.equal(service.revokeDevice(enrolled.deviceId), true);
  assert.throws(() => service.authenticateDeviceSession(replacement.token), (error: unknown) => {
    assert.equal((error as ExperienceSecurityError).code, "device_revoked");
    return true;
  });
});

test("individual device sessions can be revoked without revoking the device", async () => {
  const { service } = fixture();
  const enrolled = await service.enrollDevice({ name: "Remote IDE" });
  const issued = service.issueDeviceSession(enrolled.deviceId, ["state:read"], 60_000);
  assert.equal(service.revokeDeviceSession(issued.sessionId, enrolled.deviceId), true);
  assert.throws(() => service.authenticateDeviceSession(issued.token), (error: unknown) => {
    assert.equal((error as ExperienceSecurityError).code, "device_session_revoked");
    return true;
  });
  assert.deepEqual((await service.authenticateDevice(enrolled.deviceId, enrolled.secret)).metadata, { name: "Remote IDE" });
});

test("handoff is revision-bound, deep-linkable, hash-at-rest, and consume-once", async () => {
  const { db, service, events } = fixture();
  const device = await service.enrollDevice({ name: "Desktop" });
  const issued = service.issueHandoff({
    envelopeId: "env_primary",
    envelopeRevision: 42,
    createdByDeviceId: device.deviceId,
    ttlMs: 30_000,
  });
  assert.match(issued.handoffId, /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/);
  const row = db.prepare(`SELECT * FROM experience_handoffs WHERE id = ?`).get(issued.handoffId) as Record<string, unknown>;
  assert.equal(issued.deepLink.startsWith("floyd://handoff?"), true);
  assert.deepEqual(issued.deepLinkPayload, {
    version: 1,
    handoffId: issued.handoffId,
    token: issued.token,
    envelopeId: "env_primary",
    envelopeRevision: 42,
  });
  assert.equal(JSON.stringify(row).includes(issued.token), false);
  assert.equal(Buffer.from(row.token_hash as Uint8Array).length, 32);
  assert.equal(events.some((event) => JSON.stringify(event).includes(issued.token)), false);

  const consumed = service.consumeHandoff(issued.token, "dev_receiver");
  assert.equal(consumed.envelopeId, "env_primary");
  assert.equal(consumed.envelopeRevision, 42);
  assert.throws(() => service.consumeHandoff(issued.token), (error: unknown) => {
    assert.equal((error as ExperienceSecurityError).code, "handoff_consumed");
    return true;
  });
});

test("handoff consumption and resource-bound session issuance are atomic", async () => {
  const root = mkdtempSync(join(tmpdir(), "floyd-handoff-session-"));
  const db = new DatabaseSync(":memory:");
  ensureExperienceSecuritySchema(db);
  let fail = false;
  const service = new ExperienceSecurityService(db, {
    masterKeyPath: join(root, "experience.key"),
    evidence: (event) => {
      if (fail && event.type === "experience.handoff.consumed") throw new Error("evidence unavailable");
    },
  });
  const device = await service.enrollDevice({ name: "Receiver" }, "dev_receiver");
  const issued = service.issueHandoff({ envelopeId: "primary", envelopeRevision: 7 });
  const resources = { envelope_ids: ["primary"], project_ids: ["prj_a"], session_ids: ["ses_a"], run_ids: ["run_a"], artifact_ids: ["art_a"] };

  fail = true;
  assert.throws(() => service.consumeHandoffForDevice(issued.token, device.deviceId, () => resources), /evidence unavailable/);
  assert.equal((db.prepare(`SELECT COUNT(*) AS count FROM experience_device_sessions`).get() as { count: number }).count, 0);
  assert.equal((db.prepare(`SELECT consumed_at FROM experience_handoffs WHERE id = ?`).get(issued.handoffId) as { consumed_at: string | null }).consumed_at, null);

  fail = false;
  const consumed = service.consumeHandoffForDevice(issued.token, device.deviceId, (envelopeId, revision) => {
    assert.equal(envelopeId, "primary");
    assert.equal(revision, 7);
    return resources;
  });
  assert.deepEqual(consumed.session.resources, resources);
  assert.equal(service.authenticateDeviceSession(
    consumed.session.token,
    "artifact:read",
    { kind: "artifact_ids", id: "art_a" },
  ).deviceId, device.deviceId);
});

test("device grants cap issued scopes and revocation invalidates sessions and outstanding handoffs", async () => {
  const { db, service } = fixture();
  const device = await service.enrollDevice({ name: "Read-only" }, "dev_read", ["health:read", "experience:read"]);
  const session = service.issueDeviceSession(device.deviceId, ["health:read", "experience:write"]);
  assert.deepEqual(session.scopes, ["health:read"]);
  const handoff = service.issueHandoff({ envelopeId: "primary", envelopeRevision: 1, createdByDeviceId: device.deviceId });
  assert.equal(service.revokeDevice(device.deviceId), true);
  assert.throws(() => service.authenticateDeviceSession(session.token), (error: unknown) => {
    assert.equal((error as ExperienceSecurityError).code, "device_revoked");
    return true;
  });
  const handoffRow = db.prepare(`SELECT revoked_at FROM experience_handoffs WHERE id = ?`).get(handoff.handoffId) as { revoked_at: string | null };
  assert.notEqual(handoffRow.revoked_at, null);
});

test("expired, forged, and revoked handoffs fail closed", () => {
  const { service, advance } = fixture();
  const expired = service.issueHandoff({ envelopeId: "env_a", envelopeRevision: 1, ttlMs: 5_000 });
  advance(5_000);
  assert.throws(() => service.consumeHandoff(expired.token), (error: unknown) => {
    assert.equal((error as ExperienceSecurityError).code, "handoff_expired");
    return true;
  });

  const revoked = service.issueHandoff({ envelopeId: "env_a", envelopeRevision: 2 });
  assert.equal(service.revokeHandoff(revoked.handoffId), true);
  assert.throws(() => service.consumeHandoff(revoked.token), (error: unknown) => {
    assert.equal((error as ExperienceSecurityError).code, "handoff_revoked");
    return true;
  });

  const forged = `${revoked.token.slice(0, -1)}${revoked.token.endsWith("A") ? "B" : "A"}`;
  assert.throws(() => service.consumeHandoff(forged), (error: unknown) => {
    assert.equal((error as ExperienceSecurityError).code, "handoff_invalid");
    return true;
  });
});

test("insecure pre-existing master key permissions are rejected", () => {
  const root = mkdtempSync(join(tmpdir(), "floyd-experience-keymode-"));
  const keyPath = join(root, "experience.key");
  writeFileSync(keyPath, Buffer.alloc(32), { mode: 0o600 });
  chmodSync(keyPath, 0o644);
  const db = new DatabaseSync(":memory:");
  assert.throws(() => new ExperienceSecurityService(db, { masterKeyPath: keyPath }), (error: unknown) => {
    assert.equal((error as ExperienceSecurityError).code, "master_key_invalid");
    return true;
  });
});

test("untrusted metadata and handoff lifetimes are strictly bounded", async () => {
  const { service } = fixture();
  await assert.rejects(service.enrollDevice({ payload: "x".repeat(17 * 1024) }), (error: unknown) => {
    assert.equal((error as ExperienceSecurityError).code, "invalid_input");
    return true;
  });
  assert.throws(
    () => service.issueHandoff({ envelopeId: "env_bounded", envelopeRevision: 0, ttlMs: 4_999 }),
    (error: unknown) => {
      assert.equal((error as ExperienceSecurityError).code, "invalid_input");
      return true;
    },
  );
});

test("legacy enrolled devices receive explicit grants during the one-time schema migration", () => {
  const db = new DatabaseSync(":memory:");
  db.exec(`CREATE TABLE experience_devices (
    id TEXT PRIMARY KEY,
    secret_salt BLOB NOT NULL,
    secret_verifier BLOB NOT NULL,
    metadata_iv BLOB NOT NULL,
    metadata_tag BLOB NOT NULL,
    metadata_ciphertext BLOB NOT NULL,
    created_at TEXT NOT NULL,
    last_authenticated_at TEXT,
    revoked_at TEXT
  )`);
  db.prepare(
    `INSERT INTO experience_devices
     (id, secret_salt, secret_verifier, metadata_iv, metadata_tag, metadata_ciphertext, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run("dev_legacy", Buffer.alloc(16), Buffer.alloc(32), Buffer.alloc(12), Buffer.alloc(16), Buffer.alloc(1), "2026-07-01T00:00:00.000Z");
  ensureExperienceSecuritySchema(db);
  const row = db.prepare(`SELECT allowed_scopes_json FROM experience_devices WHERE id = ?`).get("dev_legacy") as { allowed_scopes_json: string };
  const scopes = JSON.parse(row.allowed_scopes_json) as string[];
  assert.equal(scopes.includes("health:read"), true);
  assert.equal(scopes.includes("experience:write"), true);
  assert.equal(scopes.includes("session:permission"), true);
});

test("security state rolls back when durable evidence persistence fails", async () => {
  const root = mkdtempSync(join(tmpdir(), "floyd-experience-evidence-"));
  const db = new DatabaseSync(":memory:");
  ensureExperienceSecuritySchema(db);
  let failOn: ExperienceSecurityEvent["type"] | null = "experience.device.enrolled";
  const service = new ExperienceSecurityService(db, {
    masterKeyPath: join(root, "experience.key"),
    evidence: (event) => {
      if (event.type === failOn) throw new Error("evidence unavailable");
    },
  });
  await assert.rejects(service.enrollDevice({ name: "rollback" }, "dev_rollback"), /evidence unavailable/);
  assert.equal((db.prepare(`SELECT COUNT(*) AS count FROM experience_devices`).get() as { count: number }).count, 0);

  failOn = null;
  const issued = service.issueHandoff({ envelopeId: "env_rollback", envelopeRevision: 1 });
  failOn = "experience.handoff.consumed";
  assert.throws(() => service.consumeHandoff(issued.token), /evidence unavailable/);
  const row = db.prepare(`SELECT consumed_at FROM experience_handoffs WHERE id = ?`).get(issued.handoffId) as { consumed_at: string | null };
  assert.equal(row.consumed_at, null);
});
