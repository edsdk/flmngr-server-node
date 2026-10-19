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

import {AllowedAttributes} from "./data/AllowedAttributes.js";
import {AllowedTags} from "./data/AllowedTags.js";
import {AttributeInterface} from "./data/AttributeInterface.js";
import {TagInterface} from "./data/TagInterface.js";
import {XPath} from "./data/XPath.js";
import {Resolver} from "./ElementReference/Resolver.js";
import {Helper} from "./Helper.js";
import {
  attributesOf,
  CDATA_SECTION_NODE,
  ELEMENT_NODE,
  isElement,
  TEXT_NODE,
  toArray,
  Xml,
  XmlDocument,
  XmlElement,
  XmlNode
} from "./Xml.js";

export interface XmlIssue {
  message: string;
  line: number;
}

// An SVG sanitizer: keeps the elements and attributes on the allow lists, drops scripts,
// event handlers, unsafe links and <use> chains that would blow up when rendered.
// sanitize() returns the clean document, or false when the input is not XML at all.
export class Sanitizer {

  protected xmlDocument: XmlDocument | null = null;

  protected allowedTags: string[];

  protected allowedAttrs: string[];

  protected minifyXML: boolean = false;

  protected removeRemoteReferences: boolean = false;

  protected useThreshold: number = 1000;

  protected removeXMLTag: boolean = false;

  protected xmlIssues: XmlIssue[] = [];

  protected elementReferenceResolver: Resolver | null = null;

  protected useNestingLimit: number = 15;

  protected allowHugeFiles: boolean = false;

  constructor() {
    // Load default tags/attributes
    this.allowedAttrs = AllowedAttributes.getAttributes().map((s) => s.toLowerCase());
    this.allowedTags = AllowedTags.getTags().map((s) => s.toLowerCase());
  }

  getAllowedTags(): string[] {
    return this.allowedTags;
  }

  setAllowedTags(allowedTags: TagInterface): void {
    this.allowedTags = allowedTags.getTags().map((s) => s.toLowerCase());
  }

  getAllowedAttrs(): string[] {
    return this.allowedAttrs;
  }

  setAllowedAttrs(allowedAttrs: AttributeInterface): void {
    this.allowedAttrs = allowedAttrs.getAttributes().map((s) => s.toLowerCase());
  }

  // Should we remove references to remote files?
  setRemoveRemoteReferences(removeRemoteRefs: boolean = false): void {
    this.removeRemoteReferences = removeRemoteRefs;
  }

  getXmlIssues(): XmlIssue[] {
    return this.xmlIssues;
  }

  getAllowHugeFiles(): boolean {
    return this.allowHugeFiles;
  }

  setAllowHugeFiles(allowHugeFiles: boolean): void {
    this.allowHugeFiles = allowHugeFiles;
  }

  // The sanitized document, or false when the input could not be parsed
  sanitize(dirty: string): string | false {
    // Don't run on an empty string
    if (dirty === "" || dirty === "0") {
      return "";
    }

    // recursively remove php tags because they can be hidden inside tags
    // i.e. <?p<?php test?>hp echo . ' danger! ';?>
    const phpTag = /<\?(=|php)(.+?)\?>/i;
    do {
      dirty = dirty.replace(new RegExp(phpTag.source, "gi"), "");
    } while (phpTag.test(dirty));

    // Strip any DOCTYPE/DTD before parsing. This prevents custom entity
    // definitions (which can collide with HTML5 named character references)
    // and DTD-defaulted attributes from ever reaching the parser.
    dirty = this.removeDoctype(dirty);

    this.resetInternal();
    this.setUpBefore();

    this.xmlDocument = Xml.parse(dirty);

    // If we couldn't parse the XML then we go no further. Reset and return false
    if (this.xmlDocument === null) {
      this.xmlIssues = [{message: "Document is not well-formed XML", line: 0}];
      this.resetAfter();
      return false;
    }

    // Pre-process all identified elements
    const xPath = new XPath(this.xmlDocument);
    this.elementReferenceResolver = new Resolver(xPath, this.useNestingLimit);
    this.elementReferenceResolver.collect();
    const elementsToRemove = this.elementReferenceResolver.getElementsToRemove();

    // Start the cleaning process
    this.startClean(toArray(this.xmlDocument.childNodes), elementsToRemove);

    // Save cleaned XML to a variable
    let clean = Xml.serialize(this.xmlDocument, this.removeXMLTag);

    this.resetAfter();

    // Remove any extra whitespaces when minifying
    if (this.minifyXML) {
      clean = clean.replace(/\s+/g, " ");
    }

    // Return result
    return clean;
  }

  // Remove any DOCTYPE declaration (and its internal subset) from the input string before it
  // reaches the XML parser. The internal subset is scanned with balanced brackets so that a
  // `>` appearing inside an entity value cannot prematurely terminate the match.
  protected removeDoctype(dirty: string): string {
    if (dirty.toLowerCase().indexOf("<!doctype") === -1) {
      return dirty;
    }

    let output = "";
    let offset = 0;
    const length = dirty.length;
    const lower = dirty.toLowerCase();

    let start: number;
    while ((start = lower.indexOf("<!doctype", offset)) !== -1) {
      output += dirty.substring(offset, start);
      let i = start + "<!DOCTYPE".length;
      let depth = 0;
      for (; i < length; i++) {
        const char = dirty.charAt(i);

        // A '[', ']' or '>' inside a DTD comment is not a real internal-subset
        // delimiter and must not affect the bracket depth.
        if (char === "<" && dirty.substring(i, i + 4) === "<!--") {
          const commentEnd = dirty.indexOf("-->", i + 4);
          if (commentEnd === -1) {
            i = length;
            break;
          }
          i = commentEnd + 2;
          continue;
        }

        // Likewise for a '[', ']' or '>' inside a quoted string.
        if (char === '"' || char === "'") {
          const stringEnd = dirty.indexOf(char, i + 1);
          if (stringEnd === -1) {
            i = length;
            break;
          }
          i = stringEnd;
          continue;
        }

        if (char === "[") {
          depth++;
        } else if (char === "]") {
          if (depth > 0) {
            depth--;
          }
        } else if (char === ">" && depth === 0) {
          i++;
          break;
        }
      }
      offset = i;
    }

    return output + dirty.substring(offset);
  }

  protected resetInternal(): void {
    this.xmlDocument = null;
  }

  protected setUpBefore(): void {
    // Reset array of altered XML
    this.xmlIssues = [];
  }

  protected resetAfter(): void {
    // nothing to put back: the parser keeps no global state
  }

  // Start the cleaning with tags, then we move onto attributes and hrefs later
  protected startClean(elements: XmlNode[], elementsToRemove: XmlElement[]): void {
    // Iterate over a static snapshot of the list, so that deleting a node skips no sibling
    const currentElements = elements.slice();

    // Once one element is listed, every element counts as listed: the PHP library compares
    // DOM nodes loosely, and two DOM elements are always equal that way. So a document with
    // one condemned <use> chain loses all of its <use> elements, and this port keeps that.
    const anyListed = elementsToRemove.length > 0;

    for (let i = currentElements.length - 1; i >= 0; i--) {
      const currentElement = currentElements[i];

      // If the element has exceeded the nesting limit, we should remove it.
      //
      // As it's only <use> elements that cause us issues with nesting DOS attacks
      // we should check what the element is before removing it. For now we'll only
      // remove <use> elements.
      if (isElement(currentElement) && anyListed && "use" === currentElement.nodeName) {
        currentElement.parentNode?.removeChild(currentElement);
        this.xmlIssues.push({
          message: "Invalid '" + currentElement.tagName + "'",
          line: this.lineOf(currentElement),
        });
        continue;
      }

      if (isElement(currentElement)) {
        // If the tag isn't in the whitelist, remove it and continue with next iteration
        if (this.allowedTags.indexOf(currentElement.tagName.toLowerCase()) === -1) {
          currentElement.parentNode?.removeChild(currentElement);
          this.xmlIssues.push({
            message: "Suspicious tag '" + currentElement.tagName + "'",
            line: this.lineOf(currentElement),
          });
          continue;
        }

        // Strip remote @import / url() references from inline <style> text.
        // The text content of <style> is never otherwise inspected, so remote
        // CSS references would pass straight through.
        if (currentElement.tagName.toLowerCase() === "style" && this.removeRemoteReferences) {
          Xml.setTextContent(currentElement, this.stripRemoteCssReferences(Xml.textContent(currentElement)));
        }

        this.cleanHrefs(currentElement);

        this.cleanXlinkHrefs(currentElement);

        this.cleanAttributesOnWhitelist(currentElement);

        if (currentElement.tagName.toLowerCase() === "use") {
          if (this.isUseTagDirty(currentElement)
            || this.isUseTagExceedingThreshold(currentElement)
          ) {
            currentElement.parentNode?.removeChild(currentElement);
            this.xmlIssues.push({
              message: "Suspicious '" + currentElement.tagName + "'",
              line: this.lineOf(currentElement),
            });
            continue;
          }
        }

        // Strip out font elements that will break out of foreign content.
        if (currentElement.tagName.toLowerCase() === "font") {
          let breaksOutOfForeignContent = false;
          for (const attribute of attributesOf(currentElement)) {
            if (["face", "color", "size"].indexOf(attribute.name.toLowerCase()) !== -1) {
              breaksOutOfForeignContent = true;
              break;
            }
          }

          if (breaksOutOfForeignContent) {
            currentElement.parentNode?.removeChild(currentElement);
            this.xmlIssues.push({
              message: "Suspicious tag '" + currentElement.tagName + "'",
              line: this.lineOf(currentElement),
            });
            continue;
          }
        }
      }

      this.cleanUnsafeNodes(currentElement);

      if (currentElement.hasChildNodes()) {
        this.startClean(toArray(currentElement.childNodes), elementsToRemove);
      }
    }
  }

  // Only allow attributes that are on the whitelist
  protected cleanAttributesOnWhitelist(element: XmlElement): void {
    // Work on a static snapshot of the attributes
    const attributes = attributesOf(element);

    for (let x = attributes.length - 1; x >= 0; x--) {
      // get attribute name
      const attrName = attributes[x].name;

      // Remove attribute if not in whitelist
      if (this.allowedAttrs.indexOf(attrName.toLowerCase()) === -1 && !this.isAriaAttribute(attrName.toLowerCase()) && !this.isDataAttribute(attrName.toLowerCase())) {

        element.removeAttribute(attrName);
        this.xmlIssues.push({
          message: "Suspicious attribute '" + attrName + "'",
          line: this.lineOf(element),
        });

        // Once removed, skip the remaining checks for this attribute so the
        // same name can never be passed to removeAttribute() twice in one iteration
        continue;
      }

      // This is used for when a namespace isn't imported properly.
      // Such as xlink:href when the xlink namespace isn't imported.
      // We have to do this as the link is still ran in this case.
      if (attrName.toLowerCase().indexOf("href") !== -1) {
        const href = element.getAttribute(attrName) ?? "";
        if (false === this.isHrefSafeValue(href)) {
          element.removeAttribute(attrName);
          this.xmlIssues.push({
            message: "Suspicious attribute 'href'",
            line: this.lineOf(element),
          });
          continue;
        }
      }

      // Do we want to strip remote references?
      if (this.removeRemoteReferences) {
        const value = attributes[x].value ?? "";

        // A remote url()/@import reference, or a value that is itself a remote
        // URL (e.g. a bare href/src).
        let isRemote = this.hasRemoteReference(value) || this.isRemoteUrl(value);

        // The style attribute is CSS, so resolve escapes/comments and reuse the
        // same remote-token detection used for <style> elements (this also
        // catches image-set() and escape-obfuscated references).
        if (!isRemote && attrName.toLowerCase() === "style") {
          const normalized = this.normalizeCss(value);
          isRemote = this.stripRemoteCssTokens(normalized) !== normalized;
        }

        // Remove attribute if it has a remote reference
        if (isRemote) {
          element.removeAttribute(attrName);
          this.xmlIssues.push({
            message: "Suspicious attribute '" + attrName + "'",
            line: this.lineOf(element),
          });
        }
      }
    }
  }

  // Clean the xlink:hrefs of script and data embeds
  protected cleanXlinkHrefs(element: XmlElement): void {
    for (const attribute of attributesOf(element)) {
      // remove attributes with unexpected namespace prefix, e.g. `XLinK:href` (instead of `xlink:href`)
      if ((attribute.prefix ?? "") === "" && attribute.name.toLowerCase() === "xlink:href") {
        element.removeAttribute(attribute.name);
        this.xmlIssues.push({
          message: "Unexpected attribute '" + attribute.name + "'",
          line: this.lineOf(element),
        });
      }
    }
    this.cleanHrefAttributes(element, "xlink");
  }

  // Clean the hrefs of script and data embeds
  protected cleanHrefs(element: XmlElement): void {
    this.cleanHrefAttributes(element);
  }

  protected cleanHrefAttributes(element: XmlElement, prefix: string = ""): void {
    const relevantAttributes = attributesOf(element).filter((attr) =>
      attr.localName.toLowerCase() === "href" && ("" + (attr.prefix ?? "")).toLowerCase() === prefix);
    for (const attribute of relevantAttributes) {
      if (!this.isHrefSafeValue(attribute.value)) {
        element.removeAttribute(attribute.name);
        this.xmlIssues.push({
          message: "Suspicious attribute '" + attribute.name + "'",
          line: this.lineOf(element),
        });
        continue;
      }
      // in case the attribute name is `HrEf`/`xlink:HrEf`, adjust it to `href`/`xlink:href`
      if (this.allowedAttrs.indexOf(attribute.name) === -1
        && this.allowedAttrs.indexOf(attribute.name.toLowerCase()) !== -1
      ) {
        const value = attribute.value;
        element.removeAttribute(attribute.name);
        element.setAttribute(attribute.name.toLowerCase(), value);
      }
    }
  }

  // Only allow whitelisted starts to be within the href.
  //
  // This will stop scripts etc from being passed through, with or without attempting to hide bypasses.
  // This stops the need for us to use a complicated script regex.
  protected isHrefSafeValue(value: string | null): boolean {

    // Allow empty values
    if (value === null || value === "" || value === "0") {
      return true;
    }

    // Allow fragment identifiers.
    if ("#" === value.substring(0, 1)) {
      return true;
    }

    // Allow relative URIs.
    if ("/" === value.substring(0, 1)) {
      return true;
    }

    // Allow HTTPS domains.
    if ("https://" === value.substring(0, 8)) {
      return true;
    }

    // Allow HTTP domains.
    if ("http://" === value.substring(0, 7)) {
      return true;
    }

    // Allow known data URIs.
    if ([
      "data:image/png", // PNG
      "data:image/gif", // GIF
      "data:image/jpg", // JPG
      "data:image/jpe", // JPEG
      "data:image/pjp", // PJPEG
    ].indexOf(value.substring(0, 14)) !== -1) {
      return true;
    }

    // Allow known short data URIs.
    if ([
      "data:img/png", // PNG
      "data:img/gif", // GIF
      "data:img/jpg", // JPG
      "data:img/jpe", // JPEG
      "data:img/pjp", // PJPEG
    ].indexOf(value.substring(0, 12)) !== -1) {
      return true;
    }

    return false;
  }

  // Removes non-printable ASCII characters from string & trims it
  protected removeNonPrintableCharacters(value: string): string {
    return value.replace(/[^ -~]/gu, "").trim();
  }

  // Does this attribute value embed a remote reference anywhere within it?
  //
  // Detects a remote `url(...)` or remote `@import` regardless of quoting and
  // regardless of where it appears in the value (e.g. amongst other CSS
  // declarations in a `style` attribute). Only remote targets are flagged, so
  // local (`/x`) and fragment (`#x`) references are preserved.
  protected hasRemoteReference(value: string): boolean {
    value = this.removeNonPrintableCharacters(value);

    if (/url\(\s*['"]?\s*((?:https?|ftp|file):)?\/\//i.test(value)) {
      return true;
    }

    if (/@import\s+(?:url\(\s*)?['"]?\s*((?:https?|ftp|file):)?\/\//i.test(value)) {
      return true;
    }

    return false;
  }

  // Is the value itself a remote URL (a bare href/src rather than a url() wrapper)?
  //
  // Flags absolute (`http(s)`/`ftp`/`file`) and protocol-relative (`//`) URLs while
  // leaving local (`/x`) and fragment (`#x`) references untouched.
  protected isRemoteUrl(value: string): boolean {
    value = this.removeNonPrintableCharacters(value);

    return /^\s*(?:(?:https?|ftp|file):)?\/\//i.test(value);
  }

  // Strip remote references (url(), @import, image-set()) from CSS text, used for
  // inline <style> content when removeRemoteReferences is enabled.
  //
  // CSS escapes and comments are resolved first so obfuscated references (e.g.
  // `\75 rl(` or `@\69 mport`) cannot hide from the token match. This remains
  // best-effort: a regex-based stripper cannot see through every CSS construct
  // (the bare-string forms of image()/src() are not handled, for instance), so
  // untrusted CSS should still be isolated at the embedding boundary.
  protected stripRemoteCssReferences(css: string): string {
    const normalized = this.normalizeCss(css);
    const strippedNormalized = this.stripRemoteCssTokens(normalized);

    // If decoding escapes/comments exposed a remote reference that the raw text
    // hides, keep the normalized (and stripped) result. Otherwise strip the
    // original in place, leaving legitimate escaped CSS untouched.
    if (strippedNormalized !== normalized && normalized !== css) {
      return strippedNormalized;
    }

    return this.stripRemoteCssTokens(css);
  }

  // Remove the CSS constructs that can trigger a remote fetch
  protected stripRemoteCssTokens(css: string): string {
    // Terminate on ')' when present, or on the rule/line boundary ('}', CR, LF)
    // or end of input otherwise. A CSS tokenizer closes an unclosed url()/
    // function token implicitly and still fetches, so requiring a closing paren
    // would let a value that omits it slip past.
    css = css.replace(/url\(\s*['"]?\s*(?:(?:https?|ftp|file):)?\/\/[^)}\r\n]*\)?/gi, "");
    css = css.replace(/@import\b[^;]*;?/gi, "");
    // image-set() accepts a bare remote string with no url() token of its own.
    css = css.replace(/(?:-webkit-)?image-set\s*\([^)}\r\n]*['"]\s*(?:(?:https?|ftp|file):)?\/\/[^)}\r\n]*\)?/gi, "");

    return css;
  }

  // Resolve CSS escapes and comments so obfuscated tokens can be matched
  protected normalizeCss(css: string): string {
    css = this.decodeCssEscapes(css);
    // Replace comments with a space so they can neither glue nor split tokens.
    css = css.replace(/\/\*[\s\S]*?\*\//g, " ");

    return css;
  }

  // Decode CSS escape sequences (`\XX` hex escapes and `\c` literal escapes)
  // into the characters they represent
  protected decodeCssEscapes(css: string): string {
    return css.replace(
      /\\([0-9A-Fa-f]{1,6})[ \t\r\n\f]?|\\([\s\S])/g,
      (match: string, hex: string | undefined, literal: string | undefined) => {
        if (hex !== undefined && hex !== "") {
          const codepoint = parseInt(hex, 16);
          if (codepoint === 0 || codepoint > 0x10FFFF) {
            return "�";
          }
          return String.fromCodePoint(codepoint);
        }
        return literal ?? "";
      }
    );
  }

  // Should we minify the output?
  minify(shouldMinify: boolean = false): void {
    this.minifyXML = !!shouldMinify;
  }

  // Should we remove the XML tag in the header?
  setRemoveXMLTag(removeXMLTag: boolean = false): void {
    this.removeXMLTag = !!removeXMLTag;
  }

  // Whether `<use ... xlink:href="#identifier">` elements shall be
  // removed in case expansion would exceed this threshold
  setUseThreshold(useThreshold: number = 1000): void {
    this.useThreshold = Math.trunc(useThreshold);
  }

  protected isAriaAttribute(attributeName: string): boolean {
    return attributeName.startsWith("aria-");
  }

  protected isDataAttribute(attributeName: string): boolean {
    return attributeName.startsWith("data-");
  }

  // Make sure our use tag is only referencing internal resources
  protected isUseTagDirty(element: XmlElement): boolean {
    const href = Helper.getElementHref(element);
    return !!href && href !== "0" && !href.startsWith("#");
  }

  // Determines whether `<use ... xlink:href="#identifier">` is expanded
  // recursively in order to create DoS scenarios. The amount of a actually
  // used element needs to be below `this.useThreshold`.
  protected isUseTagExceedingThreshold(element: XmlElement): boolean {
    if (this.useThreshold <= 0) {
      return false;
    }
    const useId = Helper.extractIdReferenceFromHref(
      Helper.getElementHref(element)
    );
    if (useId === null || this.elementReferenceResolver === null) {
      return false;
    }
    for (const subject of this.elementReferenceResolver.findByElementId(useId)) {
      if (subject.countUse() >= this.useThreshold) {
        return true;
      }
    }
    return false;
  }

  // Set the nesting limit for <use> tags
  setUseNestingLimit(limit: number): void {
    this.useNestingLimit = Math.trunc(limit);
  }

  // Remove nodes that are either invalid or malformed
  protected cleanUnsafeNodes(currentElement: XmlNode): void {
    // Replace CDATA node with encoded text node
    if (currentElement.nodeType === CDATA_SECTION_NODE) {
      const doc = currentElement.ownerDocument;
      if (doc && currentElement.parentNode) {
        const textNode = doc.createTextNode(currentElement.nodeValue ?? "");
        currentElement.parentNode.replaceChild(textNode, currentElement);
      }
      // If the element doesn't have a tagname, remove it and continue with next iteration
    } else if (currentElement.nodeType !== ELEMENT_NODE && currentElement.nodeType !== TEXT_NODE) {
      currentElement.parentNode?.removeChild(currentElement);
      this.xmlIssues.push({
        message: "Suspicious node '" + currentElement.nodeName + "'",
        line: this.lineOf(currentElement),
      });
      return;
    }

    if (currentElement.hasChildNodes()) {
      // Same as in startClean(): work on a static snapshot
      const childNodes = toArray(currentElement.childNodes);
      for (let j = childNodes.length - 1; j >= 0; j--) {
        this.cleanUnsafeNodes(childNodes[j]);
      }
    }
  }

  private lineOf(node: XmlNode): number {
    return typeof node.lineNumber === "number" ? node.lineNumber : 0;
  }
}
