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

import {CachedImageInfo} from "../fs/CachedFile.js";

export class FMFile {

  p: string; // contains parent dir's path WITHOUT starting AND trailing "/"

  s: number | null;

  t: number | null;

  w: number | null;

  h: number | null;

  // Data URI, set only when the client asked to embed previews
  preview: string | null;

  constructor(path: string, name: string, cachedImageInfo: CachedImageInfo | null) {
    this.p = "/" + path + "/" + name;
    this.s = cachedImageInfo != null && cachedImageInfo.size != null ? cachedImageInfo.size : null;
    this.t = cachedImageInfo != null && cachedImageInfo.mtime != null ? cachedImageInfo.mtime : null;
    // Width and height are not known until a preview was created
    this.w = cachedImageInfo == null || !cachedImageInfo.width ? null : cachedImageInfo.width;
    this.h = cachedImageInfo == null || !cachedImageInfo.height ? null : cachedImageInfo.height;
    this.preview = null;
  }

}
