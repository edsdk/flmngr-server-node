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
import {Readable} from "node:stream";
import {FlmngrConfig} from "./FlmngrConfig.js";
import {FileSystem} from "./fs/FileSystem.js";
import {CommonRequest} from "./lib/CommonRequest.js";
import {IFmRequest, PhpArray, PhpValue} from "./lib/IFmRequest.js";
import {MessageException} from "./lib/MessageException.js";
import {base64Decode} from "./lib/php/base64.js";
import {FailMessage, Message} from "./model/Message.js";
import {Response} from "./resp/Response.js";

export type FlmngrHeaders = { [key: string]: string };

// What onFinish receives: a text (only with a status other than 200), the JSON object of a
// normal answer, or a stream when a file is sent
export type FlmngrResponseBody = string | { error: FailMessage | string | null; data: any } | Readable;

export interface FlmngrListeners {
  onFinish: (httpStatusCode: number, headers: FlmngrHeaders, response: FlmngrResponseBody) => void;
  onLogError: (message: string) => void;
}

const SERVER_ERROR_TEXT = "An error occurred on the server side. Please check server logs.";

export class FlmngrServer {

  static async flmngrRequest(
    config: FlmngrConfig,
    on: FlmngrListeners,
    framework?: string
  ): Promise<void> {

    const logError = (message: string): void => {
      try {
        on.onLogError(message);
      } catch (e) {
        // a logger must never take the request down
      }
    };

    let request: IFmRequest | null = null;
    let resp: Response;
    try {

      if (!config.request) {
        throw new Error("No request given: set the 'request' field of the config to an object reading the request parameters");
      }
      request = CommonRequest.from(config.request, config);

      let codec: PhpValue | number = 0;
      if (isset(request.post["codec"])) {
        codec = request.post["codec"] as PhpValue;
      } else if (isset(request.get["codec"])) {
        codec = request.get["codec"] as PhpValue;
      }
      if (codec !== 0) {
        FlmngrServer.decodeRequest(request, codec);
      }

      const fileSystem = new FileSystem(config);

      if (FlmngrServer.checkUploadLimit(request, config, on)) {
        return;
      } // file size exceeds the limit of the server

      if (isset(request.post["embedPreviews"])) {
        fileSystem.embedPreviews = request.post["embedPreviews"] as PhpValue;
      }

      let action: PhpValue | null = null;
      if (request.requestMethod === "POST") {
        if (isset(request.post["action"])) {
          action = request.post["action"] as PhpValue;
        }
      } else {
        if (request.requestMethod === "GET") {
          action = isset(request.get["action"]) ? request.get["action"] as PhpValue : null;
        } else {
          on.onFinish(200, {}, "");
          return;
        }
      }

      let data: any = true; // will be optionally filled by request
      switch (action) {
        case "dirList":
          data = fileSystem.reqGetDirs(request);
          break;
        case "dirCreate":
          fileSystem.reqCreateDir(request);
          break;
        case "dirRename":
          fileSystem.reqRename(request);
          break;
        case "dirDelete":
          fileSystem.reqDeleteDir(request);
          break;
        case "dirCopy":
          fileSystem.reqCopyDir(request);
          break;
        case "dirMove":
          fileSystem.reqMove(request);
          break;
        case "fileList":
          data = await fileSystem.reqGetFiles(request);
          break;
        case "fileListPaged":
          data = fileSystem.reqGetFilesPaged(request);
          break;
        case "fileListSpecified":
          data = fileSystem.reqGetFilesSpecified(request);
          break;
        case "fileDelete":
          fileSystem.reqDeleteFiles(request);
          break;
        case "fileCopy":
          fileSystem.reqCopyFiles(request);
          break;
        case "fileRename":
          fileSystem.reqRename(request);
          break;
        case "fileMove":
          fileSystem.reqMoveFiles(request);
          break;
        case "fileResize":
          data = await fileSystem.reqResizeFile(request);
          break;
        case "fileResize2":
          data = await fileSystem.reqResizeFile2(request);
          break;
        case "fileOriginal": {
          const [mimeType, stream] = fileSystem.reqGetImageOriginal(request);
          on.onFinish(
            200,
            Object.assign({"Content-Type": mimeType}, FlmngrServer.sendContentSecurityHeaders(mimeType)),
            stream
          );
          return;
        }
        case "filePreview": {
          const [mimeType, stream] = await fileSystem.reqGetImagePreview(request);
          on.onFinish(
            200,
            Object.assign({"Content-Type": mimeType}, FlmngrServer.sendContentSecurityHeaders(mimeType)),
            stream
          );
          return;
        }
        case "filePreviewAndResolution":
          data = await fileSystem.reqGetImagePreviewAndResolution(request);
          break;
        case "uploadFile":
        case "upload":
          data = await fileSystem.reqUpload(request);
          break;
        case "getVersion":
          data = fileSystem.reqGetVersion(request, framework);
          break;
        default:
          throw new MessageException(Message.createMessage(false, Message.ACTION_NOT_FOUND));
      }
      resp = new Response(null, data);
    } catch (e) {
      if (e instanceof MessageException) {

        if (config.messageExceptionLogger && request !== null) {
          config.messageExceptionLogger(e, request);
        } else {

          const sourceException = e.getSourceException();

          // Log only messages with an exception
          if (sourceException != null) {
            logError("FLMNGR exception.\n");
            logError("REQUEST:\n");
            logError(FlmngrServer.describeRequest(request) + "\n");
            logError("\n");

            logError("RESPONSE:\n");
            logError(JSON.stringify(e.getFailMessage()) + "\n");

            logError("EXCEPTION:\n");
            logError(FlmngrServer.describeError(sourceException) + "\n");
          }
        }

        resp = new Response(e.getFailMessage(), null);
      } else {
        logError("Exception '" + ((e as any)?.constructor?.name ?? "Error") + "' occurred. " + FlmngrServer.describeError(e));
        on.onFinish(500, {"Content-Type": "text/plain; charset=UTF-8"}, SERVER_ERROR_TEXT);
        return;
      }
    } finally {
      FlmngrServer.removeTemporaryFiles(request);
    }

    on.onFinish(
      200,
      {"Content-Type": "application/json; charset=UTF-8"},
      resp
    );
  }

  // Do not let the browser sniff content type. Only known image types are shown
  // inline, all other files are sent to download.
  // The client fetches these responses as blobs, so it is not affected.
  private static sendContentSecurityHeaders(mimeType: string): FlmngrHeaders {
    const headers: FlmngrHeaders = {"X-Content-Type-Options": "nosniff"};
    const inlineSafe = [
      "image/png", "image/jpeg", "image/gif", "image/webp", "image/bmp",
    ].indexOf(mimeType) !== -1;
    if (!inlineSafe) {
      headers["Content-Disposition"] = "attachment";
    }
    return headers;
  }

  private static decodeRequest(request: IFmRequest, codec: PhpValue | number): void {
    if (typeof codec !== "object" && Number(codec) === 1) {
      // Base 64 values
      FlmngrServer.decodeValues(request.post);
      FlmngrServer.decodeValues(request.get);
      return; // OK
    }
    throw new Error("Unknown codec = " + codec + " received from the client. You need to update the server side or check did you set Flmngr.codec correctly.");
  }

  private static decodeValues(values: PhpArray): void {
    for (const key of Object.keys(values)) {
      if (key !== "codec") {
        const value = values[key];
        if (Array.isArray(value)) {
          for (let i = 0; i < value.length; i++) {
            value[i] = base64Decode("" + value[i]);
          }
        } else if (value !== null && typeof value === "object") {
          for (const k of Object.keys(value)) {
            value[k] = base64Decode("" + value[k]);
          }
        } else {
          values[key] = base64Decode("" + value);
        }
      }
    }
  }

  // A size with an optional k/m/g suffix ("100M") to bytes; null when there is no limit.
  // Integration modules use it to apply the same limit at the transport level
  static parseSize(val: number | string | null | undefined): number | null {
    return FlmngrServer.iniGetBytes(val);
  }

  private static iniGetBytes(val: number | string | null | undefined): number | null {
    if (val === null || val === undefined) {
      return null;
    }
    if (typeof val === "number") {
      return val;
    }
    val = val.trim();
    if (val === "") {
      return null;
    }
    const last = val.charAt(val.length - 1).toLowerCase();
    let num = Number(/[kmg]/.test(last) ? val.substring(0, val.length - 1) : val);
    if (!Number.isFinite(num)) {
      return null;
    }

    switch (last) {
      case "g":
        num *= 1024;
      // fall through
      case "m":
        num *= 1024;
      // fall through
      case "k":
        num *= 1024;
      // fall through
    }

    return num;
  }

  private static checkUploadLimit(request: IFmRequest, config: FlmngrConfig, on: FlmngrListeners): boolean {
    let isError = false;
    let maxSizeParameter: string | null = null;
    const maxBytes = FlmngrServer.iniGetBytes(config.maxUploadSize);
    if (request.contentLength !== null && maxBytes !== null) {
      if (request.contentLength > maxBytes) {
        isError = true;
        maxSizeParameter = "maxUploadSize";
      }
    }
    if (!isError) {
      if (request.files["file"] !== undefined && request.files["file"] !== null) {
        const file = request.files["file"];
        if (file.tmp_name === "") {
          isError = true;
          maxSizeParameter = "maxUploadSize";
        }
      }
    }

    if (isError) {
      const maxSizeValueRaw = config.maxUploadSize;
      const maxSizeValueFormatted = maxBytes;

      const resp = new Response(
        Message.createMessage(
          false,
          Message.FILE_SIZE_EXCEEDS_SYSTEM_LIMIT,
          "" + (request.contentLength === null ? "" : request.contentLength),
          "" + (maxSizeValueFormatted === null ? "" : maxSizeValueFormatted),
          maxSizeParameter + " = " + (maxSizeValueRaw === null || maxSizeValueRaw === undefined ? "" : maxSizeValueRaw)
        ).toJSON(),
        null
      );

      on.onFinish(200, {"Content-Type": "application/json; charset=UTF-8"}, resp);

      return true;
    } else {
      return false;
    }

  }

  // An upload still sitting in the temp dir after the request is over goes away
  private static removeTemporaryFiles(request: IFmRequest | null): void {
    if (request === null) {
      return;
    }
    for (const field of Object.keys(request.files)) {
      const tmp = request.files[field].tmp_name;
      if (tmp && fs.existsSync(tmp)) {
        try {
          fs.unlinkSync(tmp);
        } catch (e) {
          // nothing to do: the temp dir is cleaned by the system
        }
      }
    }
  }

  private static describeRequest(request: IFmRequest | null): string {
    if (request === null) {
      return "(no request)";
    }
    return JSON.stringify({
      requestMethod: request.requestMethod,
      post: request.post,
      get: request.get,
      files: request.files,
    });
  }

  private static describeError(e: unknown): string {
    if (e instanceof Error) {
      return (e.stack ? e.stack : e.name + ": " + e.message);
    }
    return "" + e;
  }

}

function isset(value: PhpValue | undefined | null): boolean {
  return value !== undefined && value !== null;
}
