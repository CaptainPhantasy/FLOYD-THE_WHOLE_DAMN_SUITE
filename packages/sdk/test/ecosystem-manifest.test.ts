import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

interface Surface {
  id: string;
  remote: string | null;
  local_source: string | null;
  direct_opencode_access: boolean;
  intake_copy: string;
  copy_verified: boolean;
}

test("ecosystem manifest names every active surface behind Floyd Core", () => {
  const manifest = JSON.parse(readFileSync(join(import.meta.dirname, "../../../ecosystem/surfaces.json"), "utf8")) as {
    authority: { core: string; coding_engine: string; surface_contract: string };
    surfaces: Surface[];
  };
  const expected = ["desktop", "ide", "tui", "pty", "launcher"];
  assert.deepEqual(manifest.surfaces.map((surface) => surface.id).sort(), expected.sort());
  assert.equal(manifest.authority.core, "Floyd Core");
  assert.match(manifest.authority.coding_engine, /OpenCode 1\.17\.18/);
  assert.equal(manifest.authority.surface_contract, "@floyd/sdk");
  for (const surface of manifest.surfaces) {
    assert.equal(surface.direct_opencode_access, false, `${surface.id} must not bypass Core`);
    assert.ok(surface.remote || surface.local_source, `${surface.id} needs verified provenance`);
    assert.equal(surface.copy_verified, true, `${surface.id} needs an independently verified copy`);
    assert.match(surface.intake_copy, new RegExp(`/intake/surfaces/${surface.id}$`));
  }
});
