#!/bin/sh
set -eu

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
MANIFEST="$ROOT/ecosystem/surfaces.json"

node --input-type=module - "$MANIFEST" <<'NODE'
import { readFile } from "node:fs/promises";

const manifest = JSON.parse(await readFile(process.argv[2], "utf8"));
const expected = ["desktop", "ide", "tui", "pty", "launcher"];
const actual = manifest.surfaces.map(surface => surface.id);
if (JSON.stringify(actual) !== JSON.stringify(expected)) {
  throw new Error(`active surface mismatch: ${actual.join(",")}`);
}
for (const surface of manifest.surfaces) {
  if (!surface.copy_verified) throw new Error(`${surface.id}: copy not verified`);
  if (surface.direct_opencode_access !== false) throw new Error(`${surface.id}: direct OpenCode access is not prohibited`);
  if (!surface.integration?.commit) throw new Error(`${surface.id}: missing integration commit`);
  if (surface.integration.production_audit_vulnerabilities !== 0) throw new Error(`${surface.id}: production audit is not zero`);
  process.stdout.write(`${surface.id}\t${surface.intake_copy}\t${surface.integration.commit}\n`);
}
NODE

node --input-type=module <<'NODE'
import { readFile } from "node:fs/promises";

const token = (await readFile("/Volumes/Storage/FLOYD_RUNTIME/core/gateway.token", "utf8")).trim();
const response = await fetch("http://127.0.0.1:41414/api/health", {
  headers: { authorization: `Bearer ${token}` },
});
const health = await response.json();
if (!response.ok || health.ok !== true || health.engine?.ok !== true) {
  throw new Error(`Floyd Core health failed: HTTP ${response.status} ${JSON.stringify(health)}`);
}
process.stdout.write(`core\t${health.pid}\topencode\t${health.engine.pid}\n`);
NODE

tab=$(printf '\t')
node --input-type=module - "$MANIFEST" <<'NODE' | while IFS="$tab" read -r id copy expected_head; do
import { readFile } from "node:fs/promises";
const manifest = JSON.parse(await readFile(process.argv[2], "utf8"));
for (const surface of manifest.surfaces) {
  process.stdout.write(`${surface.id}\t${surface.intake_copy}\t${surface.integration.commit}\n`);
}
NODE
  actual_head=$(git -C "$copy" rev-parse HEAD)
  [ "$actual_head" = "$expected_head" ] || {
    printf '%s head mismatch: expected %s, got %s\n' "$id" "$expected_head" "$actual_head" >&2
    exit 1
  }
  [ -z "$(git -C "$copy" status --porcelain)" ] || {
    printf '%s intake copy is dirty\n' "$id" >&2
    exit 1
  }
  printf '%s\t%s\tclean\n' "$id" "$(printf '%s' "$actual_head" | cut -c1-12)"
done

printf 'ACTIVE_SURFACES PASS\n'
