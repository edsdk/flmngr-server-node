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

// Shell wildcard matching the way PHP's fnmatch() does it (the C library's fnmatch in a UTF-8
// locale, with no flags or with FNM_CASEFOLD): "*" matches anything including slashes and
// leading dots, "?" one character, "[...]" a set with ranges, negation and the usual classes,
// "\" escapes the next character. Works on characters (code points), not bytes.

export const FNM_CASEFOLD = 16;

function fold(c: string, casefold: boolean): string {
  return casefold ? c.toLowerCase() : c;
}

function inClass(name: string, c: string): boolean {
  switch (name) {
    case "alnum": return inClass("alpha", c) || inClass("digit", c);
    case "alpha": return /^\p{L}$/u.test(c);
    case "blank": return c === " " || c === "\t";
    case "cntrl": return /^\p{Cc}$/u.test(c);
    case "digit": return c >= "0" && c <= "9";
    case "graph": return !/^[\p{Z}\p{Cc}]$/u.test(c) && c !== "";
    case "lower": return /^\p{Ll}$/u.test(c);
    case "print": return !/^\p{Cc}$/u.test(c) && c !== "";
    case "punct": return /^[\p{P}\p{S}]$/u.test(c);
    case "space": return /^\s$/u.test(c);
    case "upper": return /^\p{Lu}$/u.test(c);
    case "xdigit": return /^[0-9A-Fa-f]$/.test(c);
    default: return false;
  }
}

function codePoint(c: string): number {
  return c.codePointAt(0) as number;
}

// A "[...]" at p[pi]. Answers whether the character `ch` is in the set and where the pattern
// continues; `literal` when the bracket is never closed (then "[" is a plain character).
function matchBracket(p: string[], pi: number, ch: string, casefold: boolean):
  { kind: "match" | "nomatch" | "literal"; next: number } {
  let i = pi + 1;
  let negate = false;
  if (i < p.length && (p[i] === "!" || p[i] === "^")) {
    negate = true;
    i++;
  }
  const fn = fold(ch, casefold);
  let matched = false;
  let first = true;
  for (; ;) {
    if (i >= p.length) {
      return {kind: "literal", next: pi + 1};
    }
    const c = p[i];
    if (c === "]" && !first) {
      i++;
      break;
    }
    first = false;
    let low: string;
    if (c === "\\") {
      if (i + 1 >= p.length) {
        return {kind: "nomatch", next: p.length};
      }
      low = fold(p[i + 1], casefold);
      i += 2;
    } else if (c === "[" && i + 1 < p.length && p[i + 1] === ":") {
      // [:class:]
      const end = indexOfPair(p, i + 2, ":", "]");
      if (end < 0) {
        return {kind: "literal", next: pi + 1};
      }
      const name = p.slice(i + 2, end).join("");
      // a class is tested on the character as it is, folding or not
      if (inClass(name, ch)) {
        matched = true;
      }
      i = end + 2;
      continue;
    } else if (c === "[" && i + 1 < p.length && (p[i + 1] === "=" || p[i + 1] === ".")) {
      // [=x=] or [.x.]: one character, taken as itself
      const end = indexOfPair(p, i + 2, p[i + 1], "]");
      if (end < 0) {
        return {kind: "literal", next: pi + 1};
      }
      const inner = p.slice(i + 2, end);
      if (inner.length === 1 && fold(inner[0], casefold) === fn) {
        matched = true;
      }
      i = end + 2;
      continue;
    } else {
      low = fold(c, casefold);
      i++;
    }

    // a range, unless "-" is the last character of the set
    if (i + 1 < p.length && p[i] === "-" && p[i + 1] !== "]") {
      let high: string;
      if (p[i + 1] === "\\") {
        if (i + 2 >= p.length) {
          return {kind: "nomatch", next: p.length};
        }
        high = fold(p[i + 2], casefold);
        i += 3;
      } else {
        high = fold(p[i + 1], casefold);
        i += 2;
      }
      if (codePoint(low) <= codePoint(fn) && codePoint(fn) <= codePoint(high)) {
        matched = true;
      }
    } else if (low === fn) {
      matched = true;
    }
  }
  return {kind: matched !== negate ? "match" : "nomatch", next: i};
}

function indexOfPair(p: string[], from: number, a: string, b: string): number {
  for (let i = from; i + 1 < p.length; i++) {
    if (p[i] === a && p[i + 1] === b) {
      return i;
    }
  }
  return -1;
}

export function fnmatch(pattern: string, str: string, flags: number = 0): boolean {
  const casefold = (flags & FNM_CASEFOLD) !== 0;
  const p = Array.from(pattern);
  const s = Array.from(str);

  let pi = 0;
  let si = 0;
  let starP = -1;
  let starS = -1;

  while (si < s.length || pi < p.length) {
    if (pi < p.length) {
      const c = p[pi];
      if (c === "*") {
        while (pi < p.length && p[pi] === "*") {
          pi++;
        }
        if (pi === p.length) {
          return true;
        }
        starP = pi;
        starS = si;
        continue;
      }
      if (si < s.length) {
        if (c === "?") {
          pi++;
          si++;
          continue;
        }
        if (c === "[") {
          const r = matchBracket(p, pi, s[si], casefold);
          if (r.kind === "match") {
            pi = r.next;
            si++;
            continue;
          }
          if (r.kind === "literal" && s[si] === "[") {
            pi++;
            si++;
            continue;
          }
        } else if (c === "\\") {
          if (pi + 1 < p.length && fold(p[pi + 1], casefold) === fold(s[si], casefold)) {
            pi += 2;
            si++;
            continue;
          }
        } else if (fold(c, casefold) === fold(s[si], casefold)) {
          pi++;
          si++;
          continue;
        }
      }
    }
    // no match here: go back to the last "*" and let it take one more character
    if (starP >= 0 && starS < s.length) {
      starS++;
      si = starS;
      pi = starP;
      continue;
    }
    return false;
  }
  return true;
}
