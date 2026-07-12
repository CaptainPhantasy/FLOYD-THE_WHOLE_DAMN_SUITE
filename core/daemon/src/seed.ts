import type { Db } from "./db.ts";
import { appendEvidence } from "./evidence.ts";

/**
 * Durable bootstrap rows: the approved GLM provider profile and the two
 * AgentSpecs of the golden path. Idempotent. GLM Coding Plan is the ONLY
 * approved route (FABLE5_HANDOFF hard stop); everything else stays absent.
 */
export function seed(db: Db): void {
  const have = db.prepare(`SELECT id FROM provider_profiles WHERE id = 'glm-coding-plan'`).get();
  if (!have) {
    db.prepare(
      `INSERT INTO provider_profiles (id, vendor, billing_class, plan_name, region, credential_ref, endpoint_class, model_allowlist_json, approved, fallback_policy)
       VALUES ('glm-coding-plan', 'zai', 'subscription', 'GLM Coding Plan', 'global', 'omp-auth-broker:zai', 'coding-plan', ?, 1, 'fail_closed')`,
    ).run(JSON.stringify(["glm-4.6", "glm-4.5-air"]));
    appendEvidence(db, "provider.profile_seeded", "floyd-core", {
      id: "glm-coding-plan",
      billing_class: "subscription",
      credential_ref: "omp-auth-broker:zai",
      note: "only approved route; all other providers disabled by default",
    });
  }
  const specs = [
    {
      id: "builder-glm",
      name: "Floyd Builder",
      role: "builder",
      model: "glm-5.2",
      policy: { allow_in_worktree: ["edit", "bash", "read", "write", "glob", "grep", "list", "patch", "todowrite", "todoread"], deny: ["webfetch"] },
    },
    {
      id: "reviewer-glm",
      name: "Floyd Reviewer",
      role: "reviewer",
      model: "glm-5.2",
      policy: { allow_in_worktree: ["read", "glob", "grep", "list"], deny: ["edit", "write", "bash", "patch", "webfetch"] },
    },
  ];
  for (const s of specs) {
    const exists = db.prepare(`SELECT id FROM agent_specs WHERE id = ?`).get(s.id);
    if (!exists) {
      db.prepare(
        `INSERT INTO agent_specs (id, name, role, provider_profile_id, model, permission_policy_json) VALUES (?, ?, ?, 'glm-coding-plan', ?, ?)`,
      ).run(s.id, s.name, s.role, s.model, JSON.stringify(s.policy));
      appendEvidence(db, "agent.spec_seeded", "floyd-core", { id: s.id, role: s.role, model: s.model, policy: s.policy });
    }
  }
}
