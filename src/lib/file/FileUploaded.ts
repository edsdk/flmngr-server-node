import {AFile} from "../file/AFile";
import {Message} from "../action/resp/Message";
import {IConfig} from "../config/IConfig";
import {Utils} from "../file/Utils";
import * as fsx from "fs-extra"
import {MessageException} from "../MessageException";
import {FileCommited} from "../file/FileCommited";
import {DownloadedURL, URLDownloader} from "../file/URLDownloader";

export class FileUploaded extends AFile {

    protected m_newName: string;

    protected m_conflictsErrors: Message[] = [];
    protected m_customErrors: Message[] = [];

    constructor(config: IConfig, dir: string, name: string, newName: string) {
        super(config, dir, name);
        this.m_newName = newName;
    }

    public getBaseDir(): string { return this.m_config.getTmpDir(); }

    public getNewName(): string { return this.m_newName; }

    public checkForErrors(checkForExist: boolean): boolean {
    if (!super.checkForErrors(checkForExist))
        return false;

    if ((this.m_newName !== this.getName()) && !Utils.isFileNameSyntaxOk(this.m_newName))
        this.m_commonErrors.push(Message.createMessage(Message.FILE_ERROR_SYNTAX, this.m_newName));

    if (Utils.isImage(this.getName())) {
        let ext: string = this.getExt();
        let newExt: string = Utils.getExt(this.m_newName);
        if (ext !== newExt)
            if (!(ext === "jpg" && newExt === "jpeg") && !(ext === "jpeg" && newExt === "jpg"))
                this.m_commonErrors.push(Message.createMessage(Message.FILE_ERROR_INCORRECT_IMAGE_EXT_CHANGE, ext, newExt));
    }
    return true;
}

    public addCustomError(message: Message) {
        this.m_customErrors.push(message);
    }

    public getErrors(): Message[] {
        let errors: Message[] = super.getErrors();
        for (const err of this.m_conflictsErrors)
            errors.push(err);
        for (const err of this.m_customErrors)
            errors.push(err);
        return errors;
    }

    public getCommitedFile(dir: string): FileCommited {
        return new FileCommited(this.m_config, dir, this.m_newName);
    }

    public checkForConflicts(dir: string) {
        this.m_conflictsErrors = [];

        let file: FileCommited = this.getCommitedFile(dir);
        if (file.exists())
            this.m_conflictsErrors.push(Message.createMessage(Message.FILE_ALREADY_EXISTS, file.getName()));

        if (file.isImage()) {
            let fileOriginal: FileCommited = file.getFileOriginal();
            if (fileOriginal.exists())
                this.m_conflictsErrors.push(Message.createMessage(Message.FILE_ALREADY_EXISTS, fileOriginal.getName()));

            let filePreview: FileCommited = file.getFilePreview();
            if (filePreview.exists())
                this.m_conflictsErrors.push(Message.createMessage(Message.FILE_ALREADY_EXISTS, filePreview.getName()));
        }
    }


    public uploadAndCommit(is: Buffer) {
        let initName: string = this.getName();
        this.setFreeFileName();
        
        try {
            let os = this.getFile();
            fsx.writeFileSync(os, is);
        } catch (e) {
            new MessageException(Message.createMessage(Message.WRITING_FILE_ERROR, initName));
        }
    }

    public rehost(url: string, onFinish: (result: DownloadedURL|Error) => void) {
        URLDownloader.download(
            url,
            this.getBaseDir() + "/" + this.getDir(),
            (result: DownloadedURL|Error) => {
                if (result instanceof DownloadedURL)
                    this.setName((result as DownloadedURL).fileName);
                onFinish(result);
            }
        );
    }

    public commit(dir: string, autoRename: boolean): FileCommited {
            
            
        
        let file: FileCommited = this.getCommitedFile(dir);
        if (autoRename)
            file.setFreeFileName();
        this.copyTo(file);
        return file;
    }

    public isCommited(): boolean {
        return false;
    }

}