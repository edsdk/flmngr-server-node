// The name helpers must answer like the PHP backend's Utils
import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {Utils} from "../dist/esm/lib/file/Utils.js";

const vectors = JSON.parse(readFileSync(new URL("./vectors/utils.json", import.meta.url), "utf8"));

test("getExt / getNameWithoutExt / isImage / getMimeType on every name", () => {
  for (const c of vectors.cases) {
    assert.equal(Utils.getExt(c.name), c.getExt, `getExt(${JSON.stringify(c.name)})`);
    assert.equal(Utils.getNameWithoutExt(c.name), c.getNameWithoutExt, `getNameWithoutExt(${JSON.stringify(c.name)})`);
    assert.equal(Utils.isImage(c.name), c.isImage, `isImage(${JSON.stringify(c.name)})`);
    assert.equal(Utils.getMimeType(c.name), c.getMimeType, `getMimeType(${JSON.stringify(c.name)})`);
  }
});

test("endsWith keeps the empty-ending rule", () => {
  for (const c of vectors.endsWith) {
    assert.equal(Utils.endsWith(c.str, c.ends), c.result, `endsWith(${JSON.stringify(c.str)}, ${JSON.stringify(c.ends)})`);
  }
});
