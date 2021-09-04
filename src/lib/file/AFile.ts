import {Message} from "../action/resp/Message";
import {IConfig} from "../config/IConfig";
import {FileData} from  "../action/resp/FileData";
import * as fsx from "fs-extra"
import {MessageException} from "../MessageException";
const imageSize = require("image-size")
// import * as imageSize from "image-size"
import {Utils} from "../file/Utils";
import {FileCommited} from "../file/FileCommited" ;

export abstract class AFile {

    protected m_config: IConfig;

    private m_name: string = '';
    private m_dir: string = '';

    protected m_commonErrors: Message[] = [];

    protected m_mainFile: FileCommited; // if set, this means this file is only modification (preview/original)

    constructor(config: IConfig, dir: string, name: string) {
        this.m_config = config;
        this.m_dir = dir;
        this.m_name = name;
    }

    public getData(): FileData {
        let data: FileData = new FileData();
        data["isCommited"] = this.isCommited();
        data["name"] = this.getName();
        data["dir"] = this.getDir();
        data["bytes"] = this.getSize();
        data["errors"] = this.getErrors();
        data["isImage"] = this.isImage();
        if (data["isImage"]) {
            try {
                data["width"] = this.getImageWidth();
                data["height"] = this.getImageHeight();
            } catch (e) {
                data["width"] = 0;
                data["height"] = 0;
            }
            if (data["isCommited"]) {
                data["sizes"] = {};
                if (this.m_mainFile == null) {
                    let modifications: AFile[] = this.getModifications();
                    for (let i=0; i<modifications.length; i++)
                    data["sizes"][modifications[i].getModificationName()] = modifications[i].getData();
                }
            }
        }
        return data;
    }

    public getModifications(): AFile[] { return []; }
    public getModificationName(): string { return ''; }

    public getSize(): number {
        let f: string = this.getFile();
        if (fsx.existsSync(f))
            return fsx.lstatSync(f).size;
        return 0;
    }

    public getErrors(): Message[] {
        let result: Message[] = [];
        for (const item of this.m_commonErrors)
            result.push(item);
        return result;
    }

    // Returns do we need to continue check or not
    public checkForErrors(checkForExist: boolean): boolean {
        this.m_commonErrors = [];

        if (!Utils.isFileNameSyntaxOk(this.getName())) {
            this.m_commonErrors.push(Message.createMessage(Message.FILE_ERROR_SYNTAX, this.getName()));
            return false; // do not do any other checks by security reasons
        }

        if (checkForExist && !this.exists())
            this.m_commonErrors.push(Message.createMessage(Message.FILE_ERROR_DOES_NOT_EXIST));

        return true;
    }

    public setName(name: string) { this.m_name = name; }
    public setDir(dir: string) { this.m_dir = dir; }


    public abstract isCommited(): boolean;
    public abstract getBaseDir(): string;

    public getName(): string { return this.m_name; }
    public getDir(): string {
    if (this.m_dir.length !== 0 && !(this.m_dir.substr(this.m_dir.length - 1) === "/"))
        return this.m_dir + "/";
    return this.m_dir;
}
    public getUrlUploader(): string {
        let dir = this.getDir() + this.getName();
        if (dir.startsWith("/"))
            dir = dir.substr(1);
        return dir;
    }
    public getFullPath(): string { return this.getBaseDir() + this.getUrlUploader(); }
    public getExt(): string {
        return Utils.getExt(this.m_name);
    }

    public getNameWithoutExt(): string {
        return Utils.getNameWithoutExt(this.m_name);
    }

    public getFile(): string { return this.getFullPath(); } // no File object in TypeScript, return string
    public exists(): boolean {
        try {
            return fsx.existsSync(this.getFile());
        } catch (e) {
            // SecurityException
            return false;
        }
    }
    public delete() {
        try {
            fsx.unlinkSync(this.getFile());
        } catch (e) {
            throw new MessageException(Message.createMessage(Message.UNABLE_TO_DELETE_FILE, this.getName()));
        }
    }

    public isImage(): boolean {
        return Utils.isImage(this.getName());
    }

    public getImageWidth(): number {
        try {
            return imageSize(this.getImage()).width;
        } catch (e) {
            console.log(e);
            throw new MessageException(Message.createMessage(Message.IMAGE_PROCESS_ERROR));
        }
    }
    public getImageHeight(): number {
        try {
            return imageSize(this.getImage()).height;
        } catch (e) {
            console.log(e);
            throw new MessageException(Message.createMessage(Message.IMAGE_PROCESS_ERROR));
        }
    }

    public getImage(): string {
        return this.getFile(); // no library both for getting dimensions and resizing
    }

    public setFreeFileName() {
        let name = Utils.getFreeFileName(this.getBaseDir() + this.getDir(), this.getName(), false);
        this.setName(name);
    }

    public copyTo(dstFile: AFile) {
        try {
            
            fsx.copySync(this.getFile(), dstFile.getFile());
        } catch (e) {
            // IOException
            console.log(e);
            throw new MessageException(Message.createMessage(Message.UNABLE_TO_COPY_FILE, this.getName(), dstFile.getName()));
        }
    }

}
