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

import xmldom from "@xmldom/xmldom";

// The part of the DOM the sanitizer uses, as the XML parser hands it over

export const ELEMENT_NODE = 1;
export const TEXT_NODE = 3;
export const CDATA_SECTION_NODE = 4;
export const DOCUMENT_NODE = 9;

export interface XmlNode {
  nodeType: number;
  nodeName: string;
  nodeValue: string | null;
  parentNode: XmlNode | null;
  childNodes: ArrayLike<XmlNode>;
  ownerDocument: XmlDocument | null;
  lineNumber?: number;
  hasChildNodes(): boolean;
  appendChild(child: XmlNode): XmlNode;
  removeChild(child: XmlNode): XmlNode;
  replaceChild(newChild: XmlNode, oldChild: XmlNode): XmlNode;
}

export interface XmlAttr extends XmlNode {
  name: string;
  localName: string;
  prefix: string | null;
  namespaceURI: string | null;
  value: string;
}

export interface XmlElement extends XmlNode {
  tagName: string;
  localName: string;
  prefix: string | null;
  namespaceURI: string | null;
  attributes: ArrayLike<XmlAttr>;
  hasAttribute(name: string): boolean;
  getAttribute(name: string): string | null;
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
  hasAttributeNS(namespace: string | null, localName: string): boolean;
  getAttributeNS(namespace: string | null, localName: string): string | null;
  getElementsByTagName(name: string): ArrayLike<XmlElement>;
}

export interface XmlDocument extends XmlNode {
  documentElement: XmlElement | null;
  createTextNode(text: string): XmlNode;
  getElementsByTagName(name: string): ArrayLike<XmlElement>;
}

// A namespace of our own for prefixes the document never declared. A strict parser refuses
// such a document; a lenient one keeps the whole "prefix:name" as the name and goes on, which
// is the behaviour the sanitizer's rules were written for. The declaration is added before
// parsing and the attributes are shown without a namespace afterwards (see attributesOf).
const UNDECLARED_NS = "urn:x-undeclared-prefix";
const UNDECLARED_KEY = "__undeclaredPrefixes";

export function isElement(node: XmlNode | null | undefined): node is XmlElement {
  return node != null && node.nodeType === ELEMENT_NODE;
}

export function toArray<T>(list: ArrayLike<T> | null | undefined): T[] {
  const out: T[] = [];
  if (list != null) {
    for (let i = 0; i < list.length; i++) {
      out.push(list[i]);
    }
  }
  return out;
}

function undeclaredPrefixesOf(node: XmlNode): Set<string> {
  const doc: any = node.nodeType === DOCUMENT_NODE ? node : node.ownerDocument;
  return doc && doc[UNDECLARED_KEY] ? doc[UNDECLARED_KEY] : new Set<string>();
}

// Namespace declarations are not attributes of the element for our purposes, the same way
// a libxml document never lists them among the attributes. An attribute with a prefix the
// document never declared is shown as a plain attribute whose name still carries the prefix.
export function attributesOf(element: XmlElement): XmlAttr[] {
  const out: XmlAttr[] = [];
  for (const attr of toArray(element.attributes)) {
    if (attr.name === "xmlns" || attr.name.startsWith("xmlns:")) {
      continue;
    }
    if (attr.namespaceURI === UNDECLARED_NS) {
      const view: XmlAttr = Object.create(attr);
      Object.defineProperties(view, {
        prefix: {value: ""},
        localName: {value: attr.name},
        namespaceURI: {value: null},
      });
      out.push(view);
    } else {
      out.push(attr);
    }
  }
  return out;
}

export class Xml {

  // null when the text is not well-formed XML
  static parse(xml: string): XmlDocument | null {
    const first = Xml.tryParse(xml);
    if (first.doc !== null) {
      return Xml.prepare(first.doc, new Set());
    }
    if (!first.namespaceError) {
      return null;
    }
    const undeclared = Xml.undeclaredPrefixes(xml);
    if (undeclared.size === 0) {
      return null;
    }
    const second = Xml.tryParse(Xml.declare(xml, undeclared));
    return second.doc === null ? null : Xml.prepare(second.doc, undeclared);
  }

  private static tryParse(xml: string): { doc: XmlDocument | null; namespaceError: boolean } {
    let namespaceError = false;
    try {
      const parser = new xmldom.DOMParser({
        onError: (level: string, message: string) => {
          if (level !== "warning") {
            if (message.indexOf("NamespaceError") !== -1) {
              namespaceError = true;
            }
            throw new Error(message);
          }
        },
      });
      const doc = parser.parseFromString(xml, "text/xml") as unknown as XmlDocument;
      if (doc == null || doc.documentElement == null) {
        return {doc: null, namespaceError};
      }
      return {doc, namespaceError};
    } catch (e) {
      if (String(e).indexOf("NamespaceError") !== -1) {
        namespaceError = true;
      }
      return {doc: null, namespaceError};
    }
  }

  private static prepare(doc: XmlDocument, undeclared: Set<string>): XmlDocument {
    (doc as any)[UNDECLARED_KEY] = undeclared;
    Xml.dropBlankTextNodes(doc);
    return doc;
  }

  // Prefixes used on elements or attributes without an xmlns declaration anywhere in the text
  private static undeclaredPrefixes(xml: string): Set<string> {
    const declared = new Set<string>(["xml", "xmlns"]);
    for (const m of xml.matchAll(/xmlns:([A-Za-z_][\w.-]*)\s*=/g)) {
      declared.add(m[1]);
    }
    const used = new Set<string>();
    for (const m of xml.matchAll(/<([A-Za-z_][\w.-]*):[A-Za-z_]/g)) {
      used.add(m[1]);
    }
    for (const m of xml.matchAll(/[\s"']([A-Za-z_][\w.-]*):[A-Za-z_][\w.-]*\s*=/g)) {
      used.add(m[1]);
    }
    const out = new Set<string>();
    for (const p of used) {
      if (!declared.has(p)) {
        out.add(p);
      }
    }
    return out;
  }

  // Declares the given prefixes on the root element
  private static declare(xml: string, prefixes: Set<string>): string {
    const m = /<([A-Za-z_][\w.:-]*)/.exec(xml.replace(/<\?[\s\S]*?\?>|<!--[\s\S]*?-->|<!DOCTYPE[\s\S]*?>/g, (s) => " ".repeat(s.length)));
    if (!m) {
      return xml;
    }
    const at = (m.index as number) + m[0].length;
    let decl = "";
    for (const p of prefixes) {
      decl += ' xmlns:' + p + '="' + UNDECLARED_NS + '"';
    }
    return xml.substring(0, at) + decl + xml.substring(at);
  }

  // Whitespace between tags is not content. It is kept where an element has real text in it,
  // and when it is all an element holds.
  private static dropBlankTextNodes(node: XmlNode): void {
    const children = toArray(node.childNodes);
    const hasRealText = children.some((c) =>
      (c.nodeType === TEXT_NODE || c.nodeType === CDATA_SECTION_NODE) && !Xml.isBlank(c));
    if (!hasRealText && children.length > 1) {
      for (const c of children) {
        if (c.nodeType === TEXT_NODE && Xml.isBlank(c)) {
          node.removeChild(c);
        }
      }
    }
    for (const c of toArray(node.childNodes)) {
      if (c.nodeType === ELEMENT_NODE) {
        Xml.dropBlankTextNodes(c);
      }
    }
  }

  private static isBlank(node: XmlNode): boolean {
    return (node.nodeValue ?? "").trim() === "";
  }

  // The document as text: declaration, elements one per line, children indented by two
  // spaces, every element closed with an end tag
  static serialize(doc: XmlDocument, onlyRoot: boolean): string {
    let out = "";
    if (!onlyRoot) {
      out += '<?xml version="1.0" encoding="UTF-8"?>\n';
    }
    const nodes = onlyRoot ? (doc.documentElement ? [doc.documentElement] : []) : toArray(doc.childNodes);
    const skip = undeclaredPrefixesOf(doc);
    for (const node of nodes) {
      out += Xml.writeNode(node, 0, skip) + "\n";
    }
    return out;
  }

  private static writeNode(node: XmlNode, depth: number, skip: Set<string>): string {
    const indent = "  ".repeat(depth);
    switch (node.nodeType) {
      case ELEMENT_NODE: {
        const el = node as XmlElement;
        let open = indent + "<" + el.tagName;
        // Like libxml: the namespace declarations go before the attributes, each kept in
        // document order, and the "xml" prefix is never declared (it is always bound)
        const declarations: XmlAttr[] = [];
        const attributes: XmlAttr[] = [];
        for (const attr of toArray(el.attributes)) {
          if (attr.name === "xmlns" || attr.name.startsWith("xmlns:")) {
            const prefix = attr.name.substring(6);
            if (prefix !== "xml" && !skip.has(prefix)) {
              declarations.push(attr);
            }
          } else {
            attributes.push(attr);
          }
        }
        for (const attr of declarations.concat(attributes)) {
          open += " " + attr.name + '="' + Xml.escapeAttribute(attr.value) + '"';
        }
        open += ">";
        const children = toArray(el.childNodes);
        if (children.length === 0) {
          return open + "</" + el.tagName + ">";
        }
        const format = children.every((c) => c.nodeType !== TEXT_NODE && c.nodeType !== CDATA_SECTION_NODE);
        if (format) {
          let out = open + "\n";
          for (const c of children) {
            out += Xml.writeNode(c, depth + 1, skip) + "\n";
          }
          return out + indent + "</" + el.tagName + ">";
        }
        let out = open;
        for (const c of children) {
          out += Xml.writeNode(c, 0, skip);
        }
        return out + "</" + el.tagName + ">";
      }
      case TEXT_NODE:
        return Xml.escapeText(node.nodeValue ?? "");
      case CDATA_SECTION_NODE:
        return "<![CDATA[" + (node.nodeValue ?? "") + "]]>";
      case 7: // processing instruction
        return indent + "<?" + node.nodeName + (node.nodeValue ? " " + node.nodeValue : "") + "?>";
      case 8: // comment
        return indent + "<!--" + (node.nodeValue ?? "") + "-->";
      default:
        return "";
    }
  }

  private static escapeText(text: string): string {
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\r/g, "&#13;");
  }

  private static escapeAttribute(text: string): string {
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
      .replace(/\n/g, "&#10;").replace(/\r/g, "&#13;").replace(/\t/g, "&#9;");
  }

  // Replace whatever an element holds with one text node
  static setTextContent(element: XmlElement, text: string): void {
    for (const c of toArray(element.childNodes)) {
      element.removeChild(c);
    }
    if (element.ownerDocument) {
      element.appendChild(element.ownerDocument.createTextNode(text));
    }
  }

  static textContent(node: XmlNode): string {
    if (node.nodeType === TEXT_NODE || node.nodeType === CDATA_SECTION_NODE) {
      return node.nodeValue ?? "";
    }
    let out = "";
    for (const c of toArray(node.childNodes)) {
      out += Xml.textContent(c);
    }
    return out;
  }

}
