import { constants, closeSync, fchmodSync, fstatSync, mkdirSync, openSync, readFileSync, writeSync } from "node:fs";
import { dirname, isAbsolute } from "node:path";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import type { Db } from "./db.ts";

const MASTER_KEY_BYTES = 32;
const SECRET_BYTES = 32;
const MAX_SECRET_CHARS = 256;
const MAX_METADATA_BYTES = 16 * 1024;
const MAX_ID_CHARS = 128;
const MIN_HANDOFF_TTL_MS = 5_000;
const MAX_HANDOFF_TTL_MS = 15 * 60_000;
const DEFAULT_HANDOFF_TTL_MS = 2 * 60_000;
const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const HANDOFF_TOKEN = /^hnd_([A-Za-z0-9_-]{16})\.([A-Za-z0-9_-]{43})$/;

const SECURITY_SCHEMA = `
CREATE TABLE IF NOT EXISTS experience_devices (
  id TEXT PRIMARY KEY,
  secret_salt BLOB NOT NULL,
  secret_verifier BLOB NOT NULL,
  metadata_iv BLOB NOT NULL,
  metadata_tag BLOB NOT NULL,
  metadata_ciphertext BLOB NOT NULL,
  created_at TEXT NOT NULL,
  last_authenticated_at TEXT,
  revoked_at TEXT
);

CREATE TABLE IF NOT EXISTS experience_handoffs (
  id TEXT PRIMARY KEY,
  token_hash BLOB NOT NULL,
  envelope_id TEXT NOT NULL,
  envelope_revision INTEGER NOT NULL CHECK(envelope_revision >= 0),
  created_by_device_id TEXT,
  created_at TEXT NOT NULL,
  expires_at_ms INTEGER NOT NULL,
  consumed_at TEXT,
  revoked_at TEXT
);

CREATE INDEX IF NOT EXISTS experience_handoffs_expiry
  ON experience_handoffs(expires_at_ms) WHERE consumed_at IS NULL AND revoked_at IS NULL;
`;

export type ExperienceSecurityEvent = {
  type:
    | "experience.device.enrolled"
    | "experience.device.authenticated"
    | "experience.device.revoked"
    | "experience.handoff.issued"
    | "experience.handoff.consumed"
    | "experience.handoff.revoked";
  actor: string;
  payload: Readonly<Record<string, string | number | boolean | null>>;
};

export type ExperienceSecurityOptions = {
  masterKeyPath: string;
  now?: () => number;
  evidence?: (event: ExperienceSecurityEvent) => void;
};

export type DeviceEnrollment = {
  deviceId: string;
  secret: string;
  createdAt: string;
  keyId: string;
};

export type AuthenticatedDevice = {
  deviceId: string;
  metadata: Record<string, unknown>;
  authenticatedAt: string;
};

export type HandoffIssue = {
  handoffId: string;
  token: string;
  envelopeId: string;
  envelopeRevision: number;
  expiresAt: string;
  deepLink: string;
  deepLinkPayload: {
    version: 1;
    handoffId: string;
    token: string;
    envelopeId: string;
    envelopeRevision: number;
  };
};

export type HandoffConsumption = {
  handoffId: string;
  envelopeId: string;
  envelopeRevision: number;
  createdByDeviceId: string | null;
  consumedAt: string;
};

export class ExperienceSecurityError extends Error {
  readonly code:
    | "invalid_input"
    | "invalid_credentials"
    | "device_revoked"
    | "handoff_invalid"
    | "handoff_expired"
    | "handoff_consumed"
    | "handoff_revoked"
    | "handoff_stale"
    | "master_key_invalid";
  readonly httpStatus: number;

  constructor(
    code:
      | "invalid_input"
      | "invalid_credentials"
      | "device_revoked"
      | "handoff_invalid"
      | "handoff_expired"
      | "handoff_consumed"
      | "handoff_revoked"
      | "handoff_stale"
      | "master_key_invalid",
    message: string,
    httpStatus: number,
  ) {
    super(message);
    this.name = "ExperienceSecurityError";
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

type DeviceRow = {
  secret_salt: Uint8Array;
  secret_verifier: Uint8Array;
  metadata_iv: Uint8Array;
  metadata_tag: Uint8Array;
  metadata_ciphertext: Uint8Array;
  revoked_at: string | null;
};

type HandoffRow = {
  id: string;
  token_hash: Uint8Array;
  envelope_id: string;
  envelope_revision: number;
  created_by_device_id: string | null;
  expires_at_ms: number;
  consumed_at: string | null;
  revoked_at: string | null;
};

export function ensureExperienceSecuritySchema(db: Db): void {
  db.exec(SECURITY_SCHEMA);
}

/**
 * Owns device enrollment and one-time handoff authority for the portable
 * experience envelope. Provider keys and device secrets must never be passed
 * to the evidence callback; emitted payloads contain public identifiers only.
 */
export class ExperienceSecurityService {
  readonly db: Db;
  readonly keyId: string;
  readonly #key: Buffer;
  readonly #now: () => number;
  readonly #evidence?: (event: ExperienceSecurityEvent) => void;

  constructor(db: Db, options: ExperienceSecurityOptions) {
    this.db = db;
    ensureExperienceSecuritySchema(db);
    this.#key = loadOrCreateMasterKey(options.masterKeyPath);
    this.keyId = createHash("sha256").update(this.#key).digest("hex").slice(0, 16);
    this.#now = options.now ?? Date.now;
    this.#evidence = options.evidence;
  }

  async enrollDevice(metadata: Record<string, unknown>, requestedDeviceId?: string): Promise<DeviceEnrollment> {
    const deviceId = requestedDeviceId === undefined ? `dev_${randomBytes(12).toString("base64url")}` : validId(requestedDeviceId, "deviceId");
    const metadataJson = validMetadata(metadata);
    const secret = randomBytes(SECRET_BYTES).toString("base64url");
    const salt = randomBytes(16);
    const verifier = await deriveSecret(secret, salt);
    const encrypted = encryptMetadata(this.#key, deviceId, metadataJson);
    const createdAt = new Date(this.#now()).toISOString();

    this.db.exec("BEGIN IMMEDIATE");
    try {
      this.db
        .prepare(
          `INSERT INTO experience_devices
           (id, secret_salt, secret_verifier, metadata_iv, metadata_tag, metadata_ciphertext, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(deviceId, salt, verifier, encrypted.iv, encrypted.tag, encrypted.ciphertext, createdAt);
      this.#emit("experience.device.enrolled", deviceId, { device_id: deviceId, key_id: this.keyId });
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      if (String(error).includes("UNIQUE constraint failed")) invalid("deviceId is already enrolled");
      throw error;
    }
    return { deviceId, secret, createdAt, keyId: this.keyId };
  }

  async authenticateDevice(deviceIdInput: string, secret: string): Promise<AuthenticatedDevice> {
    const deviceId = validId(deviceIdInput, "deviceId");
    validSecret(secret);
    const row = this.db
      .prepare(
        `SELECT secret_salt, secret_verifier, metadata_iv, metadata_tag, metadata_ciphertext, revoked_at
         FROM experience_devices WHERE id = ?`,
      )
      .get(deviceId) as unknown as DeviceRow | undefined;

    // A dummy derivation makes unknown-device and wrong-secret paths comparable.
    const salt = row ? Buffer.from(row.secret_salt) : Buffer.alloc(16);
    const candidate = await deriveSecret(secret, salt);
    const stored = row ? Buffer.from(row.secret_verifier) : Buffer.alloc(candidate.length);
    const accepted = candidate.length === stored.length && timingSafeEqual(candidate, stored);
    if (!row || !accepted) throw new ExperienceSecurityError("invalid_credentials", "invalid device credentials", 401);
    if (row.revoked_at) throw new ExperienceSecurityError("device_revoked", "device has been revoked", 403);

    const metadata = decryptMetadata(this.#key, deviceId, row);
    const authenticatedAt = new Date(this.#now()).toISOString();
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const current = this.db.prepare(`SELECT revoked_at FROM experience_devices WHERE id = ?`).get(deviceId) as { revoked_at: string | null } | undefined;
      if (!current || current.revoked_at) throw new ExperienceSecurityError("device_revoked", "device has been revoked", 403);
      this.db.prepare(`UPDATE experience_devices SET last_authenticated_at = ? WHERE id = ?`).run(authenticatedAt, deviceId);
      this.#emit("experience.device.authenticated", deviceId, { device_id: deviceId });
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
    return { deviceId, metadata, authenticatedAt };
  }

  revokeDevice(deviceIdInput: string, actor = "core"): boolean {
    const deviceId = validId(deviceIdInput, "deviceId");
    const revokedAt = new Date(this.#now()).toISOString();
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const result = this.db
        .prepare(`UPDATE experience_devices SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL`)
        .run(revokedAt, deviceId);
      const revoked = Number(result.changes) === 1;
      if (revoked) this.#emit("experience.device.revoked", actor, { device_id: deviceId });
      this.db.exec("COMMIT");
      return revoked;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  issueHandoff(input: {
    envelopeId: string;
    envelopeRevision: number;
    createdByDeviceId?: string;
    ttlMs?: number;
  }): HandoffIssue {
    const envelopeId = validId(input.envelopeId, "envelopeId");
    const revision = validRevision(input.envelopeRevision);
    const createdBy = input.createdByDeviceId === undefined ? null : validId(input.createdByDeviceId, "createdByDeviceId");
    const ttlMs = input.ttlMs ?? DEFAULT_HANDOFF_TTL_MS;
    if (!Number.isSafeInteger(ttlMs) || ttlMs < MIN_HANDOFF_TTL_MS || ttlMs > MAX_HANDOFF_TTL_MS) {
      invalid(`ttlMs must be an integer between ${MIN_HANDOFF_TTL_MS} and ${MAX_HANDOFF_TTL_MS}`);
    }
    if (createdBy && !this.db.prepare(`SELECT id FROM experience_devices WHERE id = ? AND revoked_at IS NULL`).get(createdBy)) {
      throw new ExperienceSecurityError("invalid_credentials", "creating device is unknown or revoked", 401);
    }

    // Raw base64url may begin with '-' or '_', which is valid entropy but not
    // a valid route ID. Regenerate that rare leading character without
    // changing the published 16-character handoff token format.
    let handoffId: string;
    do handoffId = randomBytes(12).toString("base64url");
    while (!IDENTIFIER.test(handoffId));
    const tokenSecret = randomBytes(SECRET_BYTES).toString("base64url");
    const token = `hnd_${handoffId}.${tokenSecret}`;
    const tokenHash = hashTokenSecret(tokenSecret);
    const now = this.#now();
    const createdAt = new Date(now).toISOString();
    const expiresAtMs = now + ttlMs;
    const deepLinkPayload = { version: 1 as const, handoffId, token, envelopeId, envelopeRevision: revision };
    const query = new URLSearchParams({
      v: "1",
      id: handoffId,
      token,
      envelope: envelopeId,
      revision: String(revision),
    });
    this.db.exec("BEGIN IMMEDIATE");
    try {
      this.db
        .prepare(
          `INSERT INTO experience_handoffs
           (id, token_hash, envelope_id, envelope_revision, created_by_device_id, created_at, expires_at_ms)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(handoffId, tokenHash, envelopeId, revision, createdBy, createdAt, expiresAtMs);
      this.#emit("experience.handoff.issued", createdBy ?? "core", {
        handoff_id: handoffId,
        envelope_id: envelopeId,
        envelope_revision: revision,
        expires_at_ms: expiresAtMs,
      });
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
    return {
      handoffId,
      token,
      envelopeId,
      envelopeRevision: revision,
      expiresAt: new Date(expiresAtMs).toISOString(),
      deepLink: `floyd://handoff?${query.toString()}`,
      deepLinkPayload,
    };
  }

  consumeHandoff(
    tokenInput: string,
    actorDeviceId?: string,
    validateRevision?: (envelopeId: string, envelopeRevision: number) => void,
  ): HandoffConsumption {
    const { id, secret } = parseHandoffToken(tokenInput);
    const actor = actorDeviceId === undefined ? "unclaimed-device" : validId(actorDeviceId, "actorDeviceId");
    this.db.exec("BEGIN IMMEDIATE");
    let committed = false;
    try {
      const row = this.db.prepare(`SELECT * FROM experience_handoffs WHERE id = ?`).get(id) as unknown as HandoffRow | undefined;
      verifyHandoffSecret(row, secret);
      if (row!.revoked_at) throw new ExperienceSecurityError("handoff_revoked", "handoff has been revoked", 410);
      if (row!.consumed_at) throw new ExperienceSecurityError("handoff_consumed", "handoff has already been consumed", 409);
      if (this.#now() >= row!.expires_at_ms) throw new ExperienceSecurityError("handoff_expired", "handoff has expired", 410);
      // The caller validates against its authoritative envelope inside this
      // same IMMEDIATE transaction. A stale token is not consumed, so a failed
      // attach never burns an otherwise inspectable/revocable credential.
      validateRevision?.(row!.envelope_id, row!.envelope_revision);

      const consumedAt = new Date(this.#now()).toISOString();
      const update = this.db
        .prepare(`UPDATE experience_handoffs SET consumed_at = ? WHERE id = ? AND consumed_at IS NULL AND revoked_at IS NULL`)
        .run(consumedAt, id);
      if (Number(update.changes) !== 1) throw new ExperienceSecurityError("handoff_consumed", "handoff has already been consumed", 409);
      this.#emit("experience.handoff.consumed", actor, {
        handoff_id: id,
        envelope_id: row!.envelope_id,
        envelope_revision: row!.envelope_revision,
      });
      this.db.exec("COMMIT");
      committed = true;
      return {
        handoffId: id,
        envelopeId: row!.envelope_id,
        envelopeRevision: row!.envelope_revision,
        createdByDeviceId: row!.created_by_device_id,
        consumedAt,
      };
    } catch (error) {
      if (!committed) this.db.exec("ROLLBACK");
      throw error;
    }
  }

  /** Core-authority operation backing DELETE /api/handoffs/:id. */
  revokeHandoff(handoffIdInput: string, actor = "core"): boolean {
    const id = validId(handoffIdInput, "handoffId");
    this.db.exec("BEGIN IMMEDIATE");
    let committed = false;
    try {
      const row = this.db.prepare(`SELECT * FROM experience_handoffs WHERE id = ?`).get(id) as unknown as HandoffRow | undefined;
      if (!row) {
        this.db.exec("COMMIT");
        committed = true;
        return false;
      }
      const revokedAt = new Date(this.#now()).toISOString();
      const result = this.db
        .prepare(`UPDATE experience_handoffs SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL AND consumed_at IS NULL`)
        .run(revokedAt, id);
      const revoked = Number(result.changes) === 1;
      if (revoked) this.#emit("experience.handoff.revoked", actor, { handoff_id: id, envelope_id: row.envelope_id });
      this.db.exec("COMMIT");
      committed = true;
      return revoked;
    } catch (error) {
      if (!committed) this.db.exec("ROLLBACK");
      throw error;
    }
  }

  #emit(type: ExperienceSecurityEvent["type"], actor: string, payload: ExperienceSecurityEvent["payload"]): void {
    this.#evidence?.({ type, actor, payload });
  }
}

function loadOrCreateMasterKey(path: string): Buffer {
  if (!isAbsolute(path) || path.length > 4096 || path.includes("\0")) {
    throw new ExperienceSecurityError("master_key_invalid", "master key path must be a valid absolute path", 500);
  }
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  let fd: number | undefined;
  try {
    fd = openSync(path, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
    writeSync(fd, randomBytes(MASTER_KEY_BYTES));
    fchmodSync(fd, 0o600);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
  } finally {
    if (fd !== undefined) closeSync(fd);
  }

  let readFd: number | undefined;
  try {
    readFd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    const stat = fstatSync(readFd);
    if (!stat.isFile() || stat.nlink !== 1 || (stat.mode & 0o777) !== 0o600) {
      throw new ExperienceSecurityError("master_key_invalid", "master key must be a regular, singly-linked 0600 file", 500);
    }
    if (typeof process.getuid === "function" && stat.uid !== process.getuid()) {
      throw new ExperienceSecurityError("master_key_invalid", "master key must be owned by the Core user", 500);
    }
    const key = readFileSync(readFd);
    if (key.length !== MASTER_KEY_BYTES) {
      throw new ExperienceSecurityError("master_key_invalid", `master key must contain exactly ${MASTER_KEY_BYTES} bytes`, 500);
    }
    return key;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ELOOP") {
      throw new ExperienceSecurityError("master_key_invalid", "master key must not be a symbolic link", 500);
    }
    throw error;
  } finally {
    if (readFd !== undefined) closeSync(readFd);
  }
}

async function deriveSecret(secret: string, salt: Uint8Array): Promise<Buffer> {
  return await new Promise<Buffer>((resolve, reject) => {
    scryptCallback(secret, salt, 32, { N: 16_384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

function validSecret(secret: string): void {
  if (typeof secret !== "string" || secret.length < 32 || secret.length > MAX_SECRET_CHARS) {
    throw new ExperienceSecurityError("invalid_credentials", "invalid device credentials", 401);
  }
}

function validId(value: string, field: string): string {
  if (typeof value !== "string" || value.length > MAX_ID_CHARS || !IDENTIFIER.test(value)) invalid(`${field} is invalid`);
  return value;
}

function validRevision(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0) invalid("envelopeRevision must be a non-negative safe integer");
  return value;
}

function validMetadata(metadata: Record<string, unknown>): string {
  if (metadata === null || typeof metadata !== "object" || Array.isArray(metadata) || Object.getPrototypeOf(metadata) !== Object.prototype) {
    invalid("metadata must be a plain object");
  }
  let json: string;
  try {
    json = JSON.stringify(metadata);
  } catch {
    invalid("metadata must be JSON serializable");
  }
  if (json === undefined || Buffer.byteLength(json) > MAX_METADATA_BYTES) invalid(`metadata exceeds ${MAX_METADATA_BYTES} bytes`);
  return json;
}

function encryptMetadata(key: Uint8Array, deviceId: string, plaintext: string): { iv: Buffer; tag: Buffer; ciphertext: Buffer } {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(`floyd-device-metadata:v1:${deviceId}`));
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return { iv, tag: cipher.getAuthTag(), ciphertext };
}

function decryptMetadata(key: Uint8Array, deviceId: string, row: DeviceRow): Record<string, unknown> {
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, row.metadata_iv);
    decipher.setAAD(Buffer.from(`floyd-device-metadata:v1:${deviceId}`));
    decipher.setAuthTag(Buffer.from(row.metadata_tag));
    const plaintext = Buffer.concat([decipher.update(row.metadata_ciphertext), decipher.final()]);
    return JSON.parse(plaintext.toString("utf8")) as Record<string, unknown>;
  } catch {
    throw new ExperienceSecurityError("master_key_invalid", "device metadata authentication failed", 500);
  }
}

function parseHandoffToken(token: string): { id: string; secret: string } {
  if (typeof token !== "string" || token.length > MAX_SECRET_CHARS) {
    throw new ExperienceSecurityError("handoff_invalid", "invalid handoff token", 401);
  }
  const match = HANDOFF_TOKEN.exec(token);
  if (!match) throw new ExperienceSecurityError("handoff_invalid", "invalid handoff token", 401);
  return { id: match[1]!, secret: match[2]! };
}

function hashTokenSecret(secret: string): Buffer {
  return createHash("sha256").update(secret, "utf8").digest();
}

function verifyHandoffSecret(row: HandoffRow | undefined, secret: string): asserts row is HandoffRow {
  const candidate = hashTokenSecret(secret);
  const stored = row ? Buffer.from(row.token_hash) : Buffer.alloc(candidate.length);
  if (!row || candidate.length !== stored.length || !timingSafeEqual(candidate, stored)) {
    throw new ExperienceSecurityError("handoff_invalid", "invalid handoff token", 401);
  }
}

function invalid(message: string): never {
  throw new ExperienceSecurityError("invalid_input", message, 400);
}
