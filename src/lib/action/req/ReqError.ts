import {Req} from "./Req";
import {Message} from "../../action/resp/Message";

export interface ReqError extends Req {

    "message": Message;

}

export function createReqError(msg: Message): ReqError {
    let req: ReqError = {
        "action": "error",
        "message": msg
    };
    return req;
}
