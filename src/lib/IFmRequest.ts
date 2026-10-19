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

// A request parameter the way a PHP-style query string parser produces it:
// "a=1" is a string, "a[]=1&a[]=2" is a list, "a[x]=1" is a map
export type PhpValue = string | PhpValue[] | { [key: string]: PhpValue };

export type PhpArray = { [key: string]: PhpValue };

// One uploaded file: the client's name, the temporary path it was stored to, its size
export interface UploadedFile {
  name: string;
  type?: string;
  tmp_name: string;
  error?: number;
  size: number;
}

export abstract class IFmRequest {

  post: PhpArray = {};

  get: PhpArray = {};

  files: { [field: string]: UploadedFile } = {};

  requestMethod: string = "POST";

  // How many bytes the client sent, when the transport knows it
  contentLength: number | null = null;

  config: any;

  abstract parseRequest(): void;

  constructor(config: any = null) {
    this.config = config;
  }
}
