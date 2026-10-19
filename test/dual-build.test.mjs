// Both builds load, agree on their exports and say which module system they are
import {test} from "node:test";
import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {readFileSync} from "node:fs";
import * as esm from "../dist/esm/index.js";

const require = createRequire(import.meta.url);

test("the CommonJS build exports what the ESM build exports", () => {
  const cjs = require("../dist/cjs/index.js");
  assert.deepEqual(Object.keys(cjs).sort(), Object.keys(esm).sort());
  assert.equal(typeof cjs.FlmngrServer.flmngrRequest, "function");
  assert.equal(typeof esm.FlmngrServer.flmngrRequest, "function");
});

test("each dist dir is marked with its module type", () => {
  assert.deepEqual(JSON.parse(readFileSync(new URL("../dist/esm/package.json", import.meta.url), "utf8")), {type: "module"});
  assert.deepEqual(JSON.parse(readFileSync(new URL("../dist/cjs/package.json", import.meta.url), "utf8")), {type: "commonjs"});
});

test("the package entry points resolve", () => {
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  assert.equal(pkg.exports["."].import.default, "./dist/esm/index.js");
  assert.equal(pkg.exports["."].require.default, "./dist/cjs/index.js");
  assert.equal(pkg.main, "./dist/cjs/index.js");
  for (const file of [pkg.main, pkg.types, pkg.exports["."].import.default, pkg.exports["."].import.types]) {
    readFileSync(new URL("../" + file, import.meta.url));
  }
});
