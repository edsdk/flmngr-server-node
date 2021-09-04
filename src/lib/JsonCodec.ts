import {Req} from "./action/req/Req";
import {createReqError, ReqError} from "./action/req/ReqError";
import {Message} from "./action/resp/Message";
import {RespOk} from "./action/resp/RespOk";
import {RespFail} from "./action/resp/RespFail";

export class JsonCodec {

    public fromJson(json: string): Req {
        try {
            let req: Req = JSON.parse(json) as Req;
            if (req["action"] === "error") // do not allow to send requests with pseudo action "error"
                req = createReqError(Message.createMessage(Message.ACTION_NOT_FOUND));
            return req;
        } catch (e) {
            return createReqError(Message.createMessage(Message.MALFORMED_REQUEST));
        }
    }

    public toJson(resp: RespOk): string {
        return JSON.stringify(resp);
    }

}
