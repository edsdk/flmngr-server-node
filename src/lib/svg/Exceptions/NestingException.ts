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

import {XmlElement} from "../Xml.js";

export class NestingException extends Error {

  protected element: XmlElement | null;

  code: number;

  constructor(message: string = "", code: number = 0, previous: Error | null = null, element: XmlElement | null = null) {
    super(message);
    this.name = "NestingException";
    this.code = code;
    this.element = element;
  }

  // The element that caused the exception
  getElement(): XmlElement | null {
    return this.element;
  }
}
