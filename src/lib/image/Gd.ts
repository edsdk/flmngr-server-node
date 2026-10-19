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

import sharp from "sharp";
import {BmpDecoder} from "./BmpDecoder.js";

// An image in memory: 8-bit RGBA, rows top to bottom
export interface GdImage {
  width: number;
  height: number;
  data: Buffer;
}

export type GdFormat = "png" | "jpg" | "webp";

// The handful of image operations the file manager needs, over sharp. Only the formats
// a browser shows are decoded: PNG, JPEG, GIF (first frame), WebP and BMP.
export class Gd {

  static sniff(buf: Buffer): "png" | "jpeg" | "gif" | "webp" | "bmp" | null {
    if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
      return "png";
    }
    if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
      return "jpeg";
    }
    if (buf.length >= 6 && buf.toString("latin1", 0, 4) === "GIF8") {
      return "gif";
    }
    if (buf.length >= 12 && buf.toString("latin1", 0, 4) === "RIFF" && buf.toString("latin1", 8, 12) === "WEBP") {
      return "webp";
    }
    if (buf.length >= 2 && buf[0] === 0x42 && buf[1] === 0x4d) {
      return "bmp";
    }
    return null;
  }

  // null when the data is not an image we can read
  static async createFromString(contents: Buffer | null): Promise<GdImage | null> {
    if (contents == null || contents.length === 0) {
      return null;
    }
    const kind = Gd.sniff(contents);
    if (kind === null) {
      return null;
    }
    if (kind === "bmp") {
      return BmpDecoder.decode(contents);
    }
    try {
      const {data, info} = await sharp(contents)
        .toColourspace("srgb")
        .ensureAlpha()
        .raw()
        .toBuffer({resolveWithObject: true});
      if (info.channels !== 4 || info.width <= 0 || info.height <= 0) {
        return null;
      }
      return {width: info.width, height: info.height, data};
    } catch (e) {
      return null;
    }
  }

  // The EXIF orientation of a JPEG (1..8), 0 when there is none
  static async exifOrientation(contents: Buffer | null): Promise<number> {
    if (contents == null || Gd.sniff(contents) !== "jpeg") {
      return 0;
    }
    try {
      const meta = await sharp(contents).metadata();
      return typeof meta.orientation === "number" ? meta.orientation : 0;
    } catch (e) {
      return 0;
    }
  }

  // Positive degrees turn the image counter-clockwise, like GD's imagerotate()
  static async rotate(image: GdImage, degrees: number): Promise<GdImage> {
    const clockwise = ((360 - degrees) % 360 + 360) % 360;
    if (clockwise === 0) {
      return image;
    }
    const {data, info} = await sharp(image.data, {raw: {width: image.width, height: image.height, channels: 4}})
      .rotate(clockwise)
      .raw()
      .toBuffer({resolveWithObject: true});
    return {width: info.width, height: info.height, data};
  }

  // An opaque black canvas
  static createTrueColor(width: number, height: number): GdImage {
    const data = Buffer.alloc(width * height * 4);
    for (let i = 3; i < data.length; i += 4) {
      data[i] = 255;
    }
    return {width, height, data};
  }

  // Squares of two colours, the first one in the top left corner
  static fillCheckerboard(image: GdImage, rectSize: number, color1: number[], color2: number[]): void {
    for (let y = 0; y < image.height; y++) {
      for (let x = 0; x < image.width; x++) {
        const color = (Math.floor(x / rectSize) + Math.floor(y / rectSize)) % 2 === 0 ? color1 : color2;
        const i = (y * image.width + x) * 4;
        image.data[i] = color[0];
        image.data[i + 1] = color[1];
        image.data[i + 2] = color[2];
        image.data[i + 3] = 255;
      }
    }
  }

  // Resample the whole source onto the whole destination, like imagecopyresampled() with
  // both rectangles covering the full images. With `blend` the source is drawn over what the
  // destination holds (alpha blending on); without it the pixels are copied, alpha included.
  static async copyResampled(dst: GdImage, src: GdImage, blend: boolean): Promise<GdImage> {
    const resized = await Gd.resample(src, dst.width, dst.height);
    if (!blend) {
      return resized;
    }
    const out = dst.data;
    const over = resized.data;
    for (let i = 0; i < out.length; i += 4) {
      const a = over[i + 3] / 255;
      out[i] = Math.round(over[i] * a + out[i] * (1 - a));
      out[i + 1] = Math.round(over[i + 1] * a + out[i + 1] * (1 - a));
      out[i + 2] = Math.round(over[i + 2] * a + out[i + 2] * (1 - a));
      out[i + 3] = Math.max(out[i + 3], over[i + 3]);
    }
    return dst;
  }

  private static async resample(src: GdImage, width: number, height: number): Promise<GdImage> {
    if (src.width === width && src.height === height) {
      return {width, height, data: Buffer.from(src.data)};
    }
    const {data, info} = await sharp(src.data, {raw: {width: src.width, height: src.height, channels: 4}})
      .resize(width, height, {fit: "fill", kernel: "lanczos3"})
      .raw()
      .toBuffer({resolveWithObject: true});
    return {width: info.width, height: info.height, data};
  }

  // Rows of [r, g, b], what the BlurHash encoder takes
  static pixelsRGB(image: GdImage): number[][][] {
    const rows: number[][][] = [];
    for (let y = 0; y < image.height; y++) {
      const row: number[][] = [];
      for (let x = 0; x < image.width; x++) {
        const i = (y * image.width + x) * 4;
        row.push([image.data[i], image.data[i + 1], image.data[i + 2]]);
      }
      rows.push(row);
    }
    return rows;
  }

  // PNG keeps the alpha channel only when asked (a GD image saves it only with imagesavealpha()),
  // JPEG has none, WebP always keeps it. Default qualities are GD's: 75 for JPEG, 80 for WebP
  static async encode(image: GdImage, format: GdFormat, quality: number | null = null, alpha: boolean = true): Promise<Buffer> {
    let pipeline = sharp(image.data, {raw: {width: image.width, height: image.height, channels: 4}});
    switch (format) {
      case "jpg":
        return pipeline.removeAlpha().jpeg({quality: quality == null || quality < 0 ? 75 : quality}).toBuffer();
      case "webp":
        return pipeline.webp({quality: quality == null || quality < 0 ? 80 : quality}).toBuffer();
      case "png":
      default:
        if (!alpha) {
          pipeline = pipeline.removeAlpha();
        }
        return pipeline.png().toBuffer();
    }
  }

}
