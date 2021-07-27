import {AActionUploadId} from "../action/AActionUploadId";
import {ReqUploadCommit, File, Size} from "../action/req/ReqUploadCommit";
import {Req} from "../action/req/Req";
import {RespOk} from "../action/resp/RespOk";
import {MessageException} from "../MessageException";
import {Message} from "../action/resp/Message";
import * as fsx from "fs-extra"
import {FileData} from "../action/resp/FileData";
import {RespUploadCommit} from "../action/resp/RespUploadCommit";
import {FileUploaded} from "../file/FileUploaded";
import {FileCommited} from "../file/FileCommited";
import {RespFail} from "../action/resp/RespFail";

export class ActionUploadCommit extends AActionUploadId {

    public getName(): string {
        return "uploadCommit";
    }

    protected validateSize(size: Size, sizeName: string) {
        size["enlarge"] = this.validateBoolean(size["enlarge"], sizeName === "preview");
        size["width"] = this.validateInteger(size["width"], 0);
        size["height"] = this.validateInteger(size["height"], 0);
    }

    protected validateSizes(req: ReqUploadCommit) {
        if (req["sizes"] == null) {
            req["sizes"] = {};
        } else {
            let sizesNames: string[] = ["full", "preview"];
            for (let i=0; i<sizesNames.length; i++)
            if (sizesNames[i] in req["sizes"])
                this.validateSize(req["sizes"][sizesNames[i]], sizesNames[i]);
        }
    }

    protected normalizeNoEndSeparator(dir: string): string {
        if (dir.indexOf("..") > -1)
            return null as any;
        if (dir.length > 0 && dir.substr(0, 1) === "/")
            dir = dir.substr(1);
        return dir;
    }

    /*
    public async run(request: Req): Promise<RespOk> {
        return new Promise<RespOk>(
            (resolve, reject) => {

            }
        );
    }
     */

    public run(request: Req, onFinish: (result: RespOk) => void): void {
        let req: ReqUploadCommit = request as any;
        this.validateUploadId(req as any);

        this.validateSizes(req);

        req["doCommit"] = this.validateBoolean(req["doCommit"], true);
        req["autoRename"] = this.validateBoolean(req["autoRename"], false);
        req["dir"] = this.validateString(req["dir"], "");

        if (this.normalizeNoEndSeparator(req["dir"]) == null)
            throw new MessageException(Message.createMessage(Message.DIR_DOES_NOT_EXIST, req["dir"]));

        req["dir"] = this.normalizeNoEndSeparator(req["dir"]) + "/";

        let dir = this.m_config.getBaseDir() + req["dir"];
        if (!fsx.existsSync(dir))
            throw new MessageException(Message.createMessage(Message.DIR_DOES_NOT_EXIST, req["dir"]));

        if (req["files"] == null || req["files"].length === 0)
            throw new MessageException(Message.createMessage(Message.FILES_NOT_SET));

        let filesToCommit: FileUploaded[] = [];
        for (let i=0; i<req["files"].length; i++) {
            let fileDef: File = req["files"][i];

            if (fileDef["name"] == null)
                throw new MessageException(Message.createMessage(Message.MALFORMED_REQUEST));

            if (fileDef["newName"] == null)
                fileDef["newName"] = fileDef["name"];

            let file: FileUploaded = new FileUploaded(this.m_config, req["uploadId"], fileDef["name"], fileDef["newName"]);
            filesToCommit.push(file);

            if (!file.isImage() && Object.keys(req["sizes"]).length !== 0)
                file.addCustomError(Message.createMessage(Message.FILE_IS_NOT_IMAGE));
        }

        // Check there are no equal names
        for (let i=0; i<filesToCommit.length; i++) {
            let name: string = filesToCommit[i].getNewName();
            for (let j=0; j<filesToCommit.length; j++) {
                let name2: string = filesToCommit[j].getNewName();
                if (i !== j && name === name2) {
                    filesToCommit[i].addCustomError(Message.createMessage(Message.DUPLICATE_NAME));
                    break;
                }
            }
        }

        // Check files for errors
        for (let i=0; i<filesToCommit.length; i++) {
            let file: FileUploaded = filesToCommit[i];
            file.checkForErrors(true);
            if (!req["autoRename"])
                file.checkForConflicts(req["dir"]);
        }

        let filesToCommitWithErrors: FileData[]  = [];
        for (let i=0; i<filesToCommit.length; i++)
            if (filesToCommit[i].getErrors().length > 0)
                filesToCommitWithErrors.push(filesToCommit[i].getData());

        if (filesToCommitWithErrors.length > 0)
            throw new MessageException(Message.createMessageByFiles(Message.FILES_ERRORS, filesToCommitWithErrors));

        // Validation ended
        if (!req["doCommit"]) {
            onFinish(new RespOk());
            return;
        }

        // 1. Commit
        this.filesCommitedCount = 0;
        this.filesCommited = [];
        for (let i=0; i<filesToCommit.length; i++) {
            let fileToCommit: FileUploaded = filesToCommit[i];
            
            let fileCommited: FileCommited = fileToCommit.commit(req["dir"], req["autoRename"]);
            this.filesCommited.push(fileCommited);
        }

        this.applySizes(
            req["sizes"],
            (e: Error) => {

                if (e != null) {
                    if (e instanceof MessageException)
                        onFinish(new RespFail((e as MessageException).getFailMessage()) as any);
                    else
                        onFinish(new RespFail(Message.createMessage(Message.INTERNAL_ERROR)) as any);
                    return;
                }

                // 2. Remove uploadAndCommit directory
                if (!this.m_config.doKeepUploads()) {
                    try {
                        fsx.removeSync(this.m_config.getTmpDir() + "/" + req["uploadId"]);
                    } catch (e) {
                        console.log(e);
                        // throw new MessageException(new Message(Message.UNABLE_TO_DELETE_UPLOAD_DIR));
                        // do not throw anything - we've commited files and need to return them
                    }
                }

                // 3. Send response with the list of files copied
                let files: FileData[] = [];
                for (let i=0; i<this.filesCommited.length; i++)
                    files.push(this.filesCommited[i].getData());

                let resp = new RespUploadCommit();
                resp["files"] = files;
                onFinish(resp as any);
            }
        );
    }

    private filesCommited: any[] = [];
    private filesCommitedCount: any;
    private applySizes(
        sizes: {[key: string]: Size},
        onFinish: (e: Error) => void
    ): void {
        if (this.filesCommitedCount === this.filesCommited.length) {
            onFinish(null as any);
        } else {
            try {
                this.filesCommited[this.filesCommitedCount].applySizes(
                        
                    sizes,
                    (e: Error) => {
                        
                        if (e != null) {
                            for (let j = 0; j < this.filesCommited.length; j++)
                                this.filesCommited[j].delete();
                            onFinish(e);
                        }
                        this.filesCommitedCount++;
                        this.applySizes(sizes, onFinish);
                    }
                );
            } catch (e) {
                
                for (let j = 0; j < this.filesCommited.length; j++)
                    this.filesCommited[j].delete();
                onFinish(e);
            }
        }
    }

}
