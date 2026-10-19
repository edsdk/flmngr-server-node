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

import {PhpJson} from "./php/PhpJson.js";

export class JsonCodec {

  protected m_actions: any;

  constructor(actions: any) {
    this.m_actions = actions;
  }

  fromJson(json: string): any {
    const jsonObj = JSON.parse(json);
    if (jsonObj === null) {
      throw new Error("Unable to parse JSON");
    }
    if (jsonObj.action === undefined) {
      throw new Error('"Unable to detect action in JSON"');
    }
    const action = this.m_actions.getAction(jsonObj.action);
    if (action === null) {
      throw new Error("JSON action is incorrect: " + action);
    }
    return jsonObj;
  }

  toJson(resp: any): string {
    return JsonCodec.s_toJson(resp);
  }

  static s_toJson(resp: any): string {
    let json = PhpJson.encode(resp);
    json = json.split("\\u0000*\\u0000").join("");
    json = json.split("\\u0000").join("");
    return json;
  }
}
