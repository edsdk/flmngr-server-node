// Message.createMessage() keeps the PHP rule for which arguments are sent
import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {Message} from "../dist/esm/model/Message.js";
import {MessageException} from "../dist/esm/lib/MessageException.js";

const vectors = JSON.parse(readFileSync(new URL("./vectors/message.json", import.meta.url), "utf8"));

test("createMessage drops the same arguments PHP drops", () => {
  for (const c of vectors.cases) {
    const m = Message.createMessage(c.isCacheIssue === true, c.code, c.args[0], c.args[1], c.args[2]);
    assert.deepEqual(m.toJSON(), c.result, `createMessage(${JSON.stringify(c.args)})`);
  }
});

test("MessageException carries the message and a source", () => {
  const e = new MessageException(Message.createMessage(false, Message.FILE_TYPE_NOT_ALLOWED, "x.php"));
  assert.deepEqual(e.getFailMessage(), {code: 31, args: ["x.php"], isCacheIssue: false});
  assert.ok(e instanceof Error);
  assert.ok(e.getSourceException() instanceof Error);
  const wrapped = new MessageException(Message.createMessage(true, Message.FM_UNABLE_TO_DELETE_DIRECTORY), new Error("rmdir"));
  assert.equal(wrapped.getSourceException().message, "rmdir");
  assert.equal(wrapped.getFailMessage().isCacheIssue, true);
});
