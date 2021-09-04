import {AAction} from "../action/AAction";
import {Req} from "../action/req/Req";
import {ReqError} from "../action/req/ReqError";
import {RespOk} from "../action/resp/RespOk";
import {RespFail} from "../action/resp/RespFail";

export class ActionError extends AAction {

    public getName(): string {
        return "error";
    }

    public run(request: Req, onFinish: (result: any) => void): void {
        let reqError: ReqError = request as ReqError;
        onFinish(new RespFail(reqError["message"]));
    }

}
