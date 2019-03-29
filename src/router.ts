import express, {Router} from 'express';
import path from 'path';

import FMController from './controllers/FMController';
import {DiskFileSystemRepository} from './repositories/DiskFileSystemRepository';

export const createRouter = (rootDirPath: string): Router => {
	const router = express.Router();

	const repository = new DiskFileSystemRepository();
	const controller = new FMController(repository, path.resolve(rootDirPath));

	router.post('/dirList', controller.getDirectories);
	router.post('/dirCreate', controller.createDirectory);
	router.post('/dirRename', controller.renameDirectory);
	router.post('/dirDelete', controller.deleteDirectory);
	router.post('/dirCopy', controller.copyDirectory);
	router.post('/dirMove', controller.moveDirectory);
	router.get('/dirDownload', controller.downloadDirectory);

	router.post('/fileList', controller.getFiles);
	router.post('/fileDelete', controller.deleteFiles);
	router.post('/fileCopy', controller.copyFiles);
	router.post('/fileRename', controller.renameFile);
	router.post('/fileMove', controller.moveFiles);
	router.get('/fileOriginal', controller.getImageOriginal);
	router.get('/filePreview', controller.getImagePreview);

	return router;
};
