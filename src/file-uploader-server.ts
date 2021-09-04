import express from "express";
import Busboy from "busboy";
import {UploaderServlet} from "./servlet/UploaderServlet";
import { cond } from "lodash";


export function processFileUploaderRequest(
    request: express.Request,
    response: express.Response,
    config: any
) {
    
    config.config.dir = config.dir
    let servlet = new UploaderServlet(config.config);

    if (request.method === "OPTIONS") {
        servlet.doOptions(request, response);
        response.sendStatus(200);
        return;
    }

    // let busboy = new Busboy({ "headers": request.headers });
    let busboy = (request as any).busboy;
    busboy.on('file', function(fieldname: string, file: any, filename: string, encoding: string, mimetype: string) {
        
        if (fieldname === "file") {
            (request as any)["postFile"] = {
                "filename": filename,
                "data": null
            };
            file.on('data', function (data: Buffer) {
                let oldData: Buffer = (request as any)["postFile"]["data"];
                let newData = oldData == null ? data : Buffer.concat([oldData, data]);
                (request as any)["postFile"]["data"] = newData;
            });
        }
    });
    busboy.on('field', (fieldname: string, val: any, fieldnameTruncated: string, valTruncated: any, encoding: string, mimetype: string) => {
    
        if (fieldname === "data")
            (request as any).postData = val;
    });
    busboy.on('finish', () => {
        servlet.doPost(request, response);
    });
    request.pipe(busboy);
}