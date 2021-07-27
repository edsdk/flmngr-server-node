import express, {Router} from 'express';
import path from 'path';

import FMController from './controllers/FMController';
import {DiskFileSystemRepository} from './repositories/DiskFileSystemRepository';
import * as FileUploaderServer from "./file-uploader-server";

export const createRouter = (config: {
    app: express.Express,
    url: string,
    dir: string,
    config?: any
}): Router => {
	const router = express.Router();
    
	const repository = new DiskFileSystemRepository();
	const controller = new FMController(repository, path.resolve(config.dir));

	router.post('/', (req: express.Request, res: express.Response) => {


        let action = req.body.action;
        
        if (action === "dirList")
        	controller.dirList(req, res);
        else if (action === "dirCreate")
        	controller.dirCreate(req, res);
        else if (action === "dirRename")
            controller.dirRename(req, res);
        else if (action === "dirDelete")
            controller.dirDelete(req, res);
        else if (action === "dirCopy")
            controller.dirCopy(req, res);
        else if (action === "dirMove")
            controller.dirMove(req, res);
        else if (action === "fileList")
            controller.fileList(req, res);
        else if (action === "fileDelete")
            controller.fileDelete(req, res);
        else if (action === "fileCopy")
            controller.fileCopy(req, res);
        else if (action === "fileRename")
            controller.fileRename(req, res);
        else if (action === "fileMove")
            controller.fileMove(req, res);
        else if (action === "getVersion")
            controller.getVersion(req, res);
        else {
            
            if ((req as any).busboy) {
                let configUploader: any = {
                    dir: config.dir,
                    config: config.config.uploader
                };
                FileUploaderServer.processFileUploaderRequest(req, res, configUploader);
            }
        }
    });

    router.get('/', (req: express.Request, res: express.Response) => {
        
        let action = req.query.action;
        if (action === "dirDownload")
            controller.dirDownload(req, res);
        else if (action === "fileOriginal")
            controller.fileOriginal(req, res);
        else if (action === "filePreview")
            controller.filePreview(req, res);
    });

	return router;
};
