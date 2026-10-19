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

import type {Subject} from "./Subject.js";

export class Usage {

  protected subject: Subject;

  protected count: number;

  constructor(subject: Subject, count: number = 1) {
    this.subject = subject;
    this.count = Math.trunc(count);
  }

  increment(by: number = 1): void {
    this.count += Math.trunc(by);
  }

  getSubject(): Subject {
    return this.subject;
  }

  getCount(): number {
    return this.count;
  }
}
