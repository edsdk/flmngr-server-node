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

import {GdImage} from "./Gd.js";

// A small BMP reader for the uncompressed variants (8-bit palette, 24-bit and 32-bit
// pixels, bottom-up or top-down). Anything else is reported as not decodable.
export class BmpDecoder {

  static decode(buf: Buffer): GdImage | null {
    try {
      return BmpDecoder.decodeOrThrow(buf);
    } catch (e) {
      return null;
    }
  }

  private static decodeOrThrow(buf: Buffer): GdImage | null {
    if (buf.length < 26 || buf[0] !== 0x42 || buf[1] !== 0x4d) {
      return null;
    }
    const dataOffset = buf.readUInt32LE(10);
    const headerSize = buf.readUInt32LE(14);

    let width: number;
    let height: number;
    let bitCount: number;
    let compression = 0;
    let colorsUsed = 0;
    if (headerSize === 12) {
      // the old OS/2 header
      width = buf.readUInt16LE(18);
      height = buf.readInt16LE(20);
      bitCount = buf.readUInt16LE(24);
    } else {
      width = buf.readInt32LE(18);
      height = buf.readInt32LE(22);
      bitCount = buf.readUInt16LE(28);
      compression = buf.readUInt32LE(30);
      colorsUsed = buf.readUInt32LE(46);
    }
    if (width <= 0 || height === 0) {
      return null;
    }
    const topDown = height < 0;
    height = Math.abs(height);
    if (width * height > 268435456) {
      return null;
    }

    // BI_RGB only, plus BI_BITFIELDS for 32-bit data in the usual BGRA order
    if (compression !== 0 && !(compression === 3 && bitCount === 32)) {
      return null;
    }
    if (bitCount !== 8 && bitCount !== 24 && bitCount !== 32) {
      return null;
    }

    let palette: Buffer | null = null;
    if (bitCount === 8) {
      const entrySize = headerSize === 12 ? 3 : 4;
      const count = colorsUsed > 0 ? colorsUsed : 256;
      const start = 14 + headerSize;
      palette = Buffer.alloc(256 * 4);
      for (let i = 0; i < count && start + (i + 1) * entrySize <= buf.length; i++) {
        palette[i * 4] = buf[start + i * entrySize + 2];     // r
        palette[i * 4 + 1] = buf[start + i * entrySize + 1]; // g
        palette[i * 4 + 2] = buf[start + i * entrySize];     // b
        palette[i * 4 + 3] = 255;
      }
    }

    const stride = ((width * bitCount + 31) >> 5) << 2;
    const data = Buffer.alloc(width * height * 4);
    for (let row = 0; row < height; row++) {
      const srcRow = topDown ? row : height - 1 - row;
      const rowStart = dataOffset + srcRow * stride;
      if (rowStart + stride > buf.length) {
        return null;
      }
      for (let x = 0; x < width; x++) {
        const dst = (row * width + x) * 4;
        if (bitCount === 8) {
          const index = buf[rowStart + x] * 4;
          data[dst] = (palette as Buffer)[index];
          data[dst + 1] = (palette as Buffer)[index + 1];
          data[dst + 2] = (palette as Buffer)[index + 2];
          data[dst + 3] = 255;
        } else {
          const src = rowStart + x * (bitCount / 8);
          data[dst] = buf[src + 2];
          data[dst + 1] = buf[src + 1];
          data[dst + 2] = buf[src];
          data[dst + 3] = 255;
        }
      }
    }
    return {width, height, data};
  }

}
