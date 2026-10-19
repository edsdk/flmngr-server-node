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

import {FlmngrRequest} from "./lib/FlmngrRequest.js";
import {IFmRequest} from "./lib/IFmRequest.js";
import {MessageException} from "./lib/MessageException.js";

export interface FlmngrConfig {

  // The directory with all the files the user manages
  dirFiles: string;

  // Where previews and file info are cached, dirFiles/.cache by default
  dirCache?: string;

  // Where uploads are kept while a request runs, the system temp dir by default
  dirTmp?: string;

  // Mode for the directories the library creates, 0o755 by default
  dirPermissions?: number | null;

  // File name patterns (fnmatch style, case-insensitive) that can not be uploaded
  // or renamed to. Replaces the built-in list: scripts, server config files, HTML
  denyFilePatterns?: string[];

  // true stretches small images to fill the preview box (the old behavior)
  doUpscalePreviews?: boolean;

  // The biggest request the server accepts, in bytes or with a k/m/g suffix
  // ("100M"). Not limited by default
  maxUploadSize?: number | string | null;

  request?: FlmngrRequest; // only for integration modules, not for defining by user except custom integrations

  onLogError?: (message: string) => void; // user may optionally set this, but integration module must have a fallback value

  // Called instead of the default logging when a request ends with an error the client gets
  messageExceptionLogger?: (e: MessageException, request: IFmRequest) => void;
}
