// The SVG sanitizer must produce what the PHP backend's sanitizer (enshrined/svg-sanitize) does
import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {Sanitizer} from "../dist/esm/lib/svg/Sanitizer.js";

const vectors = JSON.parse(readFileSync(new URL("./vectors/svg.json", import.meta.url), "utf8"));

test("every sample sanitizes to the same text, rejection or error", () => {
  for (const c of vectors.cases) {
    if (c.exception !== undefined) {
      assert.throws(() => new Sanitizer().sanitize(c.input), `${c.name}: expected an error (${c.exception})`);
      continue;
    }
    const out = new Sanitizer().sanitize(c.input);
    assert.equal(out, c.output, c.name);
  }
});

test("a document that is not XML is refused, not cleaned", () => {
  assert.equal(new Sanitizer().sanitize("<svg><rect></svg"), false);
  assert.equal(new Sanitizer().sanitize(""), "");
});

test("scripts, handlers and javascript links never survive", () => {
  const out = new Sanitizer().sanitize(
    '<svg xmlns="http://www.w3.org/2000/svg" onload="x()"><script>1</script><a href="javascript:1"><rect width="1" height="1"/></a></svg>'
  );
  assert.ok(typeof out === "string");
  assert.ok(!/script|onload|javascript/i.test(out), out);
  assert.ok(/<rect /.test(out));
});
