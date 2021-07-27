import {FileData} from "../../action/resp/FileData";

export class Message {

    static readonly  FILE_ERROR_SYNTAX = -1; // args: name
    static readonly  FILE_ERROR_DOES_NOT_EXIST = -2;
    static readonly  FILE_ERROR_INCORRECT_IMAGE_EXT_CHANGE = -3; // args: oldExt, newExt

    static readonly  ACTION_NOT_FOUND = 0;
    static readonly  UNABLE_TO_CREATE_UPLOAD_DIR = 1;
    static readonly  UPLOAD_ID_NOT_SET = 2;
    static readonly  UPLOAD_ID_INCORRECT = 3;
    static readonly  MALFORMED_REQUEST = 4;
    static readonly  NO_FILE_UPLOADED = 5;
    static readonly  FILE_SIZE_EXCEEDS_LIMIT = 6; // args: name, size, maxSize
    static readonly  INCORRECT_EXTENSION = 7; // args: name, allowedExtsStr
    static readonly  WRITING_FILE_ERROR = 8; // args: name
    static readonly  UNABLE_TO_DELETE_UPLOAD_DIR = 9;
    static readonly  UNABLE_TO_DELETE_FILE = 10; // args: name
    static readonly  DIR_DOES_NOT_EXIST = 11; // args: name
    static readonly  FILES_NOT_SET = 12;
    static readonly  FILE_IS_NOT_IMAGE = 13;
    static readonly  DUPLICATE_NAME = 14;
    static readonly  FILE_ALREADY_EXISTS = 15; // args: name
    static readonly  FILES_ERRORS = 16; // files args: filesWithErrors
    static readonly  UNABLE_TO_COPY_FILE = 17; // args: name, dstName
    static readonly  IMAGE_PROCESS_ERROR = 18;
    static readonly  MAX_RESIZE_WIDTH_EXCEEDED = 19; // args: width, maxWidth, name
    static readonly  MAX_RESIZE_HEIGHT_EXCEEDED = 20; // args: height, maxHeight, name
    static readonly  UNABLE_TO_WRITE_IMAGE_TO_FILE = 21; // args: name
    static readonly  INTERNAL_ERROR = 22;
    static readonly  DOWNLOAD_FAIL_CODE = 23; // args: httpCode
    static readonly  DOWNLOAD_FAIL_IO = 24; // args: IO_Exceptions_text
    static readonly  DOWNLOAD_FAIL_HOST_DENIED = 25; // args: host name
    static readonly  DOWNLOAD_FAIL_INCORRECT_URL = 26; // args: url

    protected "code": number;
    protected "args": string[];
    protected "files": FileData[];

    public static createMessage(code: number, arg1: string = null, arg2: string = null, arg3: string = null): Message {
        let msg = new Message();
        msg["code"] = code;
        if (arg1 != null) {
            msg["args"] = [];
            msg["args"].push(arg1);
            if (arg2 != null)
                msg["args"].push(arg2);
            if (arg3 != null)
                msg["args"].push(arg3);
        }
        return msg;
    }

    public static createMessageByFiles(code: number, files: FileData[]): Message {
        let msg = new Message();
        msg["code"] = code;
        msg["files"] = files;
        return msg;
    }

    public static createMessageByFile(code: number, file: FileData): Message {
        let msg = new Message();
        msg["code"] = code;
        msg["files"] = [];
        msg["files"].push(file);
        return msg;
    }

}
