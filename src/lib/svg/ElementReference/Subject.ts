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
import {NestingException} from "../Exceptions/NestingException.js";
import {Usage} from "./Usage.js";

export class Subject {

  protected element: XmlElement;

  protected useCollection: Map<string, Usage> = new Map();

  protected usedInCollection: Map<string, Usage> = new Map();

  protected useNestingLimit: number;

  constructor(element: XmlElement, useNestingLimit: number) {
    this.element = element;
    this.useNestingLimit = useNestingLimit;
  }

  getElement(): XmlElement {
    return this.element;
  }

  getElementId(): string {
    return this.element.getAttribute("id") ?? "";
  }

  // `subjects` are the ones already seen on the way here; the list is copied for every step
  hasInfiniteLoop(subjects: Subject[] = [], level: number = 1): boolean {
    if (level > this.useNestingLimit) {
      throw new NestingException("Nesting level too high, aborting", 1570713498, null, this.getElement());
    }

    if (subjects.indexOf(this) !== -1) {
      return true;
    }
    subjects = subjects.concat([this]);
    for (const usage of this.useCollection.values()) {
      if (usage.getSubject().hasInfiniteLoop(subjects, level + 1)) {
        return true;
      }
    }
    return false;
  }

  addUse(subject: Subject): void {
    if (subject === this) {
      throw new Error("Cannot add self usage");
    }
    const identifier = subject.getElementId();
    const existing = this.useCollection.get(identifier);
    if (existing) {
      existing.increment();
      return;
    }
    this.useCollection.set(identifier, new Usage(subject));
  }

  addUsedIn(subject: Subject): void {
    if (subject === this) {
      throw new Error("Cannot add self as usage");
    }
    const identifier = subject.getElementId();
    const existing = this.usedInCollection.get(identifier);
    if (existing) {
      existing.increment();
      return;
    }
    this.usedInCollection.set(identifier, new Usage(subject));
  }

  countUse(accumulated: boolean = false): number {
    let count = 0;
    for (const use of this.useCollection.values()) {
      const useCount = use.getSubject().countUse();
      count += use.getCount() * (accumulated ? 1 + useCount : Math.max(1, useCount));
    }
    return count;
  }

  countUsedIn(): number {
    let count = 0;
    for (const usedIn of this.usedInCollection.values()) {
      count += usedIn.getCount() * Math.max(1, usedIn.getSubject().countUsedIn());
    }
    return count;
  }

  // Clear the internal collections (they can get big) and return the elements of all the
  // child usages
  clearInternalAndGetAffectedElements(): XmlElement[] {
    const elements: XmlElement[] = [];
    for (const usage of this.useCollection.values()) {
      elements.push(usage.getSubject().getElement());
    }

    this.usedInCollection = new Map();
    this.useCollection = new Map();

    return elements;
  }
}
