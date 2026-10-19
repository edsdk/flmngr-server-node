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

import {attributesOf, isElement, toArray, XmlElement} from "./Xml.js";

export class Helper {

  static readonly XLINK_NAMESPACE_URI = "http://www.w3.org/1999/xlink";

  // The `href`/`xlink:href` value of an element. The lookup is case insensitive on purpose:
  // names such as `HrEf`/`xlink:HrEf` are normalized back to `href`/`xlink:href` later, so
  // anything consuming this helper has to see those attributes as well - otherwise a
  // mixed-case name hides the reference from the `<use>` reference graph, which is built
  // before that normalization happens.
  static getElementHref(element: XmlElement): string | null {
    for (const attribute of attributesOf(element)) {
      if (attribute.localName === "href" && (attribute.prefix ?? "") === "") {
        return attribute.value;
      }
    }
    if (element.hasAttributeNS(Helper.XLINK_NAMESPACE_URI, "href")) {
      return element.getAttributeNS(Helper.XLINK_NAMESPACE_URI, "href");
    }
    for (const attribute of attributesOf(element)) {
      if (attribute.localName.toLowerCase() !== "href") {
        continue;
      }
      const prefix = ("" + (attribute.prefix ?? "")).toLowerCase();
      if (prefix === "" || prefix === "xlink") {
        return attribute.value;
      }
    }
    return null;
  }

  static extractIdReferenceFromHref(href: string | null): string | null {
    if (typeof href !== "string" || !href.startsWith("#")) {
      return null;
    }
    return href.substring(1);
  }

  static isElementContainedIn(needle: XmlElement, haystack: XmlElement): boolean {
    if (needle === haystack) {
      return true;
    }
    for (const childNode of toArray(haystack.childNodes)) {
      if (!isElement(childNode)) {
        continue;
      }
      if (Helper.isElementContainedIn(needle, childNode)) {
        return true;
      }
    }
    return false;
  }
}
