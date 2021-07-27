import {ReqUploadId} from "../../action/req/ReqUploadId";

export interface Size {

    "enlarge": boolean;
    "width": number;
    "height": number;

}

export interface File {
    "name": string;
    "newName": string;
}

export interface ReqUploadCommit extends ReqUploadId {

    "sizes": {[key: string]: Size};
    "doCommit": boolean;
    "autoRename": boolean;
    "dir": string;
    "files": File[];

}
