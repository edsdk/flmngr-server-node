// The BlurHash encoder gives the reference encoder's output: the vectors hold the hashes npm
// "blurhash" 2.0.5 produced for generated images, the same ones the PHP backend's tests use
import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {BlurHash} from "../dist/esm/lib/file/BlurHash.js";

const vectors = JSON.parse(readFileSync(new URL("./vectors/blurhash-vectors.json", import.meta.url), "utf8"));

const div = (a, b) => Math.floor(a / b);

// Integer maths only, so every implementation builds the same bytes
function pixels(pattern, w, h, seed) {
  let state = seed;
  const next = () => (state = (state * 48271) % 2147483647);
  const rows = [];
  for (let y = 0; y < h; y++) {
    const row = [];
    for (let x = 0; x < w; x++) {
      let p;
      if (pattern === "solid") {
        p = [(seed * 37) % 256, (seed * 101) % 256, (seed * 173) % 256];
      } else if (pattern === "noise") {
        p = [next() % 256, next() % 256, next() % 256];
      } else if (pattern === "gradient") {
        p = [div(255 * x, Math.max(1, w - 1)), div(255 * y, Math.max(1, h - 1)), (seed * 53) % 256];
      } else if (pattern === "stripes") {
        p = div(x, (seed % 5) + 1) % 2 ? [20, 40, 200] : [250, 230, 30];
      } else if (pattern === "checker") {
        const size = (seed % 7) + 2;
        p = (div(x, size) + div(y, size)) % 2 ? [0, 0, 0] : [255, 255, 255];
      } else {
        // "scene": a gradient with a red and a blue block on it
        p = [div(255 * x, w - 1), div(255 * y, h - 1), 128];
        if (x >= div(w, 6) && x < div(w, 2) && y >= div(h, 4) && y < div(h * 5, 8)) p = [250, 30, 30];
        if (x >= div(w * 7, 12) && x < div(w * 11, 12) && y >= div(h * 3, 8) && y < div(h * 7, 8)) p = [20, 40, 200];
      }
      row.push(p);
    }
    rows.push(row);
  }
  return rows;
}

test("matches the reference encoder on every vector", () => {
  for (const c of vectors) {
    assert.equal(BlurHash.encode(pixels(c.pattern, c.width, c.height, c.seed), c.x, c.y), c.hash,
      `${c.pattern} ${c.width}x${c.height} seed ${c.seed} ${c.x}x${c.y}`);
  }
});

test("the length and the size digit follow the component counts", () => {
  const img = pixels("gradient", 8, 6, 3);
  for (let x = 1; x <= 9; x++) {
    for (let y = 1; y <= 9; y++) {
      const hash = BlurHash.encode(img, x, y);
      assert.equal(hash.length, 4 + 2 * x * y);
      assert.equal(BlurHash.DIGITS.indexOf(hash[0]), x - 1 + (y - 1) * 9);
    }
  }
});

test("a flat image keeps its colour", () => {
  const hash = BlurHash.encode([[[200, 100, 50]]], 1, 1);
  assert.equal(hash.length, 6);
  // the DC term is the average colour in sRGB, written in four base-83 digits
  let value = 0;
  for (const ch of hash.substring(2)) {
    value = value * 83 + BlurHash.DIGITS.indexOf(ch);
  }
  assert.deepEqual([(value >> 16) & 255, (value >> 8) & 255, value & 255], [200, 100, 50]);
});

test("throws on bad component counts and an empty image", () => {
  assert.throws(() => BlurHash.encode([[[0, 0, 0]]], 0, 3), RangeError);
  assert.throws(() => BlurHash.encode([[[0, 0, 0]]], 4, 10), RangeError);
  assert.throws(() => BlurHash.encode([], 4, 3), RangeError);
  assert.throws(() => BlurHash.encode([[]], 4, 3), RangeError);
});
