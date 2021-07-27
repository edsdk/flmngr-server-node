import {RespOk} from "../../action/resp/RespOk";
import {FileData} from "../../action/resp/FileData";

export class RespUploadCommit extends RespOk {

    public "files": FileData[];

}
