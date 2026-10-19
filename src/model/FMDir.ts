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

export class FMDir {

  private path: string; // contains parent dir's path WITHOUT starting AND trailing "/"

  private name: string;

  f: number;

  d: number;

  p: string;

  filled: boolean; // false if its children were not listed (dynamic listing is used and this is the last level dir)

  constructor(name: string, path: string, filled: boolean) {
    this.path = path;
    this.name = name;
    this.f = 0; // legacy
    this.d = 0; // legacy
    this.filled = filled;

    this.p =
      (this.path.length > 0 ? "/" + this.path : "") +
      "/" +
      this.name;
  }

  // Only the public part goes to the client
  toJSON(): { f: number; d: number; p: string; filled: boolean } {
    return {
      f: this.f,
      d: this.d,
      p: this.p,
      filled: this.filled
    };
  }

}
