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

import * as fs from "node:fs";
import * as path from "node:path";
import {Message} from "../model/Message.js";
import {Utils} from "../lib/file/Utils.js";
import {Profile} from "../lib/Profile.js";
import {MessageException} from "../lib/MessageException.js";
import {FMDir} from "../model/FMDir.js";
import {FMFile} from "../model/FMFile.js";
import {IFmRequest, PhpValue} from "../lib/IFmRequest.js";
import {FlmngrConfig} from "../FlmngrConfig.js";
import {fnmatch, FNM_CASEFOLD} from "../lib/php/fnmatch.js";
import {strnatcmp} from "../lib/php/strnatcmp.js";
import {Sanitizer} from "../lib/svg/Sanitizer.js";
import {Gd} from "../lib/image/Gd.js";
import {DriverLocal} from "./DriverLocal.js";
import {CachedFile, CachedImageInfo, PreviewResult} from "./CachedFile.js";

// One entry of a listing: what the client shows for a file
export interface FileStructure {
  name: string;
  size: number | null;
  timestamp: number | null;
  width?: number | null;
  height?: number | null;
  blurHash?: string | null;
  formats?: { [formatId: string]: FileStructure } | never[];
}

// A resized copy of an image that exists: its path and how the name was built
interface FormatFile {
  path: string;
  dir: string;
  suffix: string;
  ext: string;
}

// --- the request values the way PHP reads them --------------------------------------------------

function isset(value: PhpValue | undefined | null): boolean {
  return value !== undefined && value !== null;
}

// '' . $value: a missing value is an empty string, a list is "Array"
function s(value: PhpValue | undefined | null): string {
  if (value === undefined || value === null) {
    return "";
  }
  return typeof value === "string" ? value : "Array";
}

// A value in an `if`: "", "0", an empty list and a missing value are false
function truthy(value: PhpValue | undefined | null): boolean {
  if (value === undefined || value === null || value === "" || value === "0") {
    return false;
  }
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  if (typeof value === "object") {
    return Object.keys(value).length > 0;
  }
  return true;
}

// A value that is counted or indexed: anything but a list is a type error
function list(value: PhpValue | undefined | null): PhpValue[] {
  if (Array.isArray(value)) {
    return value;
  }
  if (value !== null && typeof value === "object") {
    return Object.values(value);
  }
  throw new TypeError("Argument must be of type array, " + (value === undefined || value === null ? "null" : typeof value) + " given");
}

// A value that is only iterated: anything but a list iterates as nothing
function each(value: PhpValue | undefined | null): PhpValue[] {
  if (Array.isArray(value)) {
    return value;
  }
  if (value !== null && typeof value === "object") {
    return Object.values(value);
  }
  return [];
}

// $value[$i] on a list or a string
function at(value: PhpValue | undefined | null, i: number): PhpValue | null {
  if (Array.isArray(value)) {
    return value[i] === undefined ? null : value[i];
  }
  if (typeof value === "string") {
    return i < value.length ? value.charAt(i) : "";
  }
  if (value !== null && typeof value === "object") {
    return value["" + i] === undefined ? null : value["" + i];
  }
  return null;
}

// $value + 0: numbers from strings, nothing from anything else
function num(value: PhpValue | undefined | null): number {
  if (value === undefined || value === null) {
    return 0;
  }
  if (typeof value === "string") {
    const n = Number(value.trim());
    return Number.isFinite(n) ? n : 0;
  }
  return Array.isArray(value) ? value.length : 1;
}

function rtrimSlashes(value: string): string {
  return value.replace(/[\\/]+$/, "");
}

// array_slice($list, $offset, $length)
function arraySlice<T>(arr: T[], offset: number, length: number | null): T[] {
  offset = Math.trunc(offset);
  if (offset < 0) {
    offset = Math.max(0, arr.length + offset);
  }
  if (offset > arr.length) {
    return [];
  }
  if (length === null) {
    return arr.slice(offset);
  }
  length = Math.trunc(length);
  if (length < 0) {
    return arr.slice(offset, Math.max(offset, arr.length + length));
  }
  return arr.slice(offset, offset + length);
}

export class FileSystem {

  private driverFiles: DriverLocal;

  private driverCache: DriverLocal;

  private denyFilePatterns: string[];

  private doUpscalePreviews: boolean;

  // Set from outside (FlmngrServer reads it from the request), so it is public
  embedPreviews: PhpValue | boolean = false;

  // File names not allowed to upload or rename to: scripts (also with double
  // extension like "x.php.jpg"), server config files, HTML and XHTML (both run
  // scripts in the browser), gzipped SVG (the sanitizer reads plain .svg only),
  // ES modules (Apache serves .es and .mjs as JavaScript). Plain SVG is allowed
  // but gets sanitized. The list can be overridden with 'denyFilePatterns' option.
  // Also it is always a good idea to disable script execution in files dir
  static readonly DEFAULT_DENY_FILE_PATTERNS = [
    ".htaccess", ".htpasswd", ".user.ini",
    "*.php*", "*.phtml", "*.phar", "*.pht", "*.phps",
    "*.htm", "*.html", "*.shtml", "*.xhtml", "*.xhtm", "*.xht",
    "*.svgz", "*.mjs", "*.es",
    "*.aspx", "*.asa", "*.asax", "*.ascx", "*.ashx", "*.asmx", "*.axd", "web.config", "*.cer",
    "*.cfm", "*.cfml", "*.cfc", "*.jsp", "*.jspx", "*.jspf",
  ];

  constructor(config: FlmngrConfig) {
    let dirFiles: string | null = config.dirFiles !== undefined ? config.dirFiles : null; // null will cause exception later
    let dirCache: string | null = config.dirCache !== undefined ? config.dirCache : (dirFiles === null ? null : dirFiles + "/.cache");
    dirFiles = dirFiles === null ? null : dirFiles.replace(/\\/g, "/");
    dirCache = dirCache === null ? null : dirCache.replace(/\\/g, "/");
    const dirPermissions = config.dirPermissions !== undefined ? config.dirPermissions : null;
    this.driverFiles = new DriverLocal({dir: dirFiles, dirPermissions: dirPermissions});
    this.driverCache = new DriverLocal({dir: dirCache, dirPermissions: dirPermissions}, true);
    this.driverFiles.setDriverCache(this.driverCache);
    this.denyFilePatterns = config.denyFilePatterns !== undefined ? config.denyFilePatterns : FileSystem.DEFAULT_DENY_FILE_PATTERNS;
    // true returns old behavior: stretch small images to fill the preview box
    this.doUpscalePreviews = config.doUpscalePreviews !== undefined ? !!config.doUpscalePreviews : false;
  }

  private getRelativePath(p: string): string {
    if (p.indexOf("..") !== -1) {
      throw new MessageException(
        Message.createMessage(
          false,
          Message.FM_DIR_NAME_CONTAINS_INVALID_SYMBOLS
        )
      );
    }

    if (p.indexOf("/") !== 0) {
      p = "/" + p;
    }

    const rootDirName = this.driverFiles.getRootDirName();

    if (p === "/Files") {
      p = "/" + rootDirName;
    } else {
      if (p.indexOf("/Files/") === 0) {
        p = "/" + rootDirName + "/" + p.substring(7);
      }
    }
    // Path must be the root dir itself or lay inside it, we compare by full
    // path segments here ("/files" must not match "/files_secret").
    // A driver with an empty root dir name relies on the '..' check above,
    // so the check is skipped for it
    const root = "/" + rootDirName;
    if (rootDirName !== "" && p !== root && p.indexOf(root + "/") !== 0) {
      throw new MessageException(
        Message.createMessage(
          false,
          Message.FM_DIR_NAME_INCORRECT_ROOT
        )
      );
    }

    return p.substring(root.length);
  }

  // Check file name against denyFilePatterns before writing anything.
  // Must be a name, not a path, so it can not point outside of the dir we write
  // into. Dots inside the name are ok ("report..final.pdf"), only "." and ".." are not.
  private assertFileNameAllowed(nameValue: PhpValue | undefined | null): void {
    const name = s(nameValue);

    if (
      name.indexOf("/") !== -1 ||
      name.indexOf("\\") !== -1 ||
      name.indexOf("\0") !== -1
    ) {
      console.error("Flmngr: rejected file name '" + name + "' (not a plain file name)");
      throw new MessageException(
        Message.createMessage(
          false,
          Message.FM_DIR_NAME_CONTAINS_INVALID_SYMBOLS
        )
      );
    }

    const basename = path.posix.basename(name);
    let denied = basename === "" || basename === "." || basename === "..";
    let matchedPattern: string | null = denied ? "(empty or relative name)" : null;
    if (!denied) {
      for (const pattern of this.denyFilePatterns) {
        if (fnmatch(pattern, basename, FNM_CASEFOLD) === true) {
          denied = true;
          matchedPattern = pattern;
          break;
        }
      }
    }
    if (denied) {
      // Matched rule goes into the log only, we do not show it to the user
      console.error("Flmngr: rejected file name '" + basename + "' (denyFilePatterns rule: " + matchedPattern + ")");
      throw new MessageException(
        Message.createMessage(false, Message.FILE_TYPE_NOT_ALLOWED, basename)
      );
    }
  }

  // SVG can contain scripts, so we always sanitize it. An SVG that can not be
  // sanitized is rejected
  private sanitizeSvg(contents: Buffer | string | null): string {
    const sanitizer = new Sanitizer();
    const clean = sanitizer.sanitize(contents === null ? "" : (typeof contents === "string" ? contents : contents.toString("utf8")));
    if (clean === false) {
      console.error("Flmngr: SVG upload rejected - sanitization failed.");
      throw new MessageException(
        Message.createMessage(false, Message.IMAGE_PROCESS_ERROR)
      );
    }
    return clean;
  }

  // If a file got .svg extension on rename, we sanitize it the same way as on
  // upload, or delete it if we can not. The caller makes sure this is a file
  private sanitizeSvgIfSvgFile(p: string): void {
    if (s(Utils.getExt(p)).toLowerCase() !== "svg") {
      return;
    }
    let clean: string;
    try {
      clean = this.sanitizeSvg(this.driverFiles.get(p));
    } catch (e) {
      this.driverFiles.delete(p); // do not leave unsanitized SVG
      throw e;
    }
    this.driverFiles.put(p, clean);
  }

  /**
   * Requests from controller
   */
  reqGetDirs(request: IFmRequest): FMDir[] {
    const hideDirsValue = isset(request.post["hideDirs"]) ? request.post["hideDirs"] : [];

    // It's allowed to send with first slash or without it (equivalent forms).
    // The same is for trailing slash
    let dirFrom = isset(request.post["fromDir"]) ? s(request.post["fromDir"]) : "";
    dirFrom = "/" + dirFrom.replace(/^\/+|\/+$/g, "");
    if (dirFrom === "/") {
      dirFrom = "";
    }
    if (dirFrom.indexOf("..") !== -1) {
      throw new MessageException(
        Message.createMessage(
          false,
          Message.FM_DIR_NAME_CONTAINS_INVALID_SYMBOLS
        )
      );
    }

    // 0 means get dirs from dirFrom only
    const maxDepth = isset(request.post["maxDepth"]) ? num(request.post["maxDepth"]) : 99;

    const dirs: FMDir[] = [];
    const hideDirs = list(hideDirsValue).slice();
    hideDirs.push(".cache");

    // Add root directory if it is ""
    let dirRoot = this.driverFiles.getRootDirName();
    const i = dirRoot.lastIndexOf("/");
    if (i !== -1) {
      dirRoot = dirRoot.substring(i + 1);
    }
    dirRoot += dirFrom;

    const addFilesPrefix = dirRoot === "";

    // A flat list of child directories
    const dirsStr = this.driverFiles.allDirectories(dirFrom, maxDepth);

    // Add files
    for (const dirStr of dirsStr) {
      const dirArr = dirStr.split("/");
      if (addFilesPrefix) {
        dirArr.unshift("Files");
      }
      const filled = dirArr.length <= maxDepth + 1;
      dirs.push(new FMDir(
        dirArr[dirArr.length - 1],
        dirArr.slice(0, dirArr.length - 1).join("/"),
        filled
      ));
    }

    return dirs;
  }

  // Legacy request for Flmngr v1.
  // Everything goes through the driver here
  async reqGetFiles(request: IFmRequest): Promise<FMFile[]> {
    let p = s(request.post["d"]);

    // with "/root_dir_name" in the start
    p = this.getRelativePath(p);

    // FlmngrServer passes the request value as is, so it can be a string
    const embedPreviews = this.embedPreviews === true ||
      this.embedPreviews === "true" ||
      this.embedPreviews === "1" ||
      (this.embedPreviews as any) === 1;

    const files: FMFile[] = [];
    for (const fFile of this.driverFiles.files(p)) {
      const name = fFile.name;

      // v1 client knows nothing about format suffixes, so the default ones are hidden here
      if (/-(preview|medium|original)\.[^.]+$/.test(name)) {
        continue;
      }

      const filePath = p + "/" + name;
      const isImage = Utils.isImage(name);

      let preview: string | null = null;
      if (embedPreviews && isImage) {
        // Reads the image once per file not cached yet
        try {
          const previewResult = await this.getCachedImagePreview(filePath, null);
          const contents = (previewResult[2] === false ? this.driverFiles : this.driverCache).get(previewResult[1]);
          preview = "data:" + previewResult[0] + ";base64," + (contents === null ? "" : contents.toString("base64"));
        } catch (e) {
          preview = null;
        }
      }

      // Width and height are known after the preview was created at least once,
      // the same way as in the paged listing
      let info: CachedImageInfo | null = isImage ? this.getCachedImageInfo(filePath) : null;
      if (info === null) {
        info = {size: fFile.size, mtime: fFile.mtime};
      }

      const file = new FMFile(p, name, info);
      if (preview !== null) {
        file.preview = preview;
      }
      files.push(file);
    }

    return files;
  }

  reqGetFilesPaged(request: IFmRequest): { files: FileStructure[]; countTotal: number; countFiltered: number; isEnd: boolean } {
    const dirPathValue = s(request.post["dir"]);
    const maxFiles: number | null = isset(request.post["maxFiles"]) ? num(request.post["maxFiles"]) : null;
    const alwaysInclude = isset(request.post["alwaysInclude"]) ? list(request.post["alwaysInclude"]).map(s) : []; // does not affect to filters, only for paged files
    const lastFile = isset(request.post["lastFile"]) ? request.post["lastFile"] : null;
    const lastIndex = isset(request.post["lastIndex"]) ? request.post["lastIndex"] : null;
    const whiteList = isset(request.post["whiteList"]) ? request.post["whiteList"] : [];
    const blackList = isset(request.post["blackList"]) ? request.post["blackList"] : [];
    const filter = isset(request.post["filter"]) ? s(request.post["filter"]) : "**";
    const orderBy = request.post["orderBy"];
    const orderAsc = request.post["orderAsc"];
    // The client sends no formats at all when the conf has no format except the
    // default one, so treat them as empty instead of failing on their count below
    const formatIds = isset(request.post["formatIds"]) ? list(request.post["formatIds"]).map(s) : [];
    const formatSuffixes = isset(request.post["formatSuffixes"]) ? request.post["formatSuffixes"] : [];

    // Convert /root_dir/1/2/3 to 1/2/3
    const dirPath = this.getRelativePath(dirPathValue);


    const files = new Map<string, (string | number)[]>(); // file name to sort values (like [filename, date, size])
    const formatFiles: { [formatId: string]: Map<string, string> } = {}; // format to array(owner file name to file name)
    for (const formatId of formatIds) {
      formatFiles[formatId] = new Map();
    }

    const fFiles = this.driverFiles.files(dirPath);
    const profile = new Profile("reqGetFilesPaged()");

    for (const file of fFiles) {

      let format: string | null = null;
      let name = Utils.getNameWithoutExt(file.name);
      if (Utils.isImage(file.name)) {
        for (let i = 0; i < formatIds.length; i++) {
          const suffix = s(at(formatSuffixes, i));
          const isFormatFile = Utils.endsWith(name, suffix);
          if (isFormatFile) {
            format = formatIds[i];
            name = name.substring(0, name.length - suffix.length);
            break;
          }
        }
      }

      const ext = Utils.getExt(file.name);
      if (ext != null && ext !== "") {
        name = name + "." + ext;
      }

      if (format == null || format === "") {
        switch (s(orderBy)) {
          case "date":
            files.set(file.name, [
              file.mtime,
              file.name,
              file.size,
            ]);
            break;
          case "size":
            files.set(file.name, [
              file.size,
              file.name,
              file.mtime,
            ]);
            break;
          case "name":
          default:
            files.set(file.name, [
              file.name,
              file.mtime,
              file.size,
            ]);
            break;
        }
      } else {
        formatFiles[format].set(name, file.name);
      }
    }
    profile.profile("Scan dir finished");

    // Remove files outside of white list, and their formats too
    if (list(whiteList).length > 0) { // only if whitelist is set
      for (const file of Array.from(files.keys())) {

        let isMatch = false;
        for (const mask of each(whiteList)) {
          if (fnmatch(s(mask), file, FNM_CASEFOLD) === true) {
            isMatch = true;
          }
        }

        if (!isMatch) {
          files.delete(file);
          // The resized copies of a removed file are not touched here: they are looked up by
          // the owners that remain, so a copy of a removed owner is never listed anyway
        }
      }
    }

    profile.profile("White list finished");

    // Remove files outside of black list, and their formats too
    for (const file of Array.from(files.keys())) {

      let isMatch = false;
      for (const mask of each(blackList)) {
        if (fnmatch(s(mask), file, FNM_CASEFOLD) === true) {
          isMatch = true;
        }
      }

      if (isMatch) {
        files.delete(file);
      }
    }

    const countTotal = files.size;

    profile.profile("Black list finished");

    // Remove files not matching the filter, and their formats too
    for (const file of Array.from(files.keys())) {

      const isMatch = fnmatch(filter, file) === true;
      if (!isMatch) {
        files.delete(file);
      }
    }

    const countFiltered = files.size;

    profile.profile("Filter finished");

    const sorted = Array.from(files.entries());
    sorted.sort((entry1, entry2) => {
      const arr1 = entry1[1];
      const arr2 = entry2[1];

      for (let i = 0; i < arr1.length; i++) {
        if (typeof arr1[i] === "string") {
          const v = strnatcmp(arr1[i] as string, arr2[i] as string);
          if (v !== 0) {
            return v;
          }
        } else {
          if (arr1[i] > arr2[i]) {
            return 1;
          }
          if (arr1[i] < arr2[i]) {
            return -1;
          }
        }
      }

      return 0;
    });

    let fileNames = sorted.map((entry) => entry[0]);

    if (s(orderAsc).toLowerCase() !== "true") {
      fileNames = fileNames.reverse();
    }

    profile.profile("Sorting finished");

    let startIndex = 0;
    if (truthy(lastIndex)) {
      startIndex = num(lastIndex) + 1;
    }
    if (truthy(lastFile)) { // lastFile priority is higher than lastIndex
      const i = fileNames.indexOf(s(lastFile));
      if (i !== -1) {
        startIndex = i + 1;
      }
    }

    const isEnd = startIndex + (maxFiles === null ? 0 : maxFiles) >= fileNames.length; // are there any files after current page?

    // fileNames = array_slice(fileNames, startIndex, maxFiles);
    // Do the same, but respecting "alwaysInclude":
    if (startIndex > 0 || (maxFiles === null ? fileNames.length > 0 : maxFiles < fileNames.length)) {
      for (let i = alwaysInclude.length - 1; i >= 0; i--) {
        const index = fileNames.indexOf(alwaysInclude[i]);
        if (index === -1) {
          // Remove unexisting items from "alwaysInclude"
          alwaysInclude.splice(i, 1);
        } else {
          // And existing items from "fileNames"
          fileNames.splice(index, 1);
        }
      }
      // Get a page
      fileNames = arraySlice(fileNames, startIndex, maxFiles);
      // Add to the start of the page all "alwaysInclude" files
      for (let i = alwaysInclude.length - 1; i >= 0; i--) {
        fileNames.unshift(alwaysInclude[i]);
      }
    }

    profile.profile("Page slice finished");

    const resultFiles: FileStructure[] = [];

    // Create result file list for output,
    // attach image attributes and image formats for image files.
    for (const fileName of fileNames) {

      const resultFile = this.getFileStructure(dirPath, fileName);

      // Find formats of these files
      for (const formatId of formatIds) {
        const formatFileName = formatFiles[formatId].get(fileName);
        if (formatFileName !== undefined) {

          const formatFile = this.getFileStructure(dirPath, formatFileName);
          if (resultFile.formats === undefined || Array.isArray(resultFile.formats)) {
            resultFile.formats = {};
          }
          (resultFile.formats as { [formatId: string]: FileStructure })[formatId] = formatFile;
        }
      }

      resultFiles.push(resultFile);
    }

    profile.profile("Create output list finished");
    profile.total();

    return {
      files: resultFiles,
      countTotal: countTotal,
      countFiltered: countFiltered,
      isEnd: isEnd,
    };
  }

  getFileStructure(dirPath: string, fileName: string): FileStructure {
    const cachedImageInfo = this.getCachedImageInfo(dirPath + "/" + fileName);
    const resultFile: FileStructure = {
      name: "" + fileName,
      size: cachedImageInfo != null && cachedImageInfo.size !== undefined ? cachedImageInfo.size : null,
      timestamp: cachedImageInfo != null && cachedImageInfo.mtime !== undefined ? cachedImageInfo.mtime : null,
    };

    if (Utils.isImage(fileName)) {

      resultFile.width = cachedImageInfo != null && cachedImageInfo.width != null ? cachedImageInfo.width : null;
      resultFile.height = cachedImageInfo != null && cachedImageInfo.height != null ? cachedImageInfo.height : null;
      resultFile.blurHash = cachedImageInfo != null && cachedImageInfo.blurHash != null ? cachedImageInfo.blurHash : null;
      // an empty list until a format is found
      resultFile.formats = [];
    }

    return resultFile;
  }

  async reqGetImagePreview(request: IFmRequest): Promise<[string, fs.ReadStream, boolean]> {
    let filePath = isset(request.get["f"]) ? s(request.get["f"]) : s(request.post["f"]);
    //const width = isset(request.get["width"]) ? request.get["width"] :
    //  (isset(request.post["width"]) ? request.post["width"] : null);
    //const height = isset(request.get["height"]) ? request.get["height"] :
    //  (isset(request.post["height"]) ? request.post["height"] : null);

    filePath = this.getRelativePath(filePath);
    const result = await this.getCachedImagePreview(filePath, null);

    // Convert path to contents
    const stream = (result[2] === false ? this.driverFiles : this.driverCache).readStream(result[1]);
    return [result[0], stream, result[2]];
  }

  async reqGetImagePreviewAndResolution(request: IFmRequest): Promise<{ width: number | null; height: number | null; preview: string | null }> {

    let filePath = isset(request.get["f"]) ? s(request.get["f"]) : s(request.post["f"]);
    // The size the client asks for is not used: the preview has one fixed size
    //const width = isset(request.get["width"]) ? request.get["width"] :
    //  (isset(request.post["width"]) ? request.post["width"] : null);
    //const height = isset(request.get["height"]) ? request.get["height"] :
    //  (isset(request.post["height"]) ? request.post["height"] : null);

    filePath = this.getRelativePath(filePath);
    const previewAndResolution = await this.getCachedImagePreviewAndResolution(filePath, null);

    const preview = previewAndResolution[0];
    let dataUri: string | null = null;
    if (preview != null) {
      const contents = (preview[2] === false ? this.driverFiles : this.driverCache).get(preview[1]);
      dataUri = "data:" + preview[0] + ";base64," + (contents === null ? "" : contents.toString("base64"));
    }

    return {
      width: previewAndResolution[1],
      height: previewAndResolution[2],
      preview: dataUri,
    };
  }

  reqCopyDir(request: IFmRequest): void {
    let dirPath = s(request.post["d"]); // full path
    let newPath = s(request.post["n"]); // full path

    dirPath = this.getRelativePath(dirPath);
    newPath = this.getRelativePath(newPath);

    this.driverFiles.copyDirectory(dirPath, newPath);
  }

  reqCopyFiles(request: IFmRequest): void {
    const files = s(request.post["fs"]);
    let newPath = s(request.post["n"]);
    const formatSuffixes = this.readFormatSuffixes(request);

    const filesPaths = files.split("|");
    for (let i = 0; i < filesPaths.length; i++) {
      filesPaths[i] = this.getRelativePath(filesPaths[i]);
    }
    newPath = rtrimSlashes(this.getRelativePath(newPath));

    for (let i = 0; i < filesPaths.length; i++) {
      const formats = this.formatFilePaths(filesPaths[i], formatSuffixes);
      this.driverFiles.copyFile(filesPaths[i], newPath + "/" + path.posix.basename(filesPaths[i]));
      this.copyFormats(formats, newPath);
    }
  }

  getCachedFile(filePath: string): CachedFile {
    return new CachedFile(
      filePath,
      this.driverFiles,
      this.driverCache
    );
  }

  private PREVIEW_WIDTH = 159;

  private PREVIEW_HEIGHT = 139;

  getCachedImageInfo(filePath: string): CachedImageInfo | null {
    const profile = new Profile("getCachedImageInfo()");
    const result = this.getCachedFile(filePath).getInfo();
    profile.total();
    return result;
  }

  async getCachedImagePreview(filePath: string, contents: Buffer | null): Promise<PreviewResult> {
    const profile = new Profile("getCachedImagePreview()");
    const result = await this.getCachedFile(filePath)
      .getPreview(this.PREVIEW_WIDTH, this.PREVIEW_HEIGHT, contents, this.doUpscalePreviews);
    profile.total();
    return result;
  }

  async getCachedImagePreviewAndResolution(filePath: string, contents: Buffer | null): Promise<[PreviewResult, number | null, number | null]> {

    const profile = new Profile("getCachedImagePreviewAndResolution()");

    const cachedFile = this.getCachedFile(filePath);

    const preview = await cachedFile.getPreview(this.PREVIEW_WIDTH, this.PREVIEW_HEIGHT, contents, this.doUpscalePreviews);
    const info = cachedFile.getInfo();

    const result: [PreviewResult, number | null, number | null] = [
      preview,
      info != null && info.width != null ? info.width : null,
      info != null && info.height != null ? info.height : null,
    ];
    profile.total();
    return result;
  }

  reqCreateDir(request: IFmRequest): void {
    let dirPath = s(request.post["d"]);
    const name = isset(request.post["n"]) ? s(request.post["n"]) : null;

    dirPath = this.getRelativePath(dirPath);

    if (name === "") {
      throw new MessageException(
        Message.createMessage(
          false,
          Message.MALFORMED_REQUEST
        )
      );
    }

    const n = name === null ? "" : name;
    if (
      n.indexOf("/") !== -1 ||
      n.indexOf("\\") !== -1 ||
      n.indexOf("..") !== -1 ||
      n.indexOf("\0") !== -1
    ) {
      throw new MessageException(
        Message.createMessage(
          false,
          Message.FM_DIR_NAME_CONTAINS_INVALID_SYMBOLS
        )
      );
    }
    this.driverFiles.makeDirectory(dirPath + "/" + n);
  }

  reqDeleteDir(request: IFmRequest): void {
    let dirPath = s(request.post["d"]);

    dirPath = this.getRelativePath(dirPath);

    this.driverFiles.delete(dirPath);
  }

  reqMove(request: IFmRequest): void {
    let p = s(request.post["d"]);
    let newPath = s(request.post["n"]); // path without name

    p = this.getRelativePath(p);
    newPath = this.getRelativePath(newPath);

    this.driverFiles.move(p, newPath + "/" + path.posix.basename(p));
  }

  reqRename(request: IFmRequest): void {
    let p = isset(request.post["d"]) ? s(request.post["d"]) : s(request.post["f"]);
    const newName = s(request.post["n"]); // name without path

    if (newName.indexOf("/") !== -1) {
      throw new MessageException(
        Message.createMessage(
          false,
          Message.FM_DIR_NAME_CONTAINS_INVALID_SYMBOLS
        )
      );
    }

    this.assertFileNameAllowed(newName);

    p = this.getRelativePath(p);

    // File or dir, and which resized copies it has - both asked before the move,
    // see formatFilePaths() on why
    const isFile = this.driverFiles.fileExists(p);
    const formats = isFile ? this.formatFilePaths(p, this.readFormatSuffixes(request)) : [];

    const target = rtrimSlashes(path.posix.dirname(p)) + "/" + newName;
    this.driverFiles.move(p, target);

    if (isFile) {
      const isExtChanged = s(Utils.getExt(p)).toLowerCase() !== s(Utils.getExt(newName)).toLowerCase();
      this.renameFormats(formats, newName, isExtChanged);
      this.getCachedFile(p).delete();

      // The file could get .svg extension just now, then we need to sanitize it
      this.sanitizeSvgIfSvgFile(target);
    }
  }

  reqMoveFiles(request: IFmRequest): void {
    const filesPaths = s(request.post["fs"]).split("|"); // array of file paths
    let newPath = s(request.post["n"]); // dir without filename
    const formatSuffixes = this.readFormatSuffixes(request);

    for (let i = 0; i < filesPaths.length; i++) {
      filesPaths[i] = this.getRelativePath(filesPaths[i]);
    }
    newPath = this.getRelativePath(newPath);

    for (let i = 0; i < filesPaths.length; i++) {
      const filePath = filesPaths[i];
      const formats = this.formatFilePaths(filePath, formatSuffixes);
      const index = filePath.lastIndexOf("/");
      const name = index === -1 ? filePath : filePath.substring(index + 1);
      this.driverFiles.move(filePath, newPath + "/" + name);
      this.getCachedFile(filePath).delete();
      this.moveFormats(formats, newPath);
    }
  }

  // "formatSuffixes" is optional in every request: the client sends nothing
  // when the only image format is the default one
  private readFormatSuffixes(request: IFmRequest): PhpValue[] {
    const value = request.post["formatSuffixes"];
    if (!isset(value) || typeof value === "string") {
      return [];
    }
    return each(value);
  }

  // A suffix comes from the client and gets glued into a file path,
  // so only a plain name ending is accepted
  private isFormatSuffixSafe(suffix: PhpValue): boolean {
    return typeof suffix === "string" &&
      suffix !== "" &&
      suffix.indexOf("/") === -1 &&
      suffix.indexOf("\\") === -1 &&
      suffix.indexOf("..") === -1 &&
      suffix.indexOf("\0") === -1;
  }

  // Resized copies of a file that exist: "photo.jpg" -> "photo-preview.jpg", etc.
  // A copy keeps its own extension (png/jpg/webp), the original can have any.
  //
  // Call it BEFORE moving or deleting the file, so the answer does not depend on
  // what the storage reports right after a change
  private formatFilePaths(filePath: string, formatSuffixes: PhpValue[]): FormatFile[] {
    let dir = rtrimSlashes(path.posix.dirname(filePath));
    if (dir === ".") {
      dir = "";
    }
    const base = Utils.getNameWithoutExt(path.posix.basename(filePath));

    const formats: FormatFile[] = [];
    for (const suffix of formatSuffixes) {
      if (!this.isFormatSuffixSafe(suffix)) {
        continue;
      }
      for (const ext of ["png", "jpg", "jpeg", "webp"]) {
        const formatPath = dir + "/" + base + (suffix as string) + "." + ext;
        if (this.driverFiles.fileExists(formatPath)) {
          formats.push({
            path: formatPath,
            dir: dir,
            suffix: suffix as string,
            ext: ext,
          });
        }
      }
    }
    return formats;
  }

  // The resized copies follow the file they were made from.
  // These run after the file itself is already processed, so a failure is only
  // logged: a copy is generated again on demand, and the user's action
  // must not look failed because of it
  private renameFormats(formats: FormatFile[], newName: string, isExtChanged: boolean): void {
    const newBase = Utils.getNameWithoutExt(newName);
    for (const format of formats) {
      try {
        if (isExtChanged) {
          // "photo-preview.png" is not a copy of "photo.jpg", the listing
          // would not group them anymore, so it goes away
          this.driverFiles.delete(format.path);
        } else {
          this.driverFiles.move(
            format.path,
            format.dir + "/" + newBase + format.suffix + "." + format.ext
          );
        }
        this.getCachedFile(format.path).delete();
      } catch (e) {
        console.error("Flmngr: unable to rename " + format.path + ": " + (e as Error).message);
      }
    }
  }

  private moveFormats(formats: FormatFile[], newDir: string): void {
    for (const format of formats) {
      try {
        this.driverFiles.move(format.path, newDir + "/" + path.posix.basename(format.path));
        this.getCachedFile(format.path).delete();
      } catch (e) {
        console.error("Flmngr: unable to move " + format.path + ": " + (e as Error).message);
      }
    }
  }

  private copyFormats(formats: FormatFile[], newDir: string): void {
    for (const format of formats) {
      try {
        this.driverFiles.copyFile(format.path, newDir + "/" + path.posix.basename(format.path));
      } catch (e) {
        console.error("Flmngr: unable to copy " + format.path + ": " + (e as Error).message);
      }
    }
  }

  private deleteFormats(formats: FormatFile[]): void {
    for (const format of formats) {
      this.driverFiles.delete(format.path);
      this.getCachedFile(format.path).delete();
    }
  }

  protected deleteFormatsAndClearCachePreviewForFile(filePath: string, formatSuffixes: PhpValue[]): void {
    this.getCachedFile(filePath).delete();
    this.deleteFormats(this.formatFilePaths(filePath, formatSuffixes));
  }

  protected async updateFormatsAndClearCachePreviewForFile(filePath: string, formatSuffixes: PhpValue[], formatMaxWidths: PhpValue | undefined, formatMaxHeights: PhpValue | undefined, contents: Buffer | null): Promise<void> {

    let fileNameWithoutExt = filePath;
    const indexSlash = fileNameWithoutExt.lastIndexOf("/");
    if (indexSlash !== -1) {
      fileNameWithoutExt = fileNameWithoutExt.substring(indexSlash + 1);
    }
    const indexDot = fileNameWithoutExt.lastIndexOf(".");
    if (indexDot !== -1) {
      fileNameWithoutExt = fileNameWithoutExt.substring(0, indexDot);
    }

    for (let j = 0; j < formatSuffixes.length; j++) {
      try {
        await this.resizeFile2Impl(
          filePath,
          fileNameWithoutExt + s(formatSuffixes[j]),
          at(formatMaxWidths, j),
          at(formatMaxHeights, j),
          "IF_EXISTS"
        );
      } catch (e) {
        // Supressing FM_NOT_ERROR_NOT_NEEDED_TO_UPDATE not-a-error
      }
    }
    const cachedFile = this.getCachedFile(filePath);
    cachedFile.delete();

    if (Utils.isImage(filePath)) {
      await this.getCachedImagePreview(filePath, contents);
    }
  }

  // "formatSuffixes" is an optional parameter (not sent by Flmngr UI v1)
  reqDeleteFiles(request: IFmRequest): void {
    const filesPaths = s(request.post["fs"]).split("|");
    const formatSuffixes = this.readFormatSuffixes(request);

    for (let i = 0; i < filesPaths.length; i++) {
      filesPaths[i] = this.getRelativePath(filesPaths[i]);
    }

    for (const filePath of filesPaths) {
      const formats = this.formatFilePaths(filePath, formatSuffixes);
      this.driverFiles.delete(filePath);
      this.getCachedFile(filePath).delete();
      this.deleteFormats(formats);
    }
  }

  // files are like: "file.jpg" or "dir/file.png" - they start not with "/root_dir/"
  // This is because we need to validate files before dir tree is loaded on a client
  reqGetFilesSpecified(request: IFmRequest): { dir: string; file: FileStructure }[] {
    const files = list(request.post["files"]);

    const result: { dir: string; file: FileStructure }[] = [];
    for (let i = 0; i < files.length; i++) {

      const file = "/" + s(files[i]);

      if (file.indexOf("..") !== -1) {
        throw new MessageException(
          Message.createMessage(
            false,
            Message.FM_DIR_NAME_CONTAINS_INVALID_SYMBOLS
          )
        );
      }

      if (this.driverFiles.fileExists(file)) {

        result.push({
          dir: path.posix.dirname(file),
          file: this.getFileStructure(path.posix.dirname(file), path.posix.basename(file)),
        });
      }

    }
    return result;
  }

  // Legacy request used in V1 client only
  async reqResizeFile(request: IFmRequest): Promise<string> {
    return (await this.reqResizeFile2(request)).url;
  }

  // mode:
  // "ALWAYS"
  // To recreate image preview in any case (even it is already generated before)
  // Used when user uploads a new image and needs to get its preview

  // "DO_NOT_UPDATE"
  // To create image only if it does not exist, if exists - its path will be returned
  // Used when user selects existing image in file manager and needs its preview

  // "IF_EXISTS"
  // To recreate preview if it already exists
  // Used when file was reuploaded, edited and we recreate previews for all formats we do not need right now, but used somewhere else

  // File uploaded / saved in image editor and reuploaded: mode is "ALWAYS" for required formats, "IF_EXISTS" for the others
  // User selected image in file manager:                  mode is "DO_NOT_UPDATE" for required formats and there is no requests for the otheres
  async reqResizeFile2(request: IFmRequest): Promise<{ url: string; width: number | null; height: number | null }> {
    // filePath here starts with "/", not with "/root_dir" as usual
    // so there will be no getRelativePath call
    let filePath = s(request.post["f"]);
    const newFileNameWithoutExt = s(request.post["n"]);
    const width = request.post["mw"];
    const height = request.post["mh"];
    const mode = request.post["mode"];

    if (filePath.indexOf("..") !== -1) {
      throw new MessageException(
        Message.createMessage(
          false,
          Message.FM_DIR_NAME_CONTAINS_INVALID_SYMBOLS
        )
      );
    }

    // Root-relative, so the same leading slash rule as in getRelativePath(): without it
    // the path would be glued straight onto the root directory name
    if (filePath.indexOf("/") !== 0) {
      filePath = "/" + filePath;
    }

    return this.resizeFile2Impl(
      filePath,
      newFileNameWithoutExt,
      width,
      height,
      mode
    );
  }

  async resizeFile2Impl(
    filePath: string,
    newFileNameWithoutExt: string,
    widthValue: PhpValue | undefined | null,
    heightValue: PhpValue | undefined | null,
    mode: PhpValue | undefined | null
  ): Promise<{ url: string; width: number | null; height: number | null }> {

    if (
      newFileNameWithoutExt.indexOf("..") !== -1 ||
      newFileNameWithoutExt.indexOf("/") !== -1 ||
      newFileNameWithoutExt.indexOf("\\") !== -1
    ) {
      throw new MessageException(
        Message.createMessage(
          false,
          Message.FM_DIR_NAME_CONTAINS_INVALID_SYMBOLS
        )
      );
    }

    const index = filePath.lastIndexOf("/");
    const oldFileNameWithExt = filePath.substring(index + 1);
    let newExt = "png";
    const oldExt = s(Utils.getExt(filePath)).toLowerCase();
    if (oldExt === "svg") {
      return {
        url: filePath,
        width: -1,
        height: -1
      };
    }
    if (oldExt === "jpg" || oldExt === "jpeg") {
      newExt = "jpg";
    }
    if (oldExt === "webp") {
      newExt = "webp";
    }
    let dstPath =
      filePath.substring(0, index === -1 ? 0 : index) +
      "/" +
      newFileNameWithoutExt +
      "." +
      newExt;

    if (
      Utils.getNameWithoutExt(dstPath) ===
      Utils.getNameWithoutExt(filePath)
    ) {
      // This is `default` format request - we need to process the image itself without changing its extension
      dstPath = filePath;
    }

    const isDstPathExists = this.driverFiles.fileExists(dstPath);
    if (mode === "IF_EXISTS" && !isDstPathExists) {
      throw new MessageException(
        Message.createMessage(
          false,
          Message.FM_NOT_ERROR_NOT_NEEDED_TO_UPDATE
        )
      );
    }

    if (mode === "DO_NOT_UPDATE" && isDstPathExists) {

      // TODO: a preview is not needed, only a resolution
      const info = await this.getCachedImagePreviewAndResolution(
        dstPath,
        this.driverFiles.get(dstPath)
      );
      return {
        url: dstPath,
        width: info[1],
        height: info[2]
      };
    }

    const contents = this.driverFiles.get(filePath);
    let image = await Gd.createFromString(contents);

    if (!image) {
      throw new MessageException(
        Message.createMessage(
          false,
          Message.IMAGE_PROCESS_ERROR
        )
      );
    }

    const orientation = await this.driverFiles.getExifOrientation(filePath);
    if (orientation === 3) {
      image = await Gd.rotate(image, 180);
    } else if (orientation === 6) {
      image = await Gd.rotate(image, -90);
    } else if (orientation === 8) {
      image = await Gd.rotate(image, 90);
    }

    await this.getCachedImagePreview(filePath, contents); // to force writing image/width into cache file
    const imageInfo = this.getCachedImageInfo(filePath);

    const originalWidth = imageInfo != null && imageInfo.width != null ? imageInfo.width : 0;
    const originalHeight = imageInfo != null && imageInfo.height != null ? imageInfo.height : 0;

    let width = widthValue === undefined || widthValue === null ? null : num(widthValue);
    let height = heightValue === undefined || heightValue === null ? null : num(heightValue);

    let needToFitWidth = width !== null && originalWidth > width && width > 0;
    let needToFitHeight = height !== null && originalHeight > height && height > 0;
    if (needToFitWidth && needToFitHeight) {
      if ((width as number) / originalWidth < (height as number) / originalHeight) {
        needToFitHeight = false;
      } else {
        needToFitWidth = false;
      }
    }

    if (!needToFitWidth && !needToFitHeight) {
      // if we generated the preview in past, we need to update it in any case
      if (
        !isDstPathExists ||
        newFileNameWithoutExt + "." + oldExt === oldFileNameWithExt
      ) {
        // return old file due to it has correct width/height to be used as a preview

        // TODO: a preview is not needed, only a resolution
        const info = await this.getCachedImagePreviewAndResolution(
          filePath,
          this.driverFiles.get(filePath)
        );
        return {
          url: filePath,
          width: info[1],
          height: info[2]
        };
      } else {
        width = originalWidth;
        height = originalHeight;
      }
    }

    if (needToFitWidth) {
      const ratio = (width as number) / originalWidth;
      height = Math.max(1, Math.floor(originalHeight * ratio));
    } else if (needToFitHeight) {
      const ratio = (height as number) / originalHeight;
      width = Math.max(1, Math.floor(originalWidth * ratio));
    }

    // Only PNG, JPEG and WebP can be written back. A GIF or BMP resized as its own
    // "default" format (the destination is the file itself) is left as it is and
    // reported with its real size: there is no encoder for it, and writing the
    // empty result would replace the file with nothing
    const dstExt = s(Utils.getExt(dstPath)).toLowerCase();
    if (dstExt !== "png" && dstExt !== "jpg" && dstExt !== "jpeg" && dstExt !== "webp") {
      return {
        url: filePath,
        width: Math.trunc(originalWidth),
        height: Math.trunc(originalHeight)
      };
    }

    const resizedImage = await Gd.copyResampled(
      Gd.createTrueColor(Math.trunc(width as number), Math.trunc(height as number)),
      image,
      false
    );

    const ext = dstExt;
    let stringData: Buffer;
    if (ext === "png") {
      stringData = await Gd.encode(resizedImage, "png", null, true);
    } else if (ext === "jpg" || ext === "jpeg") {
      stringData = await Gd.encode(resizedImage, "jpg");
    } else {
      stringData = await Gd.encode(resizedImage, "webp");
    }
    this.driverFiles.put(dstPath, stringData);

    return {
      url: dstPath,
      width: Math.trunc(width as number),
      height: Math.trunc(height as number)
    };
  }

  reqGetImageOriginal(request: IFmRequest): [string, fs.ReadStream] {
    let filePath = isset(request.get["f"]) ? s(request.get["f"]) : s(request.post["f"]);

    filePath = this.getRelativePath(filePath);

    const mimeType = Utils.getMimeType(filePath);
    if (mimeType == null) {
      throw new MessageException(
        Message.createMessage(
          false,
          Message.FM_FILE_IS_NOT_IMAGE
        )
      );
    }

    const stream = this.driverFiles.readStream(filePath);

    return [mimeType, stream];
  }

  reqGetVersion(request: IFmRequest, framework?: string): { [key: string]: string } {
    return {
      version: "6",
      build: "16",
      language: "node",
      framework: framework === undefined ? "custom" : framework,
      storage: this.driverFiles.getDriverName(),
      dirFiles: this.driverFiles.getDir(),
      dirCache: this.driverCache.getDir(),
    };
  }

  async reqUpload(request: IFmRequest): Promise<{ file: FileStructure }> {

    let dir = isset(request.post["dir"]) ? s(request.post["dir"]) : "/";
    dir = this.getRelativePath("/" + this.driverFiles.getRootDirName() + dir);

    const isOverwrite = isset(request.post["mode"]) && request.post["mode"] === "OVERWRITE";

    if (request.files["file"] === undefined || request.files["file"] === null) {
      throw new MessageException(
        Message.createMessage(
          false,
          Message.FILES_NOT_SET
        )
      );
    }

    const file = request.files["file"];

    this.assertFileNameAllowed(file.name);

    let contents: Buffer | null;
    try {
      contents = fs.readFileSync(file.tmp_name);
    } catch (e) {
      contents = null;
    }

    if (s(Utils.getExt(file.name)).toLowerCase() === "svg") {
      contents = Buffer.from(this.sanitizeSvg(contents), "utf8");
      try {
        fs.writeFileSync(file.tmp_name, contents);
      } catch (e) {
        throw new MessageException(
          Message.createMessage(false, Message.WRITING_FILE_ERROR, file.name)
        );
      }
    }

    const name = this.driverFiles.uploadFile(file, dir, isOverwrite);

    const formatSuffixes = this.readFormatSuffixes(request);

    if (isset(request.post["formatMaxWidths"]) && isset(request.post["formatMaxHeights"])) {
      // New corrected behavior since version 6, build 13
      const formatMaxWidths = request.post["formatMaxWidths"];
      const formatMaxHeights = request.post["formatMaxHeights"];
      await this.updateFormatsAndClearCachePreviewForFile(dir + "/" + name, formatSuffixes, formatMaxWidths, formatMaxHeights, contents);
    } else {
      // Old behavior till version 6, build 12
      this.deleteFormatsAndClearCachePreviewForFile(dir + "/" + name, formatSuffixes);
    }

    const resultFile = this.getFileStructure(dir, name);

    return {
      file: resultFile,
    };
  }

}
