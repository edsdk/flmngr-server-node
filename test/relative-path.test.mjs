// The path guard and the file name check answer like the PHP backend's: the vectors hold its
// answers for a root named "files" and for an empty root name
import {test} from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync, mkdirSync, rmSync, readFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {FileSystem} from "../dist/esm/fs/FileSystem.js";
import {MessageException} from "../dist/esm/lib/MessageException.js";

const paths = JSON.parse(readFileSync(new URL("./vectors/relative-path.json", import.meta.url), "utf8"));
const names = JSON.parse(readFileSync(new URL("./vectors/filename-allowed.json", import.meta.url), "utf8"));

function outcome(fn) {
  try {
    return {result: fn()};
  } catch (e) {
    if (e instanceof MessageException) {
      const m = e.getFailMessage();
      return {error: m.code, args: m.args};
    }
    return {exception: e.constructor.name};
  }
}

function withFileSystem(config, fn) {
  const root = mkdtempSync(join(tmpdir(), "flmngr-test-"));
  mkdirSync(join(root, "files"));
  try {
    return fn(new FileSystem({dirFiles: join(root, "files"), dirCache: join(root, "cache"), ...config}));
  } finally {
    rmSync(root, {recursive: true, force: true});
  }
}

test("getRelativePath on every vector, with the root named files and with an empty root name", () => {
  withFileSystem({}, (fs) => {
    const cloudLike = () => "";
    for (const c of paths.cases) {
      if (c.rootDirName === "") {
        fs.driverFiles.getRootDirName = cloudLike;
      } else {
        delete fs.driverFiles.getRootDirName;
      }
      const expected = c.result !== undefined ? {result: c.result} : c.error !== undefined ? {error: c.error, args: c.args} : {exception: c.exception};
      assert.deepEqual(outcome(() => fs.getRelativePath(c.path)), expected, `getRelativePath(${JSON.stringify(c.path)}) root=${JSON.stringify(c.rootDirName)}`);
    }
  });
});

test("assertFileNameAllowed on every vector, default and custom deny lists", () => {
  for (const variant of ["default", "custom"]) {
    const config = variant === "custom" ? {denyFilePatterns: names.customPatterns} : {};
    withFileSystem(config, (fs) => {
      for (const c of names.cases.filter((x) => x.patterns === variant)) {
        const expected = c.result !== undefined ? {result: undefined} : c.error !== undefined ? {error: c.error, args: c.args} : {exception: c.exception};
        assert.deepEqual(outcome(() => fs.assertFileNameAllowed(c.name)), expected, `${variant}: ${JSON.stringify(c.name)}`);
      }
    });
  }
});

// Names only test the patterns somebody thought of, so the list itself must match too
test("the default deny list is the PHP backend's, pattern for pattern and in the same order", () => {
  assert.deepEqual(FileSystem.DEFAULT_DENY_FILE_PATTERNS, names.defaultPatterns);
});
