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

/**
 * The BlurHash of an image (https://blurha.sh): a short string the file manager paints as a
 * blurred placeholder while the real preview loads. Same output as the reference encoder.
 */
export class BlurHash {

  // base 83 digits, in order of value
  static readonly DIGITS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz#$%*+,-.:;=?@[]^_{|}~";

  /**
   * @param pixels rows of [r, g, b] pixels, every channel an int from 0 to 255
   * @param xComponents how many cosines across, 1 to 9
   * @param yComponents how many cosines down, 1 to 9
   */
  static encode(pixels: number[][][], xComponents: number = 4, yComponents: number = 3): string {
    if (xComponents < 1 || xComponents > 9 || yComponents < 1 || yComponents > 9) {
      throw new RangeError("BlurHash takes 1 to 9 components on each axis");
    }
    const height = Array.isArray(pixels) ? pixels.length : 0;
    const width = height > 0 && Array.isArray(pixels[0]) ? pixels[0].length : 0;
    if (width === 0) {
      throw new RangeError("BlurHash needs an image of at least one pixel");
    }

    // Everything below works in linear light; there are only 256 byte values to convert
    const linear: number[] = [];
    for (let v = 0; v < 256; v++) {
      linear[v] = BlurHash.toLinear(v);
    }
    const cosX = BlurHash.cosines(xComponents, width);
    const cosY = BlurHash.cosines(yComponents, height);

    // One average colour per cosine pair. The first is the plain average, the DC; the rest are the
    // AC terms, how far the picture swings away from it in that direction.
    const terms: number[][] = [];
    const scale = 1 / (width * height);
    for (let j = 0; j < yComponents; j++) {
      for (let i = 0; i < xComponents; i++) {
        const weight = (i === 0 && j === 0) ? 1 : 2;
        let r = 0, g = 0, b = 0;
        for (let x = 0; x < width; x++) {
          const wx = weight * cosX[i][x];
          for (let y = 0; y < height; y++) {
            const basis = wx * cosY[j][y];
            const pixel = pixels[y][x];
            r += basis * linear[pixel[0]];
            g += basis * linear[pixel[1]];
            b += basis * linear[pixel[2]];
          }
        }
        terms.push([r * scale, g * scale, b * scale]);
      }
    }
    const dc = terms.shift() as number[];

    // The AC terms are sent relative to the largest of them, which goes first in one digit
    let maxDigit = 0;
    let maxValue = 1;
    if (terms.length > 0) {
      const largest = Math.max(...terms.map((t) => Math.max(...t)));
      maxDigit = Math.floor(Math.max(0, Math.min(82, Math.floor(largest * 166 - 0.5))));
      maxValue = (maxDigit + 1) / 166;
    }

    let hash = BlurHash.base83(xComponents - 1 + (yComponents - 1) * 9, 1)
      + BlurHash.base83(maxDigit, 1)
      + BlurHash.base83((BlurHash.toSrgb(dc[0]) << 16) + (BlurHash.toSrgb(dc[1]) << 8) + BlurHash.toSrgb(dc[2]), 4);
    for (const term of terms) {
      hash += BlurHash.base83(
        BlurHash.quantise(term[0] / maxValue) * 361
        + BlurHash.quantise(term[1] / maxValue) * 19
        + BlurHash.quantise(term[2] / maxValue),
        2
      );
    }
    return hash;
  }

  // cos(pi * k * n / size) for every term k and pixel n along one axis
  private static cosines(count: number, size: number): number[][] {
    const table: number[][] = [];
    for (let k = 0; k < count; k++) {
      table[k] = [];
      for (let n = 0; n < size; n++) {
        table[k][n] = Math.cos(Math.PI * k * n / size);
      }
    }
    return table;
  }

  private static toLinear(byte: number): number {
    const c = byte / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }

  private static toSrgb(value: number): number {
    const c = Math.max(0, Math.min(1, value));
    const byte = c <= 0.0031308
      ? c * 12.92 * 255 + 0.5
      : (1.055 * Math.pow(c, 1 / 2.4) - 0.055) * 255 + 0.5;
    return Math.trunc(byte);
  }

  // An AC value in -1..1 to one of 19 steps, finer near zero where the eye notices more
  private static quantise(value: number): number {
    const root = (value < 0 ? -1 : 1) * Math.pow(Math.abs(value), 0.5);
    return Math.floor(Math.max(0, Math.min(18, Math.floor(root * 9 + 9.5))));
  }

  private static base83(value: number, length: number): string {
    const digits = BlurHash.DIGITS;
    let out = "";
    for (let n = 0; n < length; n++) {
      const digit = value % 83;
      out = digits.charAt(digit) + out;
      value = (value - digit) / 83;
    }
    return out;
  }

}
