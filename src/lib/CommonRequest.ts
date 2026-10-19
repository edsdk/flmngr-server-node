/**
 *
 * Flmngr server package for Node.
 *
 * This file is a part of the server side implementation of Flmngr -
 * the JavaScript/TypeScript file manager widely used for building apps and editors.
 *
 * Comes as a standalone package for custom integrations,
 * and as a part of N1ED web content builder.
 *
 * Flmngr file manager:       https://flmngr.com
 * N1ED web content builder:  https://n1ed.com
 * Developer website:         https://edsdk.com
 *
 * License: GNU General Public License Version 3 or later
 *
 **/

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {randomBytes} from "node:crypto";
import {FlmngrRequest} from "./FlmngrRequest.js";
import {IFmRequest, PhpArray} from "./IFmRequest.js";

// The request the way the library reads it: method, query, body and files, taken from the
// FlmngrRequest an integration provides
export class CommonRequest extends IFmRequest {

  // Parameters that hold one value
  static readonly KNOWN_PARAMS = [
    "action", "codec", "embedPreviews", "fromDir", "maxDepth", "d", "n", "f", "fs", "dir",
    "maxFiles", "lastFile", "lastIndex", "filter", "orderBy", "orderAsc", "mw", "mh", "mode",
    "width", "height",
  ];

  // Parameters that hold a list
  static readonly KNOWN_LIST_PARAMS = [
    "hideDirs", "alwaysInclude", "whiteList", "blackList", "formatIds", "formatSuffixes",
    "files", "formatMaxWidths", "formatMaxHeights",
  ];

  private source: FlmngrRequest;

  private dirTmp: string;

  constructor(source: FlmngrRequest, config: any = null) {
    super(config);
    this.source = source;
    this.dirTmp = config != null && config.dirTmp ? config.dirTmp : os.tmpdir();
  }

  static from(source: FlmngrRequest, config: any = null): CommonRequest {
    const request = new CommonRequest(source, config);
    request.parseRequest();
    return request;
  }

  parseRequest(): void {
    const s = this.source;
    this.requestMethod = s.getMethod ? s.getMethod() : "POST";
    this.contentLength = s.getContentLength ? s.getContentLength() : null;

    if (s.getPost && s.getGet && s.getFiles) {
      this.post = s.getPost();
      this.get = s.getGet();
      this.files = s.getFiles();
      return;
    }

    // Only the four getters: read every parameter the library knows by name. There is no
    // way to tell a query parameter from a body one here, so both get the same values
    const post: PhpArray = {};
    for (const name of CommonRequest.KNOWN_PARAMS) {
      const value = s.getParameterString(name, undefined);
      if (value !== undefined && value !== null) {
        post[name] = "" + value;
      }
    }
    for (const name of CommonRequest.KNOWN_LIST_PARAMS) {
      const value = s.getParameterStringArray(name, undefined);
      if (value !== undefined && value !== null) {
        post[name] = Array.isArray(value) ? value.map((v) => "" + v) : ["" + value];
      }
    }
    this.post = post;
    this.get = Object.assign({}, post);

    this.files = {};
    const file = s.getParameterFile("file");
    if (file && file.data) {
      // The library works with uploads on disk; spool the buffer to a temporary file
      const tmpPath = path.join(this.dirTmp, "flmngr-upload-" + randomBytes(8).toString("hex"));
      fs.writeFileSync(tmpPath, file.data);
      this.files = {
        file: {
          name: "" + file.fileName,
          tmp_name: tmpPath,
          size: file.data.length,
        },
      };
    }
  }
}
