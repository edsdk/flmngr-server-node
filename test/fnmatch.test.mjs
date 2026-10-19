// fnmatch() must answer like PHP's: the vectors are what PHP answered for every pattern/subject pair
import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {fnmatch, FNM_CASEFOLD} from "../dist/esm/lib/php/fnmatch.js";

const vectors = JSON.parse(readFileSync(new URL("./vectors/fnmatch.json", import.meta.url), "utf8"));

test("the casefold flag has PHP's value", () => {
  assert.equal(FNM_CASEFOLD, vectors.casefold);
});

test("fnmatch answers like PHP's fnmatch() on every vector", () => {
  let count = 0;
  for (const c of vectors.cases) {
    assert.equal(
      fnmatch(c.pattern, c.subject, c.flags),
      c.result,
      `fnmatch(${JSON.stringify(c.pattern)}, ${JSON.stringify(c.subject)}, ${c.flags})`
    );
    count++;
  }
  assert.ok(count > 1000, "the vector file holds the full matrix");
});

test("the deny list patterns match the way the backend relies on", () => {
  assert.equal(fnmatch("*.php*", "x.PHP.jpg", FNM_CASEFOLD), true);
  assert.equal(fnmatch("*.php*", "x.PHP.jpg", 0), false);
  assert.equal(fnmatch(".htaccess", ".htaccess", FNM_CASEFOLD), true);
  assert.equal(fnmatch("*.png", "dir/a.png"), true);
  assert.equal(fnmatch("**", "anything/at all.txt"), true);
});
