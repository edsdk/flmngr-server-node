import {IConfig} from "../lib/config/IConfig";
import * as fsx from "fs-extra"

export class ServletConfig implements IConfig {

    protected m_conf: any;

    protected m_testConf: {[key: string]: string} = {};

    constructor(conf: any) {
        this.m_conf = conf;
        
    }

    public setTestConfig(testConf: {[key: string]: string}): void {
        this.m_testConf = testConf;
    }

    protected getParameter(name: string, defaultValue: any, doAddTrailingSlash: boolean): any {
        if (name in this.m_testConf)
            return this.addTrailingSlash(this.m_testConf[name], doAddTrailingSlash);
        else {
            let value: string = this.m_conf[name];
            
            if (value != null)
                return this.addTrailingSlash(value, doAddTrailingSlash);
            return defaultValue;
        }
    }

    protected addTrailingSlash(value: string, doAddTrailingSlash: boolean): string {
        if (value != null && doAddTrailingSlash && (value.length === 0 || value.substring(value.length-1) !== "/"))
            value += "/";
        return value;
    }

    protected getParameterStr(name: string, defaultValue: string): string {
        return this.getParameter(name, defaultValue, false);
    }

    protected getParameterInt(name: string, defaultValue: number): number {
        return this.getParameter(name, defaultValue, false);
    }

    protected getParameterBool(name: string, defaultValue: boolean): boolean {
        return this.getParameter(name, defaultValue, false);
    }

    public getBaseDir(): string {
        let d = __dirname;
        if (d.length === 1)
            d = d.substr(1); // "/" case
        let dir: string = this.getParameter("dirFiles", d + "files/", true);
        if (!fsx.existsSync(dir))
            fsx.mkdirsSync(dir);
        return dir;
    }

    public getTmpDir(): string {
        let dir: string = this.getParameter("dirTmp", this.getBaseDir() + "tmp/", true);
        if (!fsx.existsSync(dir))
            fsx.mkdirsSync(dir);
        return dir;
    }

    public getMaxUploadFileSize(): number { return this.getParameterInt("maxUploadFileSize", 0); }
    public getAllowedExtensions(): string[] {
        let value: string = this.getParameterStr("allowedExtensions", null);
        if (value == null)
            return [];
        let exts: string[] = value.split(",");
        for (let i=0; i<exts.length; i++)
            exts[i] = exts[i].toLowerCase();
        return exts;
    }

    public getJpegQuality(): number { return this.getParameterInt("jpegQuality", 95); }

    public getMaxImageResizeWidth(): number { return this.getParameterInt("maxImageResizeWidth", 5000); }
    public getMaxImageResizeHeight(): number { return this.getParameterInt("maxImageResizeHeight", 5000); }
    public getCrossDomainUrl(): string { return this.getParameterStr("crossDomainUrl", null); }
    public doKeepUploads(): boolean { return this.getParameterBool("keepUploads", false); }

    public isTestAllowed(): boolean { return this.getParameterBool("isTestAllowed", false); }

    public getRelocateFromHosts(): string[] {
        let hostsStr: string = this.getParameterStr("relocateFromHosts", "");
        let hostsFound: string[] = hostsStr.split(",");
        let hosts: string[] = [];
        for (let i=0; i<hostsFound.length; i ++) {
            let host: string = hostsFound[i].trim().toLowerCase();
            if (host.length > 0)
                hosts.push(host);
        }
        return hosts;
    }

}
