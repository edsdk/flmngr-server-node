import {MessageException} from "../MessageException";
import {Message} from "../action/resp/Message";
import * as fs from "fs";
import {Utils} from "../file/Utils";
const request =  require("request");

export class DownloadedURL {
    fileName: string = '';
    contentType: string = '';
    contentLength: number = -1;
}

export class URLDownloader {

    public static download(url: string, dir: string, onFinish: (result: DownloadedURL|Error) => void) {

        let options = {
            "url": url,
            "headers": {
                'User-Agent': "Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.11 (KHTML, like Gecko) Chrome/23.0.1271.95 Safari/537.11"
            },
            "encoding": 'binary'
        };
        request(
            options,
            (error: any, response:any, body: any) => {

                try {

                    if (response.statusCode === 200) {
                        let disposition = response.headers["content-disposition"];
                        let result: DownloadedURL = new DownloadedURL();
                        result.contentType = response.headers["content-type"];
                        result.contentLength = parseInt(response.headers["content-length"]);

                        let fileName: string = '';
                        if (disposition) {
                            // extracts file name from header field
                            let index = disposition.indexOf("filename=");
                            if (index > 0) {
                                fileName = disposition.substring(index + 10, disposition.length - 1);
                            }
                        }
                        if (fileName.trim().length === 0) {
                            // extracts file name from URL
                            fileName = url.substring(url.lastIndexOf("/") + 1, url.length);
                            let index = fileName.indexOf("?");
                            if (index > -1)
                                fileName = fileName.substring(0, index);
                        }
                        if (fileName.trim().length === 0)
                            fileName = "url";
                        fileName = Utils.fixFileName(fileName);
                        fileName = Utils.getFreeFileName(dir, fileName, false);

                        // opens input stream from the HTTP connection
                        let saveFilePath: string = dir + "/" + fileName;
                        try {
                            fs.writeFileSync(saveFilePath, body, {"encoding": 'binary'});
                        } catch (e) {
                            onFinish(new MessageException(Message.createMessage(Message.WRITING_FILE_ERROR, fileName)));
                            return;
                        }

                        result.fileName = fileName;
                        onFinish(result);

                    } else {
                        onFinish(new MessageException(Message.createMessage(Message.DOWNLOAD_FAIL_CODE, response.statusCode.toString())));
                    }

                } catch (e) {
                    console.log(e);
                    onFinish(new MessageException(Message.createMessage(Message.INTERNAL_ERROR)));
                }
            }
        );
    }

}
