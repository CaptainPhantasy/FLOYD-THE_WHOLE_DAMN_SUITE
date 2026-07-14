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
