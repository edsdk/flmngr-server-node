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

import {FailMessage, Message} from "../model/Message.js";

export class MessageException extends Error {

  protected failMessage: FailMessage;

  protected sourceException: unknown;

  constructor(message: Message | FailMessage, sourceException: unknown = null) {
    super("Flmngr error " + message.code);
    this.name = "MessageException";
    this.failMessage = {
      code: message.code,
      args: message.args,
      isCacheIssue: message.isCacheIssue
    };
    this.sourceException = sourceException;
    if (sourceException == null) {
      this.sourceException = new Error("(manually created exception)");
    }
  }

  getFailMessage(): FailMessage {
    return this.failMessage;
  }

  getSourceException(): unknown {
    return this.sourceException;
  }

}
