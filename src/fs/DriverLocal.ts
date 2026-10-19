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
import {MessageException} from "../lib/MessageException.js";
import {UploadedFile} from "../lib/IFmRequest.js";
import {fnmatch} from "../lib/php/fnmatch.js";
import {Gd} from "../lib/image/Gd.js";

export interface DriverLocalConfig {
  dir?: string | null;
  dirPermissions?: number | null;
}

// One entry of files(): name, modification time in seconds, size in bytes
export interface DriverFile {
  name: string;
  mtime: number;
  size: number;
}

// Entries of a directory the way glob("dir/*") lists them: no dot entries, byte order
function listEntries(dir: string): string[] {
  const names = fs.readdirSync(dir).filter((name) => !name.startsWith("."));
  names.sort((a, b) => Buffer.compare(Buffer.from(a, "utf8"), Buffer.from(b, "utf8")));
  return names;
}

function statOrNull(p: string): fs.Stats | null {
  try {
    return fs.statSync(p);
  } catch (e) {
    return null;
  }
}

function sleep(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

export class DriverLocal {

  private dir: string;

  private isCacheDriver: boolean;

  private dirPermissions: number;

  // Link to cache driver
  // null if we are inside cache driver instance
  protected driverCache: DriverLocal | null = null;

  // For use by FileSystem only, do not override
  setDriverCache(driverCache: DriverLocal): void {
    this.driverCache = driverCache;
  }

  constructor(config: DriverLocalConfig, isCacheDriver: boolean = false) {
    this.isCacheDriver = isCacheDriver;

    if (config.dir === undefined || config.dir === null) {
      console.error(new MessageException(
        Message.createMessage(
          this.isCacheDriver,
          Message.FM_ROOT_DIR_IS_NOT_SET
        )
      ));
    }

    this.dir = ("" + (config.dir == null ? "" : config.dir)).replace(/[\\/]+$/, "");

    // Mode for directories we create, 0755 by default (older versions used 0777).
    // Can be set back with 'dirPermissions' option if some shared hosting needs it
    this.dirPermissions = (config.dirPermissions !== undefined && config.dirPermissions !== null)
      ? config.dirPermissions : 0o755;

    this.makeRootDir();

    try {
      fs.accessSync(this.dir, fs.constants.R_OK);
    } catch (e) {
      throw new MessageException(
        Message.createMessage(
          this.isCacheDriver,
          Message.FM_DIR_IS_NOT_READABLE,
          this.dir
        )
      );
    }

    try {
      fs.accessSync(this.dir, fs.constants.W_OK);
    } catch (e) {
      throw new MessageException(
        Message.createMessage(
          this.isCacheDriver,
          Message.FM_DIR_IS_NOT_WRITABLE,
          this.dir
        )
      );
    }

  }

  getDriverName(): string {
    return "Local";
  }

  getDir(): string {
    return this.dir;
  }

  size(p: string): number {
    return fs.statSync(this.dir + p).size;
  }

  lastModified(p: string): number {
    let time = Math.floor(fs.statSync(this.dir + p).mtimeMs / 1000);
    // Some platforms have time*1000
    if (time > 2147483647) {
      time = Math.trunc(time / 1000);
    }
    return time;
  }

  makeDirectory(p: string): void {

    const st = statOrNull(this.dir + p);
    if (st !== null && st.isDirectory()) {
      return;
    }

    // In some environments we have race conditions when handling multiple requests
    // so we wait a little if required to get a dir created by another thread or create it ourselves
    if (!this.mkdir(this.dir + p)) {
      sleep(200);

      if (!this.mkdir(this.dir + p)) {
        throw new MessageException(
          Message.createMessage(
            this.isCacheDriver,
            Message.FM_UNABLE_TO_CREATE_DIRECTORY,
            p
          )
        );
      }
    }
  }

  private mkdir(fullPath: string): boolean {
    const st = statOrNull(fullPath);
    if (st !== null && st.isDirectory()) {
      return true;
    }
    try {
      fs.mkdirSync(fullPath, {recursive: true, mode: this.dirPermissions});
      return true;
    } catch (e) {
      return false;
    }
  }

  getRootDirName(): string {
    const i = this.dir.lastIndexOf("/");
    if (i === -1) {
      return this.dir;
    }
    return this.dir.substring(i + 1);
  }

  makeRootDir(): void {
    if (!this.directoryExists("")) {
      this.makeDirectory("");
    }
  }

  static readonly MAX_DEPTH = 20;

  allDirectories(dirFrom: string, maxDepth: number): string[] {
    const dirs: string[] = [];
    const fDir = this.dir + dirFrom;

    const st = statOrNull(fDir);
    if (st === null || !st.isDirectory()) {
      console.error("Root directory does not exist: " + fDir);
      throw new MessageException(
        Message.createMessage(
          this.isCacheDriver,
          Message.FM_ROOT_DIR_DOES_NOT_EXIST
        )
      );
    }
    const hideDirs = [".cache"];

    let p = "";
    if (dirFrom != "") {
      p = (path.posix.basename(this.dir) + "/" + path.posix.dirname(dirFrom).replace(/\/+$/, "")).replace(/\/+$/, "");
    }
    this.getDirs__fill(dirs, fDir, hideDirs, p, 0, maxDepth);

    return dirs;
  }

  private getDirs__fill(dirs: string[], fDir: string, hideDirs: string[], p: string, currDepth: number, maxDepth: number): void {
    const i = fDir.lastIndexOf("/");
    let dirName: string;
    if (i !== -1) {
      dirName = fDir.substring(i + 1);
    } else {
      dirName = fDir;
    }

    dirs.push((p.length > 0 ? "/" + p : "") + "/" + dirName);

    let rawDirs: string[];
    try {
      rawDirs = listEntries(fDir).filter((name) => {
        const st = statOrNull(fDir + "/" + name);
        return st !== null && st.isDirectory();
      });
    } catch (e) {
      throw new MessageException(
        Message.createMessage(
          this.isCacheDriver,
          Message.FM_UNABLE_TO_LIST_CHILDREN_IN_DIRECTORY,
          p
        )
      );
    }

    for (const dir of rawDirs) {

      let isHide = false;
      for (let j = 0; j < hideDirs.length && !isHide; j++) {
        isHide = isHide || fnmatch(hideDirs[j], dir);
      }

      if (!isHide && currDepth < Math.min(Number(maxDepth), DriverLocal.MAX_DEPTH)) {
        this.getDirs__fill(
          dirs,
          fDir + "/" + dir,
          hideDirs,
          p + (p.length > 0 ? "/" : "") + dirName,
          currDepth + 1,
          maxDepth
        );
      }
    }
  }

  directories(p: string): string[] {
    const dirs: string[] = [];
    let rawDirs: string[];
    try {
      rawDirs = this.listOrEmpty(this.dir + p).filter((name) => {
        const st = statOrNull(this.dir + p + "/" + name);
        return st !== null && st.isDirectory();
      });
    } catch (e) {
      throw new MessageException(
        Message.createMessage(
          this.isCacheDriver,
          Message.FM_UNABLE_TO_LIST_CHILDREN_IN_DIRECTORY,
          p
        ),
        e
      );
    }
    for (const dir of rawDirs) {
      dirs.push(dir);
    }
    return dirs;
  }

  files(p: string): DriverFile[] {
    let rawFiles: string[];
    try {
      rawFiles = this.listOrEmpty(this.dir + p);
    } catch (e) {
      console.error("Error while reading dir contents: " + p);
      console.error(e);
      throw new MessageException(
        Message.createMessage(
          this.isCacheDriver,
          Message.FM_UNABLE_TO_LIST_CHILDREN_IN_DIRECTORY,
          p
        ),
        e
      );
    }

    const files: DriverFile[] = [];
    for (const filename of rawFiles) {
      const st = statOrNull(this.dir + p + "/" + filename);
      if (st !== null && st.isFile()) {
        files.push({
          name: filename,
          mtime: this.lastModified(p + "/" + filename),
          size: this.size(p + "/" + filename),
        });
      }
    }
    return files;
  }

  // glob() answers an empty list for a directory that is not there
  private listOrEmpty(dir: string): string[] {
    const st = statOrNull(dir);
    if (st === null || !st.isDirectory()) {
      return [];
    }
    return listEntries(dir);
  }

  move(p: string, newName: string): void {
    try {
      fs.renameSync(this.dir + p, this.dir + newName);
    } catch (e: any) {
      // rename() copies a file over to another file system; a directory can not be moved that way
      if (e && e.code === "EXDEV" && this.fileExists(p)) {
        try {
          fs.copyFileSync(this.dir + p, this.dir + newName);
          fs.unlinkSync(this.dir + p);
          return;
        } catch (e2) {
          e = e2;
        }
      }
      throw new MessageException(
        Message.createMessage(
          this.isCacheDriver,
          Message.FM_UNABLE_TO_RENAME
        ),
        e
      );
    }
  }

  getMimeType(p: string): string | null {
    return Utils.getMimeType(this.dir + p);
  }

  exists(p: string): boolean {
    return statOrNull(this.dir + p) !== null;
  }

  directoryExists(p: string): boolean {
    const st = statOrNull(this.dir + p);
    return st !== null && st.isDirectory();
  }

  fileExists(p: string): boolean {
    const st = statOrNull(this.dir + p);
    return st !== null && st.isFile();
  }

  // Get file contents, null when the file can not be read
  get(p: string): Buffer | null {
    try {
      return fs.readFileSync(this.dir + p);
    } catch (e) {
      return null;
    }
  }

  async getExifOrientation(p: string): Promise<number> {
    return Gd.exifOrientation(this.get(p));
  }

  // Put file contents
  put(p: string, contents: Buffer | string): void {
    this.makeDirectory(path.posix.dirname(p)); // ensure dir exists
    fs.writeFileSync(this.dir + p, contents);
  }

  // Dir (not empty) or file
  delete(p: string): void {
    const st = statOrNull(this.dir + p);
    if (st !== null && st.isFile()) {
      try {
        fs.unlinkSync(this.dir + p);
      } catch (e) {
        throw new MessageException(
          Message.createMessage(
            this.isCacheDriver,
            Message.UNABLE_TO_DELETE_FILE,
            p
          ),
          e
        );
      }

    } else {

      // There can be a try to delete unexisting file (in cache dir),
      // so we will have is_file() == false and fall here.
      // So there is required to check does this dir actually exists.
      if (st !== null && st.isDirectory()) {

        for (const dir of this.directories(p)) {
          this.delete(p + "/" + dir);
        }

        for (const file of this.files(p)) {
          this.delete(p + "/" + file.name);
        }

        this.deleteDirectory(p);

      }
    }
  }

  // Delete empty dir
  deleteDirectory(p: string): void {
    try {
      fs.rmdirSync(this.dir + p);
    } catch (e) {
      throw new MessageException(
        Message.createMessage(
          this.isCacheDriver,
          Message.FM_UNABLE_TO_DELETE_DIRECTORY
        ),
        e
      );
    }
  }

  // Returns a stream to send the file with; a file that can not be opened is an error
  readStream(p: string): fs.ReadStream {
    fs.accessSync(this.dir + p, fs.constants.R_OK);
    if (!this.fileExists(p)) {
      throw new Error("Not a file: " + p);
    }
    return fs.createReadStream(this.dir + p);
  }

  copyFile(pathSrc: string, pathDst: string): void {
    try {
      fs.copyFileSync(this.dir + pathSrc, this.dir + pathDst);
    } catch (e) {
      throw new MessageException(
        Message.createMessage(
          this.isCacheDriver,
          Message.FM_ERROR_ON_COPYING_FILES
        ),
        e
      );
    }
  }

  // $dst is the dir to copy INTO: the copy keeps the source's own name inside it.
  // The S3 and Blob drivers do the same, so do not "simplify" this into the full
  // destination path - that is what move() takes, not this.
  copyDirectory(src: string, dst: string): void {
    // List before creating anything: a copy into own subtree would otherwise keep
    // finding the children we are writing.
    const dirs = this.directories(src);
    const files = this.files(src);

    const target = dst.replace(/[\\/]+$/, "") + "/" + path.posix.basename(src);
    this.makeDirectory(target);

    for (const file of files) {
      this.copyFile(src + "/" + file.name, target + "/" + file.name);
    }

    // directories() gives bare names here (the cloud driver returns full paths)
    for (const dirName of dirs) {
      this.copyDirectory(src + "/" + dirName, target);
    }
  }

  // Cut off the path the client could send in the file name, so we always write
  // into $dir. Backslashes are separators too. Null byte breaks the file functions below.
  protected uploadFile__getSafeName(file: UploadedFile): string {
    const name = path.posix.basename(("" + file.name).replace(/\\/g, "/"));
    if (name === "" || name === "." || name === ".." || name.indexOf("\0") !== -1) {
      throw new MessageException(
        Message.createMessage(
          this.isCacheDriver,
          Message.FM_DIR_NAME_CONTAINS_INVALID_SYMBOLS
        )
      );
    }
    return name;
  }

  uploadFile__getName(file: UploadedFile, dir: string, isOverwrite: boolean): string {
    const safeName = this.uploadFile__getSafeName(file);
    let name: string;
    if (isOverwrite) {
      // Remove existing file if exists
      name = safeName;
      if (this.exists(dir + "/" + name)) {
        this.delete(dir + "/" + name);
      }
    } else {
      // Get free file name
      let i = -1;
      let ok: boolean;
      do {
        i++;
        if (i == 0) {
          name = safeName;
        } else {
          const ext = Utils.getExt(safeName);
          name =
            Utils.getNameWithoutExt(safeName) +
            "_" +
            i +
            (ext != null && ext !== ""
              ? "." + ext
              : "");
        }
        ok = !this.exists(dir + "/" + name);
      } while (!ok);
    }
    return name as string;
  }

  uploadFile(file: UploadedFile, dir: string, isOverwrite: boolean): string {

    const name = this.uploadFile__getName(file, dir, isOverwrite);

    const dirDst = this.dir + dir;
    if (statOrNull(dirDst) === null) {
      try {
        fs.mkdirSync(dirDst, {recursive: true, mode: this.dirPermissions});
      } catch (e) {
        // reported below, when the move fails
      }
    }

    try {
      this.moveUploadedFile(file.tmp_name, dirDst + "/" + name);
    } catch (e) {
      console.error("Unable to upload file " + file.tmp_name + " to " + dir + "/" + file.name);
      throw new MessageException(
        Message.createMessage(
          this.isCacheDriver,
          Message.WRITING_FILE_ERROR,
          dir + "/" + file.name
        ),
        e
      );
    }

    return name;
  }

  // The temporary upload goes to its place; across file systems it is copied
  private moveUploadedFile(tmpPath: string, dst: string): void {
    try {
      fs.renameSync(tmpPath, dst);
    } catch (e: any) {
      if (e && e.code === "EXDEV") {
        fs.copyFileSync(tmpPath, dst);
        fs.unlinkSync(tmpPath);
        return;
      }
      throw e;
    }
  }

}
