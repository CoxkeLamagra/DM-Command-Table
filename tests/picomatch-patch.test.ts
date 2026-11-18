import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import {
  checkPicomatchPatch,
  resolveAuditPath,
} from "../scripts/check-picomatch-patch.mjs";

const paths = [
  ".>eslint-config-next>@next/eslint-plugin-next>fast-glob>micromatch>picomatch",
  ".>eslint-config-next>eslint-import-resolver-typescript>tinyglobby>picomatch",
];

test("all installed picomatch families reject repeated extglobs without changing ordinary tooling globs", () => {
  assert.deepEqual(
    paths.map((chain) => checkPicomatchPatch(resolveAuditPath(chain))),
    ["2.3.2", "4.0.4"],
  );
  for (const chain of paths) {
    const entry = resolveAuditPath(chain);
    const program = `const p=require(${JSON.stringify(entry)});
      for(const pattern of ['(a|aa)+b','(a+)+b','*(?:(a|aa)+)b','+(*)b','+(*a)b','*(*)b','*(ab|abab)c','+(ab|abab)c','**/@(+(*a))b']) {
        let rejected=false;
        try { p(pattern)('ab'.repeat(100)+'!'); }
        catch(error) { if(error instanceof SyntaxError)rejected=true;else throw error; }
        if(!rejected)process.exit(2);
      }`;
    const result = spawnSync(process.execPath, ["-e", program], {
      encoding: "utf8",
      timeout: 2000,
    });
    assert.equal(result.error, undefined);
    assert.equal(result.status, 0, result.stderr);
  }
});

test("audit accepts only verified development picomatch copies and keeps unrelated findings blocking", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "dmct-audit-policy-"));
  const script = path.join(directory, "pnpm");
  const finding = { version: "2.3.2", dev: true, paths: [paths[0]] };
  const advisory = {
    github_advisory_id: "GHSA-fc5q-39xc-vjpf",
    module_name: "picomatch",
    severity: "high",
    findings: [finding],
  };
  const run = (value: unknown) => {
    writeFileSync(
      script,
      "#!/usr/bin/env node\nprocess.stdout.write(" +
        JSON.stringify(JSON.stringify(value)) +
        ");process.exit(1);\n",
      { mode: 0o700 },
    );
    return spawnSync(process.execPath, ["scripts/audit-dependencies.mjs"], {
      cwd: process.cwd(),
      encoding: "utf8",
      timeout: 5000,
      env: {
        ...process.env,
        PATH: directory + path.delimiter + process.env.PATH,
      },
    });
  };
  try {
    assert.equal(run({ metadata: {}, advisories: { a: advisory } }).status, 0);
    assert.equal(
      run({
        metadata: {},
        advisories: {
          a: { ...advisory, findings: [{ ...finding, dev: false }] },
        },
      }).status,
      1,
    );
    assert.equal(
      run({
        metadata: {},
        advisories: {
          a: { ...advisory, findings: [{ ...finding, version: "4.0.7" }] },
        },
      }).status,
      1,
    );
    assert.equal(
      run({
        metadata: {},
        advisories: {
          a: advisory,
          b: { ...advisory, github_advisory_id: "GHSA-unrelated" },
        },
      }).status,
      1,
    );
    assert.equal(
      run({
        metadata: {},
        error: { message: "Registry failed" },
        advisories: {},
      }).status,
      1,
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
