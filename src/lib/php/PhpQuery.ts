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

import {PhpArray, PhpValue} from "../IFmRequest.js";

// A nested structure under construction: every level is a map, lists are told apart at the end
type Node = { keys: Map<string, Node | string>; nextIndex: number };

// Query string and urlencoded body parsing with PHP's rules (parse_str): "a[]=1&a[]=2"
// is a list, "a[x]=1" a map, a repeated plain key keeps the last value, "+" is a
// space, dots and spaces in a key become underscores.
export class PhpQuery {

  static parse(query: string): PhpArray {
    const root = PhpQuery.node();
    if (query != null && query !== "") {
      for (const pair of query.split("&")) {
        if (pair === "") {
          continue;
        }
        const eq = pair.indexOf("=");
        const rawKey = eq < 0 ? pair : pair.substring(0, eq);
        const rawValue = eq < 0 ? "" : pair.substring(eq + 1);
        PhpQuery.addTo(root, PhpQuery.decode(rawKey), PhpQuery.decode(rawValue));
      }
    }
    return PhpQuery.finish(root) as PhpArray;
  }

  // One already decoded key/value pair, as a multipart field gives it, added to a parsed result
  static add(target: PhpArray, key: string, value: string): void {
    const root = PhpQuery.fromValue(target);
    PhpQuery.addTo(root, key, value);
    const finished = PhpQuery.finish(root) as PhpArray;
    for (const k of Object.keys(target)) {
      delete target[k];
    }
    Object.assign(target, finished);
  }

  static decode(value: string): string {
    try {
      return decodeURIComponent(value.replace(/\+/g, " "));
    } catch (e) {
      // not valid percent-encoding: keep what can be read
      return value.replace(/\+/g, " ").replace(/%([0-9A-Fa-f]{2})/g, (m, hex) => String.fromCharCode(parseInt(hex, 16)));
    }
  }

  private static node(): Node {
    return {keys: new Map(), nextIndex: 0};
  }

  private static fromValue(value: PhpValue): Node {
    const n = PhpQuery.node();
    if (Array.isArray(value)) {
      value.forEach((v, i) => PhpQuery.setKey(n, "" + i, typeof v === "string" ? v : PhpQuery.fromValue(v)));
    } else if (value !== null && typeof value === "object") {
      for (const k of Object.keys(value)) {
        const v = value[k];
        PhpQuery.setKey(n, k, typeof v === "string" ? v : PhpQuery.fromValue(v));
      }
    }
    return n;
  }

  private static addTo(root: Node, key: string, value: string): void {
    const path = PhpQuery.splitKey(key);
    if (path === null) {
      return;
    }
    let current = root;
    for (let i = 0; i < path.length - 1; i++) {
      const part = path[i];
      const k = part === "" ? "" + current.nextIndex : part;
      let child = current.keys.get(k);
      if (child === undefined || typeof child === "string") {
        child = PhpQuery.node();
      }
      PhpQuery.setKey(current, k, child);
      current = child;
    }
    const last = path[path.length - 1];
    PhpQuery.setKey(current, last === "" ? "" + current.nextIndex : last, value);
  }

  private static setKey(n: Node, key: string, value: Node | string): void {
    n.keys.set(key, value);
    if (/^(0|[1-9][0-9]*)$/.test(key)) {
      n.nextIndex = Math.max(n.nextIndex, parseInt(key, 10) + 1);
    }
  }

  // "a[x][]" -> ["a", "x", ""]; an unclosed "[" makes the rest a part of the plain name
  private static splitKey(key: string): string[] | null {
    const name = key.replace(/^ +/, "");
    if (name === "") {
      return null;
    }
    const bracket = name.indexOf("[");
    let base = bracket < 0 ? name : name.substring(0, bracket);
    let rest = bracket < 0 ? "" : name.substring(bracket);
    if (rest !== "" && rest.indexOf("]") < 0) {
      base = base + rest;
      rest = "";
    }
    base = base.replace(/[ .[]/g, "_");
    const path = [base];
    while (rest !== "") {
      if (rest.charAt(0) !== "[") {
        break; // trailing text after the last "]" is dropped
      }
      const close = rest.indexOf("]");
      if (close < 0) {
        break;
      }
      path.push(rest.substring(1, close));
      rest = rest.substring(close + 1);
    }
    return path;
  }

  // A map whose keys are exactly 0..n-1 is a list, like a PHP array becomes in JSON
  private static finish(n: Node): PhpValue {
    const keys = Array.from(n.keys.keys());
    const isList = keys.length === 0 || keys.every((k, i) => k === "" + i);
    if (isList) {
      return keys.map((k) => PhpQuery.finishValue(n.keys.get(k) as Node | string));
    }
    const out: PhpArray = {};
    for (const k of keys) {
      out[k] = PhpQuery.finishValue(n.keys.get(k) as Node | string);
    }
    return out;
  }

  private static finishValue(value: Node | string): PhpValue {
    return typeof value === "string" ? value : PhpQuery.finish(value);
  }

}
