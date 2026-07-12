/**
 * @floyd/contracts — canonical typed vocabulary for the Floyd ecosystem.
 * Floyd Core is the sole durable authority; every surface and engine adapter
 * speaks these shapes. Contracts precede providers (FABLE5_HANDOFF build order).
 */

// ---------- identity / lifecycle primitives ----------

export type FloydId = string; // `${prefix}_${ulid-ish}` e.g. prj_..., ses_..., run_..., job_...

export type RunStatus =
  | "created"
  | "running"
  | "waiting_review"
  | "accepted"
  | "rejected"
  | "escalated"
  | "failed"
  | "interrupted";

export type JobStatus =
  | "created"
  | "leased"
  | "running"
  | "waiting_review"
  | "succeeded"
  | "failed"
  | "interrupted"
  | "skipped_duplicate";

export type JobKind = "builder" | "reviewer";

// ---------- action envelopes (blueprint: required envelopes) ----------

export interface ActionRequest {
  id: FloydId;
  actor_id: string;
  device_id: string;
  project_id: FloydId;
  session_id: FloydId;
  run_id?: FloydId;
  job_id?: FloydId;
  capability: string;
  input: unknown;
  deadline_ms?: number;
  idempotency_key: string;
  requested_permissions: string[];
  correlation_id: string;
}

export type ObservationPhase = "queued" | "leased" | "running" | "waiting_review" | "terminal";
export type ObservationStatus = "success" | "warning" | "error";

export interface ActionObservation {
  phase: ObservationPhase;
  status: ObservationStatus;
  summary: string;
  next_actions: string[];
  artifacts: string[]; // artifact ids (sha256)
  evidence: string[]; // evidence event ids
  error?: { code: string; retriable: boolean; recovery: string; stop_reason?: string };
}

// ---------- durable entities ----------

export interface Project {
  id: FloydId;
  name: string;
  root_path: string;
  repo_path: string;
  test_command: string | null;
  created_at: string;
}

export interface Session {
  id: FloydId;
  project_id: FloydId;
  title: string;
  created_at: string;
}

export interface Run {
  id: FloydId;
  session_id: FloydId;
  project_id: FloydId;
  goal: string;
  status: RunStatus;
  created_at: string;
  updated_at: string;
}

export interface Job {
  id: FloydId;
  run_id: FloydId;
  kind: JobKind;
  status: JobStatus;
  idempotency_key: string;
  agent_spec_id: string;
  engine_session_id: string | null;
  worktree_lease_id: FloydId | null;
  result_json: string | null;
  created_at: string;
  updated_at: string;
}

export interface Lease {
  id: FloydId;
  resource_type: "worktree" | "pty" | "sandbox";
  resource_path: string;
  holder_job_id: FloydId;
  status: "active" | "released";
  acquired_at: string;
  released_at: string | null;
}

export interface Artifact {
  id: string; // sha256 hex — content address
  mime: string;
  bytes: number;
  label: string;
  created_at: string;
}

export interface EvidenceEvent {
  seq: number;
  id: string;
  ts: string;
  type: string;
  actor: string;
  project_id: string | null;
  session_id: string | null;
  run_id: string | null;
  job_id: string | null;
  correlation_id: string | null;
  payload: unknown;
}

export interface AgentSpec {
  id: string;
  name: string;
  role: JobKind;
  provider_profile_id: string;
  model: string;
  permission_policy: PermissionPolicy;
}

export type BillingClass = "subscription" | "payg" | "local";

export interface ProviderProfile {
  id: string;
  vendor: string;
  billing_class: BillingClass;
  plan_name: string;
  region: string;
  credential_ref: string; // broker reference — NEVER a credential value
  endpoint_class: string;
  model_allowlist: string[];
  approved: boolean;
  fallback_policy: "fail_closed";
}

export interface RouteReceipt {
  provider: string;
  model: string;
  billing_class: BillingClass;
  plan_name: string;
  region: string;
  project_id: FloydId;
  run_id: FloydId;
  job_id: FloydId;
  issued_at: string;
}

// ---------- permission gating ----------

export interface PermissionPolicy {
  /** permission kinds allowed when the target stays inside the leased worktree */
  allow_in_worktree: string[];
  /** permission kinds always rejected */
  deny: string[];
}

export interface PolicyDecision {
  request_id: string;
  session_id: string;
  kind: string;
  decision: "once" | "reject";
  reason: string;
  decided_at: string;
}

// ---------- engine adapter boundary ----------

export interface EngineSessionRef {
  engine: "opencode";
  engine_session_id: string;
  directory: string;
}

export const FLOYD_ID_PREFIXES = {
  project: "prj",
  session: "ses",
  run: "run",
  job: "job",
  lease: "lse",
  evidence: "evt",
} as const;
