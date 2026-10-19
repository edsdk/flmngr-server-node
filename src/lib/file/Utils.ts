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

import {Message} from "../../model/Message.js";
import {MessageException} from "../MessageException.js";
import {ImageInfo} from "../../model/ImageInfo.js";
import {Gd, GdImage} from "../image/Gd.js";

export class Utils {

  static getNameWithoutExt(filename: string): string {
    const ext = Utils.getExt(filename);
    if (ext == null || ext === "") {
      return filename;
    }
    return filename.substring(0, filename.length - ext.length - 1);
  }

  // The part after the last dot; null when there is no dot at all
  static getExt(name: string): string | null {
    const i = name.lastIndexOf(".");
    if (i !== -1) {
      return name.substring(i + 1);
    }
    return null;
  }

  static readonly PROHIBITED_SYMBOLS = "/\\?%*:|\"<>";

  static fixFileName(name: string): string {
    let newName = "";
    for (let i = 0; i < name.length; i++) {
      let ch = name.charAt(i);
      if (Utils.PROHIBITED_SYMBOLS.indexOf(ch) !== -1) {
        ch = "_";
      }
      newName = newName + ch;
    }
    return newName;
  }

  static isFileNameSyntaxOk(name: string): boolean {
    if (name.length === 0 || name === "." || name.indexOf("..") > -1) {
      return false;
    }

    for (let i = 0; i < Utils.PROHIBITED_SYMBOLS.length; i++) {
      if (name.indexOf(Utils.PROHIBITED_SYMBOLS.charAt(i)) !== -1) {
        return false;
      }
    }

    if (name.length > 260) {
      return false;
    }

    return true;
  }

  static isImage(name: string): boolean {
    const exts = ["gif", "jpg", "jpeg", "png", "svg", "webp", "bmp"];
    const ext = Utils.getExt(name);
    for (let i = 0; i < exts.length; i++) {
      if (ext !== null && exts[i] === ext.toLowerCase()) {
        return true;
      }
    }
    return false;
  }

  static addTrailingSlash(value: string | null): string | null {
    if (
      value != null &&
      (value.length === 0 || !value.endsWith("/"))
    ) {
      value += "/";
    }
    return value;
  }

  static removeTrailingSlash(value: string | null): string | null {
    if (
      value != null &&
      (value.length > 0 && value.endsWith("/"))
    ) {
      value = value.substring(0, value.length - 1);
    }
    return value;
  }

  // By the extension only, lower-cased; null for anything that is not an image
  static getMimeType(filePath: string): string | null {
    let mimeType: string | null = null;
    filePath = filePath.toLowerCase();
    if (Utils.endsWith(filePath, ".png")) {
      mimeType = "image/png";
    }
    if (Utils.endsWith(filePath, ".gif")) {
      mimeType = "image/gif";
    }
    if (Utils.endsWith(filePath, ".bmp")) {
      mimeType = "image/bmp";
    }
    if (
      Utils.endsWith(filePath, ".jpg") ||
      Utils.endsWith(filePath, ".jpeg")
    ) {
      mimeType = "image/jpeg";
    }
    if (Utils.endsWith(filePath, ".webp")) {
      mimeType = "image/webp";
    }
    if (Utils.endsWith(filePath, ".svg")) {
      mimeType = "image/svg+xml";
    }

    return mimeType;
  }

  // An empty ending matches only an empty string, as the original substr() comparison does
  static endsWith(str: string, ends: string): boolean {
    if (ends.length === 0) {
      return str === "";
    }
    return str.endsWith(ends);
  }

  static normalizeNoEndSeparator(path: string): string {
    return path.replace(/\/+$/, "");
  }

  static async writeImageContents(ext: string | null, image: GdImage, jpegQuality: number): Promise<Buffer> {
    switch (("" + ext).toLowerCase()) {
      case "jpeg":
      case "jpg":
        return Gd.encode(image, "jpg", jpegQuality);
      case "png":
        return Gd.encode(image, "png", null, false);
      case "webp":
        return Gd.encode(image, "webp");
    }
    // no encoder for this format (GIF, BMP)
    return Buffer.alloc(0);
  }

  static async getImageInfo(file: Buffer): Promise<ImageInfo> {
    const image = await Gd.createFromString(file);
    if (image === null) {
      throw new MessageException(
        Message.createMessage(
          false,
          Message.IMAGE_PROCESS_ERROR
        )
      );
    }

    const imageInfo = new ImageInfo();
    imageInfo.width = image.width;
    imageInfo.height = image.height;
    return imageInfo;
  }

}
