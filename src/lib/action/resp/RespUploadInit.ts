import {RespOk} from "../../action/resp/RespOk";
import {IConfig} from "../../config/IConfig";

export interface Settings {
    "maxImageResizeWidth": number;
    "maxImageResizeHeight": number;
}

export class RespUploadInit extends RespOk {

    public "uploadId": string;
    public "settings": Settings;

    constructor(uploadId: string, config: IConfig) {
        super();
        this["uploadId"] = uploadId;
        this["settings"] = {
            "maxImageResizeWidth": config.getMaxImageResizeWidth(),
            "maxImageResizeHeight": config.getMaxImageResizeHeight()
        };
    }

}
