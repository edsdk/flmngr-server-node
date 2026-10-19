// The query parser must shape values like PHP's parse_str(): the vectors are PHP's results
import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {PhpQuery} from "../dist/esm/lib/php/PhpQuery.js";

const vectors = JSON.parse(readFileSync(new URL("./vectors/parse_str.json", import.meta.url), "utf8"));

test("PhpQuery.parse answers like parse_str() on every query", () => {
  for (const c of vectors.cases) {
    assert.deepEqual(PhpQuery.parse(c.query), c.result, `parse_str(${JSON.stringify(c.query)})`);
  }
});

test("PhpQuery.add builds the same shapes one field at a time (multipart)", () => {
  const target = {};
  PhpQuery.add(target, "action", "uploadFile");
  PhpQuery.add(target, "formatSuffixes[]", "-preview");
  PhpQuery.add(target, "formatSuffixes[]", "-medium");
  PhpQuery.add(target, "dir", "/a");
  PhpQuery.add(target, "dir", "/b");
  assert.deepEqual(target, {action: "uploadFile", formatSuffixes: ["-preview", "-medium"], dir: "/b"});
});
