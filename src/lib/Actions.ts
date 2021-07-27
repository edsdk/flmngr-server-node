import {AAction} from "./action/AAction";
import {ActionError} from "./action/ActionError";
import {ActionUploadInit} from "./action/ActionUploadInit";
import {ActionUploadRemoveFile} from "./action/ActionUploadRemoveFile";
import {ActionUploadAddFile} from "./action/ActionUploadAddFile";
import {ActionUploadCommit} from "./action/ActionUploadCommit";
import {ActionUploadCancel} from "./action/ActionUploadCancel";

export class Actions {

    protected m_actions: any[] = [];

    constructor() {
        this.m_actions.push(new ActionError());

        this.m_actions.push(new ActionUploadInit());
        this.m_actions.push(new ActionUploadAddFile());
        this.m_actions.push(new ActionUploadRemoveFile());
        this.m_actions.push(new ActionUploadCommit());
        this.m_actions.push(new ActionUploadCancel());
    }

    public getActionError(): AAction {
        return this.getAction("error");
    }

    public getAction(name: string): any {
        for (let i=0; i<this.m_actions.length; i++)
            if (this.m_actions[i].getName() === name)
                return this.m_actions[i];
        return null;
    }

}
