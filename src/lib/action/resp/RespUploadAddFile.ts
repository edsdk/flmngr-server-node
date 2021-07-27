import {RespOk} from "../../action/resp/RespOk";
import {FileData} from "../../action/resp/FileData";

export class RespUploadAddFile extends RespOk {

    public "file": FileData;

}
