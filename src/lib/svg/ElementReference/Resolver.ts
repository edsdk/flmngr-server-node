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
import {XPath} from "../data/XPath.js";
import {NestingException} from "../Exceptions/NestingException.js";
import {Helper} from "../Helper.js";
import {Subject} from "./Subject.js";

export class Resolver {

  protected xPath: XPath;

  protected subjects: Map<string, Subject> = new Map();

  protected elementsToRemove: XmlElement[] = [];

  protected useNestingLimit: number;

  constructor(xPath: XPath, useNestingLimit: number) {
    this.xPath = xPath;
    this.useNestingLimit = useNestingLimit;
  }

  collect(): void {
    this.collectIdentifiedElements();
    this.processReferences();
    this.determineInvalidSubjects();
  }

  // One subject by element, optionally searching the subjects' children as well
  findByElement(element: XmlElement, considerChildren: boolean = false): Subject | null {
    for (const subject of this.subjects.values()) {
      if (
        element === subject.getElement()
        || considerChildren && Helper.isElementContainedIn(element, subject.getElement())
      ) {
        return subject;
      }
    }
    return null;
  }

  // Subjects (plural!) by element id - in theory malformed DOM might have the same id
  // assigned to different elements, leaving it to the browser which element to use
  findByElementId(elementId: string): Subject[] {
    const out: Subject[] = [];
    for (const subject of this.subjects.values()) {
      if (elementId === subject.getElementId()) {
        out.push(subject);
      }
    }
    return out;
  }

  // Collects elements having an `id` attribute (those that can be referenced)
  protected collectIdentifiedElements(): void {
    for (const element of this.xPath.queryElementsWithId()) {
      this.subjects.set(element.getAttribute("id") ?? "", new Subject(element, this.useNestingLimit));
    }
  }

  // Processes references from and to elements having an `id` attribute concerning their
  // occurrence in `<use ... xlink:href="#identifier">` statements
  protected processReferences(): void {
    // The href attribute is deliberately not filtered by name here: `HrEf`/`xlink:HrEf` are
    // normalized back to `href`/`xlink:href` later and would otherwise hide a live reference
    const useNodeName = this.xPath.createNodeName("use");
    for (const subject of this.subjects.values()) {
      const useElements = this.xPath.queryChildren(useNodeName, subject.getElement());

      for (const useElement of useElements) {
        const useId = Helper.extractIdReferenceFromHref(
          Helper.getElementHref(useElement)
        );
        if (useId === null || !this.subjects.has(useId)) {
          continue;
        }
        const target = this.subjects.get(useId) as Subject;
        subject.addUse(target);
        target.addUsedIn(subject);
      }
    }
  }

  // Determines and tags infinite loops
  protected determineInvalidSubjects(): void {
    for (const subject of this.subjects.values()) {

      // A loose comparison of DOM elements is always true in the PHP library, so from the
      // first invalid subject on every remaining one is skipped; kept as it is
      if (this.elementsToRemove.length > 0) {
        continue;
      }

      const useId = Helper.extractIdReferenceFromHref(
        Helper.getElementHref(subject.getElement())
      );

      try {
        if (useId === subject.getElementId()) {
          this.markSubjectAsInvalid(subject);
        } else if (subject.hasInfiniteLoop()) {
          this.markSubjectAsInvalid(subject);
        }
      } catch (e) {
        if (e instanceof NestingException) {
          const element = e.getElement();
          if (element !== null) {
            this.elementsToRemove.push(element);
          }
          this.markSubjectAsInvalid(subject);
        } else {
          throw e;
        }
      }
    }
  }

  // All the elements that caused a nesting exception
  getElementsToRemove(): XmlElement[] {
    return this.elementsToRemove;
  }

  // The subject is invalid for some reason, so it goes with all its child usages
  protected markSubjectAsInvalid(subject: Subject): void {
    this.elementsToRemove = this.elementsToRemove.concat(
      subject.clearInternalAndGetAffectedElements()
    );
  }
}
