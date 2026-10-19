// The paged listing must answer like the PHP backend's over the same fixed listing: order,
// filters, pages, formats. The vectors hold PHP's answers; the driver is replaced by the same
// fixed list of names, times and sizes the PHP side used.
import {test} from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync, mkdirSync, rmSync, readFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {basename, join} from "node:path";
import {FileSystem} from "../dist/esm/fs/FileSystem.js";
import {MessageException} from "../dist/esm/lib/MessageException.js";

const vectors = JSON.parse(readFileSync(new URL("./vectors/paging.json", import.meta.url), "utf8"));

function fixedDriver(driver, files) {
  const find = (p) => files.find((f) => "/" + f.name === p || f.name === basename(p));
  driver.files = () => files;
  driver.lastModified = (p) => (find(p) ? find(p).mtime : 0);
  driver.size = (p) => (find(p) ? find(p).size : 0);
}

test("reqGetFilesPaged answers like PHP on every request", () => {
  for (const c of vectors.cases) {
    const root = mkdtempSync(join(tmpdir(), "flmngr-paging-"));
    mkdirSync(join(root, "files"));
    try {
      const fs = new FileSystem({dirFiles: join(root, "files"), dirCache: join(root, "cache")});
      fixedDriver(fs.driverFiles, vectors.files);
      let outcome;
      try {
        outcome = {result: fs.reqGetFilesPaged({post: c.post, get: {}, files: {}, requestMethod: "POST"})};
      } catch (e) {
        outcome = e instanceof MessageException ? {error: e.getFailMessage().code} : {exception: e.constructor.name};
      }
      const expected = c.result !== undefined ? {result: c.result} : c.error !== undefined ? {error: c.error} : {exception: c.exception};
      assert.deepEqual(JSON.parse(JSON.stringify(outcome)), expected, c.name);
    } finally {
      rmSync(root, {recursive: true, force: true});
    }
  }
});
