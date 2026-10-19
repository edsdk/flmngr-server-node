// How a request reaches the library: the codec, the legacy four-getter interface, the size parser
import {test} from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync, rmSync, existsSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {FlmngrServer, CommonRequest} from "../dist/esm/index.js";

function fakeRequest(method, post, get = {}, files = {}) {
  return {
    getMethod: () => method,
    getPost: () => post,
    getGet: () => get,
    getFiles: () => files,
    getContentLength: () => null,
    getParameterNumber: () => 0,
    getParameterString: () => "",
    getParameterStringArray: () => [],
    getParameterFile: () => null,
  };
}

function call(config, request) {
  return new Promise((resolve) => {
    FlmngrServer.flmngrRequest({...config, request}, {
      onFinish: (status, headers, body) => resolve({status, headers, body}),
      onLogError: () => {},
    });
  });
}

test("codec 1 decodes the values of every parameter, lists included", async () => {
  const root = mkdtempSync(join(tmpdir(), "flmngr-req-"));
  try {
    const b64 = (s) => Buffer.from(s, "utf8").toString("base64");
    const r = await call({dirFiles: join(root, "files")}, fakeRequest("POST", {
      action: b64("fileListPaged"), dir: b64("/files"), maxFiles: b64("100"), orderBy: b64("name"),
      orderAsc: b64("true"), filter: b64("**"), formatIds: [b64("preview")], formatSuffixes: [b64("-preview")], codec: "1",
    }));
    assert.equal(r.status, 200);
    assert.equal(r.body.error, null);
    assert.deepEqual(r.body.data.files, []);
  } finally {
    rmSync(root, {recursive: true, force: true});
  }
});

test("an unknown codec is a server error, as the client is told to update", async () => {
  const root = mkdtempSync(join(tmpdir(), "flmngr-req-"));
  try {
    const r = await call({dirFiles: join(root, "files")}, fakeRequest("POST", {action: "getVersion", codec: "7"}));
    assert.equal(r.status, 500);
    assert.equal(typeof r.body, "string");
  } finally {
    rmSync(root, {recursive: true, force: true});
  }
});

test("a method other than GET and POST gets an empty answer", async () => {
  const root = mkdtempSync(join(tmpdir(), "flmngr-req-"));
  try {
    const r = await call({dirFiles: join(root, "files")}, fakeRequest("PUT", {action: "getVersion"}));
    assert.equal(r.status, 200);
    assert.equal(r.body, "");
  } finally {
    rmSync(root, {recursive: true, force: true});
  }
});

test("the legacy interface (four getters) is read by parameter name and spools the upload", () => {
  const root = mkdtempSync(join(tmpdir(), "flmngr-req-"));
  try {
    const values = {action: "uploadFile", dir: "/a", formatSuffixes: ["-preview"]};
    const legacy = {
      getParameterNumber: (name, d) => d,
      getParameterString: (name, d) => (typeof values[name] === "string" ? values[name] : d),
      getParameterStringArray: (name, d) => (Array.isArray(values[name]) ? values[name] : d),
      getParameterFile: (name) => (name === "file" ? {data: Buffer.from("hello"), fileName: "notes.txt"} : null),
    };
    const req = CommonRequest.from(legacy, {dirTmp: root});
    assert.equal(req.requestMethod, "POST");
    assert.deepEqual(req.post, values);
    assert.equal(req.files.file.name, "notes.txt");
    assert.equal(req.files.file.size, 5);
    assert.ok(existsSync(req.files.file.tmp_name));
  } finally {
    rmSync(root, {recursive: true, force: true});
  }
});

test("parseSize reads bytes with k/m/g suffixes", () => {
  assert.equal(FlmngrServer.parseSize("100M"), 100 * 1024 * 1024);
  assert.equal(FlmngrServer.parseSize("2g"), 2 * 1024 * 1024 * 1024);
  assert.equal(FlmngrServer.parseSize("512k"), 512 * 1024);
  assert.equal(FlmngrServer.parseSize(" 1024 "), 1024);
  assert.equal(FlmngrServer.parseSize(4096), 4096);
  assert.equal(FlmngrServer.parseSize(null), null);
  assert.equal(FlmngrServer.parseSize(undefined), null);
  assert.equal(FlmngrServer.parseSize(""), null);
  assert.equal(FlmngrServer.parseSize("lots"), null);
});
