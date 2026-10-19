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

export class Profile {

  protected title: string;
  protected now: number;
  protected start: number;

  constructor(functionTitle: string) {
    this.title = functionTitle;
    this.now = Date.now() / 1000;
    this.start = this.now;
  }

  profile(text: string): void {
    const now = Date.now() / 1000;
    const time = now - this.now;
    //console.error(this.title + ": " + time.toFixed(3) + " sec   " + text);
    this.now = now;
  }

  total(): void {
    const now = Date.now() / 1000;
    const time = now - this.start;
    //console.error(this.title + ": " + time.toFixed(3) + " sec   TOTAL");
  }

}
