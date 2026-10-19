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

import {isElement, toArray, XmlDocument, XmlElement} from "../Xml.js";

// The two lookups the sanitizer needs from an XPath engine: every element with an id, and the
// direct children of an element with a given name in the document's own namespace
export class XPath {

  static readonly DEFAULT_NAMESPACE_PREFIX = "svg";

  protected document: XmlDocument;

  protected defaultNamespaceURI: string = "";

  constructor(doc: XmlDocument) {
    this.document = doc;
    this.handleDefaultNamespace();
  }

  createNodeName(nodeName: string): string {
    if (this.defaultNamespaceURI === "") {
      return nodeName;
    }
    return XPath.DEFAULT_NAMESPACE_PREFIX + ":" + nodeName;
  }

  // "//*[@id]": every element carrying a plain id attribute, in document order
  queryElementsWithId(): XmlElement[] {
    const out: XmlElement[] = [];
    const walk = (node: XmlElement): void => {
      if (toArray(node.attributes).some((a) => a.name === "id")) {
        out.push(node);
      }
      for (const c of toArray(node.childNodes)) {
        if (isElement(c)) {
          walk(c);
        }
      }
    };
    if (this.document.documentElement) {
      walk(this.document.documentElement);
    }
    return out;
  }

  // "<name>" or "svg:<name>" relative to a context element: its child elements with that
  // local name, in the default namespace when the document has one
  queryChildren(nodeName: string, context: XmlElement): XmlElement[] {
    const local = nodeName.startsWith(XPath.DEFAULT_NAMESPACE_PREFIX + ":")
      ? nodeName.substring(XPath.DEFAULT_NAMESPACE_PREFIX.length + 1) : nodeName;
    return toArray(context.childNodes).filter((c): c is XmlElement =>
      isElement(c) && c.localName === local && (c.namespaceURI ?? "") === this.defaultNamespaceURI);
  }

  protected handleDefaultNamespace(): void {
    const rootElements = this.getRootElements();

    if (rootElements.length !== 1) {
      throw new Error("Got " + rootElements.length + " svg elements, expected exactly one");
    }
    this.defaultNamespaceURI = "" + (rootElements[0].namespaceURI ?? "");
  }

  // The "svg" elements directly under the document; the name is matched without its prefix,
  // the way a libxml document looks elements up by tag name
  protected getRootElements(): XmlElement[] {
    const rootElements: XmlElement[] = [];
    for (const node of toArray(this.document.childNodes)) {
      if (isElement(node) && node.localName === "svg") {
        rootElements.push(node);
      }
    }
    return rootElements;
  }
}
