import {AActionUploadId} from "../action/AActionUploadId";
import {RespOk} from "../action/resp/RespOk";
import {Req} from "../action/req/Req";
import {ReqUploadRemoveFile} from "../action/req/ReqUploadRemoveFile";
import {MessageException} from "../MessageException";
import {Message} from "../action/resp/Message";
import {ReqError} from "../action/req/ReqError";
import {RespFail} from "../action/resp/RespFail";
import {FileUploaded} from "../file/FileUploaded";

export class ActionUploadRemoveFile extends AActionUploadId {

    public getName(): string {
        return "uploadRemoveFile";
    }

    public run(request: Req): Promise<RespOk> {
        return new Promise<RespOk>(
            (resolve, reject) => {
                let req: ReqUploadRemoveFile = request as any;
                this.validateUploadId(req as any);
                let file: FileUploaded = new FileUploaded(this.m_config, req["uploadId"], req["name"], req["name"]);
                file.checkForErrors(true);

                if (file.getErrors().length > 0) {
                    reject(new MessageException(Message.createMessageByFile(Message.UNABLE_TO_DELETE_UPLOAD_DIR, file.getData())))
                    return;
                }

                file.delete();
                resolve(new RespOk());
            }
        );
    }

}
