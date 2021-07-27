import {Actions} from "../lib/Actions";
import {JsonCodec} from "../lib/JsonCodec";
import {Uploader} from "../lib/Uploader";
import {IConfig} from "../lib/config/IConfig";
import {ServletConfig} from "./ServletConfig";
import {Req} from "../lib/action/req/Req";
import {RespOk} from "../lib/action/resp/RespOk";
import {Message} from "../lib/action/resp/Message";
import {createReqError} from "../lib/action/req/ReqError";
import * as express from 'express';
import * as fsx from "fs-extra"

export class UploaderServlet {

    protected m_actions = new Actions();
    protected m_json = new JsonCodec();
    protected m_uploader: Uploader;
    protected m_config: IConfig;

    constructor(
        protected m_conf: {[key: string]: any} = {}
    ) {
        this.m_config = new ServletConfig(this.m_conf);
        this.m_uploader = new Uploader(this.m_config, this.m_actions);
    }

    protected getReq(request: express.Request) {

        let dataJson: string = (request as any).postData;

        let fileName: any = null;
        let fileSize: number = -1;

        let file: Buffer;
        if ((request as any)["postFile"]) {
            file = (request as any)["postFile"]["data"];
            fileName = (request as any)["postFile"]["filename"];
            fileSize = file.length;
        }

        let req: Req;
        try {
            req = this.m_json.fromJson(dataJson);
            if (this.m_config.isTestAllowed()) {
                if (req['test_serverConfig'] != null)
                    this.m_config.setTestConfig(req['test_serverConfig']);
                if (req['test_clearAllFiles'] != null && req['test_clearAllFiles'])
                    this.clearAllFiles();
            }
        } catch (e) {
            console.log(e);
            return null;
        }

        if (fileName != null) {
            req['m_fileName'] = fileName;
            req['m_fileSize'] = fileSize;
            req['m_file'] = file;
        }

        return req;
    }

    protected clearAllFiles(): void {
        fsx.removeSync(this.m_config.getTmpDir());
        fsx.mkdirsSync(this.m_config.getTmpDir());
        fsx.removeSync(this.m_config.getBaseDir());
        fsx.mkdirsSync(this.m_config.getBaseDir());
    }

    protected addHeaders(response: express.Response): void {
        if (this.m_config.getCrossDomainUrl() != null && this.m_config.getCrossDomainUrl().length > 0) {
            response.setHeader("Access-Control-Allow-Origin", this.m_config.getCrossDomainUrl());
            response.setHeader("Access-Control-Allow-Methods", "POST");
            response.setHeader("Access-Control-Allow-Headers", "accept, content-type");
            response.setHeader("Access-Control-Max-Age", "1728000");
        }
    }

    public doOptions(request: express.Request, response: express.Response): void {
        this.addHeaders(response);
    }

    public doPost(request: express.Request, response: express.Response): void {
        this.addHeaders(response);
        let strResp: string;

        let req: any = null;
        try {
            req = this.getReq(request);
        } catch (e) {
            // FileUploadException and IOException
            console.log(e);
        }

        if (req == null)
            req = createReqError(Message.createMessage(Message.MALFORMED_REQUEST));

        this.m_uploader.run(
            req,
            (resp: RespOk) => {
                strResp = this.m_json.toJson(resp);
                try {
                    response.contentType("application/json; charset=UTF-8");
                    response.send(strResp);
                } catch (e) {
                    console.log(e);
                }
            }
        );
    }

}


