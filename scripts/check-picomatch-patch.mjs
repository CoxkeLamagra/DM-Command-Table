import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync, existsSync, realpathSync } from "node:fs";
import path from "node:path";

export function resolveAuditPath(dependencyPath) {
  const names = dependencyPath.split(">");
  assert.equal(names.shift(), ".");
  let resolve = createRequire(import.meta.url);
  assert.equal(names.at(-1), "picomatch");
  for (const name of names) {
    assert.match(name, /^(?:@[a-z0-9._-]+\/)?[a-z0-9_-][a-z0-9._-]*$/i);
    // Some dependency containers export only subpaths, not a main entry. Anchor
    // resolution to their installed manifest without executing those packages.
    const manifest = resolve.resolve
      .paths(name)
      ?.map((directory) => path.join(directory, name, "package.json"))
      .find((filename) => existsSync(filename));
    assert.ok(manifest, `Installed dependency is missing: ${name}`);
    const filename = realpathSync(manifest);
    assert.equal(JSON.parse(readFileSync(filename, "utf8")).name, name);
    resolve = createRequire(filename);
  }
  return resolve.resolve("./");
}

export function checkPicomatchPatch(entry) {
  const manifest = JSON.parse(
    readFileSync(path.join(path.dirname(entry), "package.json"), "utf8"),
  );
  assert.equal(manifest.name, "picomatch");
  assert.ok(["2.3.2", "4.0.4"].includes(manifest.version));
  const picomatch = createRequire(import.meta.url)(entry);
  const error = {
    name: "SyntaxError",
    message: "Unbounded pattern repeats are disabled by local security policy",
  };
  for (const options of [
    {},
    { fastpaths: false },
    { regex: true },
    { maxExtglobRecursion: false },
    { capture: true, dot: true, nocase: true, windows: true },
  ]) {
    if (options.regex === true)
      for (const pattern of ["(a|aa)*b", "[ab]*b"])
        assert.throws(() => picomatch.makeRe(pattern, options), error);
    for (const pattern of [
      "(a|aa)+b",
      "(a+)+b",
      "*(?:(a|aa)+)b",
      "[ab]+b",
      "+(*)",
      "+(*a)",
      "*(*)",
      "*(*a)",
      "+(ab|abab)c",
      "+(a|aa)c",
      "+(literal)",
      "*(literal)",
      "@(+(*a))",
      "?(*(*a))",
      "!(*(*a))",
      "**/+(*a)b",
      "a/{b,+(*)}",
    ]) {
      assert.throws(() => picomatch.parse(pattern, options), error);
      assert.throws(() => picomatch.makeRe(pattern, options), error);
      assert.throws(() => picomatch(pattern, options), error);
      assert.throws(
        () => picomatch.isMatch("a".repeat(64) + "!", pattern, options),
        error,
      );
      assert.throws(
        () => picomatch.matchBase("a".repeat(64) + "!", pattern, options),
        error,
      );
    }
  }
  for (const [pattern, input, expected] of [
    ["**/*.ts", "server/api.ts", true],
    ["**/*.{ts,tsx}", "features/screen.tsx", true],
    ["**/*.{ts,tsx}", "notes.md", false],
    ["**/!(*.test).ts", "server/api.ts", true],
    ["**/!(*.test).ts", "server/api.test.ts", false],
    ["@(foo|bar).ts", "bar.ts", true],
    ["?(foo).ts", "foo.ts", true],
    ["[ab].ts", "a.ts", true],
    ['"+(foo)"', "+(foo)", true],
    ["\\+\\(foo\\)", "+(foo)", true],
  ])
    assert.equal(picomatch(pattern)(input), expected, pattern);
  return manifest.version;
}
