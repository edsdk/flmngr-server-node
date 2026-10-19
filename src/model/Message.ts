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

// The error object the client receives: {code, args, isCacheIssue}
export interface FailMessage {
  code: number;
  args: any[] | null;
  isCacheIssue: boolean;
}

export class Message {

  static readonly FILE_ERROR_SYNTAX = -1; // args: name

  static readonly FILE_ERROR_DOES_NOT_EXIST = -2;

  static readonly FILE_ERROR_INCORRECT_IMAGE_EXT_CHANGE = -3; // args: oldExt, newExt

  static readonly ACTION_NOT_FOUND = 0;

  static readonly UNABLE_TO_CREATE_UPLOAD_DIR = 1;

  static readonly UPLOAD_ID_NOT_SET = 2;

  static readonly UPLOAD_ID_INCORRECT = 3;

  static readonly MALFORMED_REQUEST = 4;

  static readonly NO_FILE_UPLOADED = 5;

  static readonly FILE_SIZE_EXCEEDS_LIMIT = 6; // args: name, size, maxSize

  static readonly INCORRECT_EXTENSION = 7; // args: name, allowedExtsStr

  static readonly WRITING_FILE_ERROR = 8; // args: name

  static readonly UNABLE_TO_DELETE_UPLOAD_DIR = 9;

  static readonly UNABLE_TO_DELETE_FILE = 10; // args: name

  static readonly DIR_DOES_NOT_EXIST = 11; // args: name

  static readonly FILES_NOT_SET = 12;

  static readonly FILE_IS_NOT_IMAGE = 13;

  static readonly DUPLICATE_NAME = 14;

  static readonly FILE_ALREADY_EXISTS = 15; // args: name

  static readonly FILES_ERRORS = 16; // files args: filesWithErrors

  static readonly UNABLE_TO_COPY_FILE = 17; // args: name, dstName

  static readonly IMAGE_PROCESS_ERROR = 18;

  static readonly MAX_RESIZE_WIDTH_EXCEEDED = 19; // args: width, maxWidth, name

  static readonly MAX_RESIZE_HEIGHT_EXCEEDED = 20; // args: height, maxHeight, name

  static readonly UNABLE_TO_WRITE_IMAGE_TO_FILE = 21; // args: name

  static readonly INTERNAL_ERROR = 22;

  static readonly DOWNLOAD_FAIL_CODE = 23; // args: httpCode

  static readonly DOWNLOAD_FAIL_IO = 24; // args: IO_Exceptions_text

  static readonly DOWNLOAD_FAIL_HOST_DENIED = 25; // args: host name

  static readonly DOWNLOAD_FAIL_INCORRECT_URL = 26; // args: url

  // 27 and 28 reserved for demo server
  static readonly FILE_SIZE_EXCEEDS_SYSTEM_LIMIT = 29; // args: size, maxSize, like #6, but a limit of the server

  static readonly FILE_SIZE_EXCEEDS_SYSTEM_LIMIT_2 = 30; // args: size, maxSize, strParameterInfo, like #30, but with info about wrong parameter

  static readonly FILE_TYPE_NOT_ALLOWED = 31; // args: name - file name rejected by denyFilePatterns (upload/rename)

  static readonly FM_FILE_DOES_NOT_EXIST = 10001; // File does not exist: %1

  static readonly FM_UNABLE_TO_WRITE_PREVIEW_IN_CACHE_DIR = 10002; // Unable to write a preview into cache directory

  static readonly FM_UNABLE_TO_CREATE_PREVIEW = 10003; // Unable to create a preview

  static readonly FM_DIR_NAME_CONTAINS_INVALID_SYMBOLS = 10004; // Directory name contains invalid symbols

  static readonly FM_DIR_NAME_INCORRECT_ROOT = 10005; // Directory has incorrect root

  static readonly FM_FILE_IS_NOT_IMAGE = 10006; // File is not an image

  static readonly FM_ROOT_DIR_DOES_NOT_EXIST = 10007; // Root directory does not exists

  static readonly FM_UNABLE_TO_LIST_CHILDREN_IN_DIRECTORY = 10008; // Unable to list children in the directory [in %1]

  static readonly FM_UNABLE_TO_DELETE_DIRECTORY = 10009; // Unable to delete the directory

  static readonly FM_UNABLE_TO_CREATE_DIRECTORY = 10010; // Unable to create a directory: %1

  static readonly FM_UNABLE_TO_RENAME = 10011; // Unable to rename

  static readonly FM_DIR_CANNOT_BE_READ = 10012; // Directory can not be read

  static readonly FM_ERROR_ON_COPYING_FILES = 10013; // Error on copying files

  static readonly FM_ERROR_ON_MOVING_FILES = 10014; // Error on moving files

  static readonly FM_NOT_ERROR_NOT_NEEDED_TO_UPDATE = 10015;

  static readonly FM_ROOT_DIR_IS_NOT_SET = 10016; // Shows incorrect configuration

  static readonly FM_DIR_IS_NOT_READABLE = 10017; // %1 is dir

  static readonly FM_DIR_IS_NOT_WRITABLE = 10018; // %1 is dir

  code: number = 0;

  args: any[] | null = null;

  isCacheIssue: boolean;

  private constructor(isCacheIssue: boolean) {
    this.isCacheIssue = isCacheIssue;
  }

  static createMessage(
    isCacheException: boolean,
    code: number,
    arg1: any = null,
    arg2: any = null,
    arg3: any = null
  ): Message {
    const msg = new Message(isCacheException);
    msg.code = code;
    if (!Message.isNothing(arg1)) {
      msg.args = [];
      msg.args.push(arg1);
      if (!Message.isNothing(arg2)) {
        msg.args.push(arg2);
        if (!Message.isNothing(arg3)) {
          msg.args.push(arg3);
        }
      }
    }
    return msg;
  }

  // An argument is dropped when it is empty: null, false, 0, "" or an empty list.
  // The string "0" is kept.
  private static isNothing(value: any): boolean {
    return value === null || value === undefined || value === false || value === 0 || value === "" ||
      (Array.isArray(value) && value.length === 0);
  }

  toJSON(): FailMessage {
    return {
      code: this.code,
      args: this.args,
      isCacheIssue: this.isCacheIssue
    };
  }

}
