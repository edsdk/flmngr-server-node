import {RespOk} from "../../action/resp/RespOk";
import {Message} from "../../action/resp/Message";

export class RespFail extends RespOk {

    public "message": Message;

    constructor(message: Message) {
        super();
        this["ok"] = false;
        this["message"] = message;
    }

}
