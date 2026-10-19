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

// JSON the way PHP's json_encode() writes it by default: "/" is escaped, anything
// outside ASCII is a \uXXXX escape, an empty list is [] and an empty map is {}
export class PhpJson {

  static encode(value: any): string {
    if (value === null || value === undefined) {
      return "null";
    }
    if (typeof value === "boolean") {
      return value ? "true" : "false";
    }
    if (typeof value === "number") {
      return Number.isFinite(value) ? "" + value : "0";
    }
    if (typeof value === "string") {
      return PhpJson.encodeString(value);
    }
    if (typeof value.toJSON === "function") {
      return PhpJson.encode(value.toJSON());
    }
    if (Array.isArray(value)) {
      return "[" + value.map((v) => PhpJson.encode(v)).join(",") + "]";
    }
    if (typeof value === "object") {
      const parts: string[] = [];
      for (const key of Object.keys(value)) {
        if (value[key] === undefined) {
          continue;
        }
        parts.push(PhpJson.encodeString(key) + ":" + PhpJson.encode(value[key]));
      }
      return "{" + parts.join(",") + "}";
    }
    return "null";
  }

  private static encodeString(value: string): string {
    let out = '"';
    for (let i = 0; i < value.length; i++) {
      const code = value.charCodeAt(i);
      const ch = value.charAt(i);
      if (ch === '"') {
        out += '\\"';
      } else if (ch === "\\") {
        out += "\\\\";
      } else if (ch === "/") {
        out += "\\/";
      } else if (ch === "\b") {
        out += "\\b";
      } else if (ch === "\f") {
        out += "\\f";
      } else if (ch === "\n") {
        out += "\\n";
      } else if (ch === "\r") {
        out += "\\r";
      } else if (ch === "\t") {
        out += "\\t";
      } else if (code < 0x20 || code > 0x7e) {
        out += "\\u" + code.toString(16).padStart(4, "0");
      } else {
        out += ch;
      }
    }
    return out + '"';
  }

}
