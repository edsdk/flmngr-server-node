import {AAction} from "../action/AAction";
import {ReqUploadId} from "../action/req/ReqUploadId";
import {MessageException} from "../MessageException";
import {Message} from "../action/resp/Message";
import * as fsx from "fs-extra"

export abstract class AActionUploadId extends AAction {

    protected validateUploadId(req: ReqUploadId) {
        if (req["uploadId"] == null)
            throw new MessageException(Message.createMessage(Message.UPLOAD_ID_NOT_SET));

        let dir = this.m_config.getTmpDir() + "/" + req["uploadId"];

        if (!fsx.existsSync(dir) || !fsx.lstatSync(dir).isDirectory())
            throw new MessageException(Message.createMessage(Message.UPLOAD_ID_INCORRECT));
    }

}
