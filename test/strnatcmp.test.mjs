// strnatcmp() must order like PHP's: the vectors are PHP's answers
import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {strnatcmp} from "../dist/esm/lib/php/strnatcmp.js";

const vectors = JSON.parse(readFileSync(new URL("./vectors/strnatcmp.json", import.meta.url), "utf8"));

const sign = (n) => (n > 0 ? 1 : n < 0 ? -1 : 0);

test("strnatcmp answers like PHP's strnatcmp() on every pair", () => {
  for (const c of vectors.cases) {
    assert.equal(sign(strnatcmp(c.a, c.b)), sign(c.result), `strnatcmp(${JSON.stringify(c.a)}, ${JSON.stringify(c.b)})`);
  }
});

test("a listing sorted with it puts file2 before file10", () => {
  const names = ["file10.jpg", "file2.jpg", "File3.jpg", "a.txt"];
  names.sort(strnatcmp);
  assert.deepEqual(names, ["File3.jpg", "a.txt", "file2.jpg", "file10.jpg"]);
});
