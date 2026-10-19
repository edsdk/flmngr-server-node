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

// Natural order string comparison, the way PHP's strnatcmp() does it: runs of digits
// compare by value ("file2" before "file10"), everything else byte by byte.
// Works on the UTF-8 bytes, like the original.

const ZERO = 0x30;
const NINE = 0x39;

function isDigit(c: number): boolean {
  return c >= ZERO && c <= NINE;
}

// space, \t, \n, \v, \f, \r
function isSpace(c: number): boolean {
  return c === 0x20 || (c >= 0x09 && c <= 0x0d);
}

function toUpper(c: number): number {
  return c >= 0x61 && c <= 0x7a ? c - 0x20 : c;
}

// The longest run of digits wins. That aside, the greatest value wins, but we can not
// know that until both runs are scanned, so the first difference is remembered
function compareRight(a: Buffer, b: Buffer, pos: { a: number; b: number }): number {
  let bias = 0;
  for (; ; pos.a++, pos.b++) {
    const aEnd = pos.a >= a.length || !isDigit(a[pos.a]);
    const bEnd = pos.b >= b.length || !isDigit(b[pos.b]);
    if (aEnd && bEnd) {
      return bias;
    } else if (aEnd) {
      return -1;
    } else if (bEnd) {
      return 1;
    } else if (a[pos.a] < b[pos.b]) {
      if (!bias) {
        bias = -1;
      }
    } else if (a[pos.a] > b[pos.b]) {
      if (!bias) {
        bias = 1;
      }
    }
  }
}

// Two left-aligned numbers (they start with a zero): the first difference wins
function compareLeft(a: Buffer, b: Buffer, pos: { a: number; b: number }): number {
  for (; ; pos.a++, pos.b++) {
    const aEnd = pos.a >= a.length || !isDigit(a[pos.a]);
    const bEnd = pos.b >= b.length || !isDigit(b[pos.b]);
    if (aEnd && bEnd) {
      return 0;
    } else if (aEnd) {
      return -1;
    } else if (bEnd) {
      return 1;
    } else if (a[pos.a] < b[pos.b]) {
      return -1;
    } else if (a[pos.a] > b[pos.b]) {
      return 1;
    }
  }
}

export function strnatcmp(strA: string, strB: string, caseInsensitive: boolean = false): number {
  const a = Buffer.from(strA, "utf8");
  const b = Buffer.from(strB, "utf8");

  if (a.length === 0 || b.length === 0) {
    return a.length === b.length ? 0 : (a.length > b.length ? 1 : -1);
  }

  const pos = {a: 0, b: 0};
  let leading = true;

  for (; ;) {
    let ca = pos.a < a.length ? a[pos.a] : 0;
    let cb = pos.b < b.length ? b[pos.b] : 0;

    // skip over leading zeros
    while (leading && ca === ZERO && pos.a + 1 < a.length && isDigit(a[pos.a + 1])) {
      ca = a[++pos.a];
    }
    while (leading && cb === ZERO && pos.b + 1 < b.length && isDigit(b[pos.b + 1])) {
      cb = b[++pos.b];
    }
    leading = false;

    // skip consecutive whitespace
    while (isSpace(ca)) {
      pos.a++;
      ca = pos.a < a.length ? a[pos.a] : 0;
    }
    while (isSpace(cb)) {
      pos.b++;
      cb = pos.b < b.length ? b[pos.b] : 0;
    }

    // process run of digits
    if (isDigit(ca) && isDigit(cb)) {
      const fractional = ca === ZERO || cb === ZERO;
      const result = fractional ? compareLeft(a, b, pos) : compareRight(a, b, pos);
      if (result !== 0) {
        return result;
      } else if (pos.a >= a.length && pos.b >= b.length) {
        return 0;
      } else if (pos.a >= a.length) {
        return -1;
      } else if (pos.b >= b.length) {
        return 1;
      } else {
        ca = a[pos.a];
        cb = b[pos.b];
      }
    }

    if (caseInsensitive) {
      ca = toUpper(ca);
      cb = toUpper(cb);
    }

    if (ca < cb) {
      return -1;
    } else if (ca > cb) {
      return 1;
    }

    pos.a++;
    pos.b++;
    if (pos.a >= a.length && pos.b >= b.length) {
      return 0;
    } else if (pos.a >= a.length) {
      return -1;
    } else if (pos.b >= b.length) {
      return 1;
    }
  }
}
