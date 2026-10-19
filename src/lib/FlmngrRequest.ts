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

import {PhpArray, UploadedFile} from "./IFmRequest.js";

// What an integration gives the library to read the request with.
//
// The four getParameter* functions are the minimum: with them alone the library
// reads the known parameters one by one. The optional functions hand over the
// whole request as it came in (method, query, body, files) and let the library
// tell GET from POST and keep the client's lists as lists - the ready-made
// Express and Nest modules implement them, a custom integration may too.
export interface FlmngrRequest {

  getParameterNumber(name: string, defaultValue?: number): number;
  getParameterString(name: string, defaultValue?: string): string;
  getParameterStringArray(name: string, defaultValue?: string[]): string[];
  getParameterFile(name: string): {
    data: Buffer;
    fileName: string;
  } | null;

  // Optional: the request as the transport saw it
  getMethod?(): string;
  getPost?(): PhpArray;
  getGet?(): PhpArray;
  getFiles?(): { [field: string]: UploadedFile };
  getContentLength?(): number | null;
}
