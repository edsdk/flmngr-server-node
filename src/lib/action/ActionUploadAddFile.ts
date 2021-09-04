import {AActionUploadId} from "../action/AActionUploadId";
import {ReqUploadAddFile} from "../action/req/ReqUploadAddFile";
import {Req} from "../action/req/Req";
import {RespOk} from "../action/resp/RespOk";
import {MessageException} from "../MessageException";
import {Message} from "../action/resp/Message";
import {RespUploadAddFile} from "../action/resp/RespUploadAddFile";
import {FileUploaded} from "../file/FileUploaded";
import {DownloadedURL} from "../file/URLDownloader";
import {RespFail} from "../action/resp/RespFail";

export class ActionUploadAddFile extends AActionUploadId {

    public getName(): string {
        return "uploadAddFile";
    }

    public run(request: Req, onFinish: (result: RespOk) => void): void {
        let req: ReqUploadAddFile = request as any;
        this.validateUploadId(req as any);

        let file: FileUploaded;
        if (req["url"] == null) {
            if (req["m_fileName"] == null || req["m_file"] == null)
                throw new MessageException(Message.createMessage(Message.NO_FILE_UPLOADED));

            if (this.m_config.getMaxUploadFileSize() > 0 && req["m_fileSize"] > this.m_config.getMaxUploadFileSize())
                throw new MessageException(Message.createMessage(Message.FILE_SIZE_EXCEEDS_LIMIT, req["m_fileName"], req["m_fileSize"].toString(), this.m_config.getMaxUploadFileSize().toString()));

            file = new FileUploaded(this.m_config, req["uploadId"], req["m_fileName"], req["m_fileName"]);
            let ext: string = file.getExt().toLowerCase();
            let allowedExts: string[] = this.m_config.getAllowedExtensions();
            let isAllowedExt: boolean = allowedExts.length === 0;
            for (let i=0; i<allowedExts.length && !isAllowedExt; i++)
                isAllowedExt = allowedExts[i] === ext;
            if (!isAllowedExt) {
                let strExts: string = "";
                for (let i=0; i<allowedExts.length; i++) {
                    if (i > 0)
                        strExts += ", ";
                    strExts += allowedExts[i];
                }
                throw new MessageException(Message.createMessage(Message.INCORRECT_EXTENSION, req["m_fileName"], strExts.toString()));
            }
            file.uploadAndCommit(req["m_file"]);
            let resp: RespUploadAddFile = new RespUploadAddFile();
            resp["file"] = file.getData();
            onFinish(resp as any);
        } else {
            let relocateHosts: string[] = this.m_config.getRelocateFromHosts();
            let host: string | any = null;
            try {
                let url = new URL(req["url"]);
                host = url.hostname;
            } catch (e) {
                if (e instanceof TypeError) // the same as MalformedURLException in Java
                    throw new MessageException(Message.createMessage(Message.DOWNLOAD_FAIL_INCORRECT_URL, req["url"]));
            }
            let isHostAllowed = false;
            for (let i=0; i<relocateHosts.length && !isHostAllowed; i++)
            if (relocateHosts[i].toLowerCase() === host)
                isHostAllowed = true;
            if (relocateHosts.length === 0 || isHostAllowed) {
                file = new FileUploaded(this.m_config, req["uploadId"], null as any, null as any);
                file.rehost(
                    req["url"],
                    (result: DownloadedURL|Error) => {
                        if (result instanceof MessageException) {
                            onFinish(new RespFail(result.getFailMessage()) as any);
                        } else if (result instanceof Error) {
                            console.log(result);
                            onFinish(new RespFail(Message.createMessage(Message.INTERNAL_ERROR)) as any);
                        } else {
                            let resp: RespUploadAddFile = new RespUploadAddFile();
                            resp["file"] = file.getData();
                            onFinish(resp as any);
                        }
                    }
                );
            } else {
                throw new MessageException(Message.createMessage(Message.DOWNLOAD_FAIL_HOST_DENIED, host));
            }
        }
    }

}
