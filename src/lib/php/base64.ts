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

// Lenient base64 decoding, as PHP's base64_decode() without the strict flag:
// characters outside the alphabet are skipped, missing padding is fine
export function base64Decode(value: string): string {
  const clean = value.replace(/[^A-Za-z0-9+/=]/g, "");
  return Buffer.from(clean, "base64").toString("utf8");
}
