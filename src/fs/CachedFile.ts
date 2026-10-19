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

import * as path from "node:path";
import {Message} from "../model/Message.js";
import {BlurHash} from "../lib/file/BlurHash.js";
import {Utils} from "../lib/file/Utils.js";
import {MessageException} from "../lib/MessageException.js";
import {Gd, GdImage} from "../lib/image/Gd.js";
import {PhpJson} from "../lib/php/PhpJson.js";
import {DriverLocal} from "./DriverLocal.js";

// What the cache knows about a file. Width, height and the BlurHash appear after the
// first preview was made
export interface CachedImageInfo {
  mtime?: number | null;
  size?: number | null;
  width?: number | null;
  height?: number | null;
  blurHash?: string | null;
  [key: string]: any;
}

// [mime type, path, true when the path is inside the cache dir (false: the files dir)]
export type PreviewResult = [string, string, boolean];

export class CachedFile {

  private fileRelative: string;

  private driverFiles: DriverLocal;

  private driverCache: DriverLocal;

  private cacheFileRelative: string; // path/to/file.jpg (.json|.png will be added later)

  private cacheFileJsonRelative: string;

  private cacheFilePreviewRelative: string;

  constructor(
    fileRelative: string, // Example: /path/to/file.jpg
    driverFiles: DriverLocal,
    driverCache: DriverLocal
  ) {
    this.fileRelative = fileRelative;
    this.driverFiles = driverFiles;
    this.driverCache = driverCache;

    this.cacheFileRelative = "/previews" + fileRelative;

    this.cacheFileJsonRelative = this.cacheFileRelative + ".json";
    this.cacheFilePreviewRelative = this.cacheFileRelative + ".png";

    this.driverCache.makeRootDir();
  }

  // Clears cache for this file
  delete(): void {
    if (this.driverCache.exists(this.cacheFileJsonRelative)) {
      this.driverCache.delete(this.cacheFileJsonRelative);
    }
    if (this.driverCache.exists(this.cacheFilePreviewRelative)) {
      this.driverCache.delete(this.cacheFilePreviewRelative);
    }
  }

  getInfo(): CachedImageInfo | null {

    let json: CachedImageInfo | null = null;
    if (this.driverCache.exists(this.cacheFileJsonRelative)) {
      const content = this.driverCache.get(this.cacheFileJsonRelative);
      json = CachedFile.parseInfo(content);
      if (json !== null && (json.size === undefined || json.size === null)) {
        // Saved by some older version at the moment the driver failed to get the size - recalculate
        json = null;
      }
    }

    if (json === null) {

      try {

        // We do not calculate BlurHash/width/height here due to this is a long operation
        // BlurHash/width/height will be calculated and JSON file will be updated on the first getCachedImagePreview() call

        json = {
          mtime: this.driverFiles.lastModified(this.fileRelative),
          size: this.driverFiles.size(this.fileRelative),
        };
        this.writeInfo(json);

      } catch (e) {
        console.error("Exception while getting image size of " + this.fileRelative);
        console.error(e);
        json = null;
      }
    }

    if (json === null) {
      console.error("Unable to get file info for " + this.fileRelative);
      return null;
    }

    return json;
  }

  private static parseInfo(content: Buffer | null): CachedImageInfo | null {
    if (content === null) {
      return null;
    }
    try {
      const parsed = JSON.parse(content.toString("utf8"));
      return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
    } catch (e) {
      return null;
    }
  }

  private writeInfo(info: CachedImageInfo): void {
    const dirname = path.posix.dirname(this.cacheFileJsonRelative);
    if (!this.driverCache.exists(dirname)) {
      this.driverCache.makeDirectory(dirname);
    }
    this.driverCache.put(this.cacheFileJsonRelative, Buffer.from(PhpJson.encode(info), "utf8"));
  }

  async getPreview(preview_width: number | null, preview_height: number | null, contents: Buffer | null, doUpscale: boolean = false): Promise<PreviewResult> {
    const cacheFilePreviewRelative = this.cacheFileRelative + ".png";

    if (this.driverCache.exists(cacheFilePreviewRelative)) {
      const info = this.getInfo();
      if (
        info == null ||
        info.mtime !== this.driverFiles.lastModified(this.fileRelative) ||
        info.size !== this.driverFiles.size(this.fileRelative) ||
        // old preview cached before we stored resolution - recreate it to fill width/height in
        info.width == null || info.height == null
      ) {
        // Delete preview if it was changed, will be recreated below
        this.driverCache.delete(cacheFilePreviewRelative);
      }
    }

    let resizedImage: GdImage | null = null;
    let original_width: number | null = null;
    let original_height: number | null = null;
    if (!this.driverCache.exists(cacheFilePreviewRelative)) {

      if (Utils.getMimeType(this.fileRelative) === "image/svg+xml") {
        return ["image/svg+xml", this.fileRelative, false]; // false means from files folder
      }

      if (contents === null) {
        contents = this.driverFiles.get(this.fileRelative);
      }
      // an empty file, or one holding only "0", counts as missing
      if (contents === null || contents.length === 0 || (contents.length === 1 && contents[0] === 0x30)) {
        throw new MessageException(
          Message.createMessage(false, Message.FM_FILE_DOES_NOT_EXIST)
        );
      }
      let image = await Gd.createFromString(contents);

      if (!image) {
        throw new MessageException(
          Message.createMessage(false, Message.IMAGE_PROCESS_ERROR)
        );
      }

      const orientation = await this.driverFiles.getExifOrientation(this.fileRelative);
      if (orientation === 3) {
        image = await Gd.rotate(image, 180);
      } else if (orientation === 6) {
        image = await Gd.rotate(image, -90);
      } else if (orientation === 8) {
        image = await Gd.rotate(image, 90);
      }

      original_width = image.width;
      original_height = image.height;
      if (!original_width || !original_height) {
        throw new MessageException(
          Message.createMessage(false, Message.IMAGE_PROCESS_ERROR)
        );
      }

      const original_ratio = original_width / original_height;

      if (preview_width == null) {
        preview_width = Math.max(1, Math.floor(original_ratio * (preview_height as number)));
      } else {
        if (preview_height == null) {
          preview_height = Math.max(1, Math.floor((1 / original_ratio) * preview_width));
        }
      }

      const preview_ratio = preview_width / (preview_height as number);

      if (original_ratio >= preview_ratio) {
        preview_height = Math.max(1, Math.floor(original_height * preview_width / original_width));
      } else {
        preview_width = Math.max(1, Math.floor(original_width * (preview_height as number) / original_height));
      }

      // Do not enlarge small images, draw them 1:1 so small icons stay sharp.
      // Old stretching behavior can be returned with doUpscalePreviews option
      if (!doUpscale && preview_width >= original_width && (preview_height as number) >= original_height) {
        preview_width = original_width;
        preview_height = original_height;
      }

      resizedImage = Gd.createTrueColor(preview_width, preview_height as number);

      Gd.fillCheckerboard(resizedImage, 20, [240, 240, 240], [250, 250, 250]);

      resizedImage = await Gd.copyResampled(resizedImage, image, true);

      const imageContents = await Utils.writeImageContents(Utils.getExt(cacheFilePreviewRelative), resizedImage, 80);

      try {
        this.driverCache.put(cacheFilePreviewRelative, imageContents);
      } catch (e) {
        throw new MessageException(
          Message.createMessage(
            true,
            Message.FM_UNABLE_TO_WRITE_PREVIEW_IN_CACHE_DIR,
            cacheFilePreviewRelative
          ),
          e
        );
      }
    }

    // Update BlurHash
    if (resizedImage == null) {
      resizedImage = await Gd.createFromString(this.driverCache.get(cacheFilePreviewRelative));
      if (resizedImage == null) {
        throw new Error("Unable to read the cached preview " + cacheFilePreviewRelative);
      }
    }

    const pixels = Gd.pixelsRGB(resizedImage);

    const components_x = 4;
    const components_y = 3;

    let cachedImageInfo = this.getInfo();
    if (pixels.length > 0) {
      if (cachedImageInfo == null) {
        cachedImageInfo = {};
      }
      cachedImageInfo["blurHash"] = BlurHash.encode(pixels, components_x, components_y);
      if (original_width !== null) {
        cachedImageInfo["width"] = original_width;
      }
      if (original_height !== null) {
        cachedImageInfo["height"] = original_height;
      }
      this.writeInfo(cachedImageInfo);
    }

    return ["image/png", cacheFilePreviewRelative, true]; // true means from cache folder
  }

}
