import {Request, Response} from 'express';
import path from 'path';
import fs from 'fs';

import {IFMRepository} from '../repositories/FMRepository';
import {FMErrorMessage} from '../models/Message';
import {
	getLastDir,
	getTitle,
	areThereForbiddenCharacters,
	getFileNameWithoutExt,
	getPathWithNewName,
} from '../utils';

export default class FMController {
	constructor(
		private readonly _fmRepository: IFMRepository,
		private readonly _rootDirPath: string,
	) {}

	private readonly _cacheDirName = 'cache';

	private _checkPathStartsWithRoot = (pathTo: string) =>
		pathTo.startsWith(this._rootDirPath);

	private _toAbsolutePath = (dirPath: string) =>
		path.join(
			this._rootDirPath,
			...path
				.join(...dirPath.split('/'))
				.split(path.sep)
				.slice(1),
		);

	private _sendError = (res: Response, code: number, args: string[] | null = null) => {
		res.json({
			data: null,
			error: {
				args,
				code,
				files: null,
			},
		});
	};

	dirList = async (_: Request, res: Response) => {
		let isDirExists = fs.existsSync(this._rootDirPath) && fs.lstatSync(this._rootDirPath).isDirectory();

		if (!isDirExists) {
			return this._sendError(res, FMErrorMessage.ROOT_DIR_DOES_NOT_EXIST);
		}

		const dirList = await this._fmRepository.getDirectories(this._rootDirPath);
		const pathToCut = path.dirname(this._rootDirPath);

		const data = (await Promise.all(
			dirList.map(async (dirPath) => {
				if (
					dirPath.includes(path.join(this._rootDirPath, this._cacheDirName)) ||
					dirPath.includes(path.join(this._rootDirPath, 'tmp'))
				) {
					return;
				}

				return {
					d: await this._fmRepository.countDirectories(dirPath),
					f: await this._fmRepository.countFiles(dirPath),
					p: dirPath
						.replace(pathToCut, '')
						.split(path.sep)
						.join('/'),
				};
			}),
		)).filter((item) => Boolean(item)); // Для фильтрации вырезанных папок

		res.json({data, error: null});
	};

	dirCreate = async (req: Request, res: Response) => {
		const {d: dirPath, n: name} = req.body;

		if (areThereForbiddenCharacters(name)) {
			return this._sendError(res, FMErrorMessage.DIR_NAME_CONTAINS_INVALID_SYMBOLS);
		}

		const absPath = this._toAbsolutePath(dirPath);

		if (!this._checkPathStartsWithRoot(absPath)) {
			return this._sendError(res, FMErrorMessage.UNABLE_TO_CREATE_DIRECTORY);
		}

		try {
			await this._fmRepository.createDirectory(absPath, name);

			res.json({data: true, error: null});
		} catch (error) {
			this._sendError(res, FMErrorMessage.UNABLE_TO_CREATE_DIRECTORY);
		}
	};

	dirRename = async (req: Request, res: Response) => {
		const {d: dirPath, n: name} = req.body;

		if (areThereForbiddenCharacters(name)) {
			return this._sendError(res, FMErrorMessage.DIR_NAME_CONTAINS_INVALID_SYMBOLS);
		}

		const absPath = this._toAbsolutePath(dirPath);

		if (!this._checkPathStartsWithRoot(absPath)) {
			return this._sendError(res, FMErrorMessage.UNABLE_TO_CREATE_DIRECTORY);
		}

		try {
			await this._fmRepository.renameDirectory(absPath, name);

			res.json({data: true, error: null});
		} catch (error) {
			if (['ENOTEMPTY', 'EEXIST', 'EPERM', 'EACCES'].includes(error.code)) {
				return this._sendError(res, FMErrorMessage.FILE_ALREADY_EXISTS, [name]);
			}

			this._sendError(res, FMErrorMessage.UNABLE_TO_RENAME);
		}
	};

	dirDelete = async (req: Request, res: Response) => {
		const {d: dirPath} = req.body;
		const absPath = this._toAbsolutePath(dirPath);

		if (absPath === this._rootDirPath || !this._checkPathStartsWithRoot(absPath)) {
			return this._sendError(res, FMErrorMessage.UNABLE_TO_DELETE_DIRECTORY);
		}

		try {
			await this._fmRepository.removeDirectory(absPath);

			res.json({data: true, error: null});
		} catch (error) {
			this._sendError(res, FMErrorMessage.UNABLE_TO_DELETE_DIRECTORY);
		}
	};

	dirCopy = async (req: Request, res: Response) => {
		const {d: dirPath, n: newPath} = req.body;

		const absDirPath = this._toAbsolutePath(dirPath);
		const absNewPath = this._toAbsolutePath(newPath);

		if (!this._checkPathStartsWithRoot(absDirPath) ||
			!this._checkPathStartsWithRoot(absNewPath))
		{
			return this._sendError(res, FMErrorMessage.ERROR_ON_MOVING_FILES);
		}

		try {
			await this._fmRepository.copyDirectory(
				absDirPath,
				path.join(absNewPath, getTitle(dirPath)),
			);

			res.json({data: true, error: null});
		} catch (error) {
			this._sendError(res, FMErrorMessage.ERROR_ON_COPYING_FILES);
		}
	};

	dirMove = async (req: Request, res: Response) => {
		const {d: dirPath, n: newPath} = req.body;

		const absDirPath = this._toAbsolutePath(dirPath);
		const absNewPath = this._toAbsolutePath(newPath);

		if (!this._checkPathStartsWithRoot(absDirPath) ||
			!this._checkPathStartsWithRoot(absNewPath))
		{
			return this._sendError(res, FMErrorMessage.ERROR_ON_MOVING_FILES);
		}

		try {
			await this._fmRepository.moveDirectory(
				absDirPath,
				path.join(absNewPath, getTitle(dirPath)),
			);

			res.json({data: true, error: null});
		} catch (error) {
			this._sendError(res, FMErrorMessage.ERROR_ON_MOVING_FILES);
		}
	};

	dirDownload = async (req: Request, res: Response) => {
		const {d: dirPath} = req.query;

		const dirAbsolutePath = this._toAbsolutePath(dirPath);

		if (!this._fmRepository.isDirectoryOrFileExists(dirAbsolutePath) ||
			!this._checkPathStartsWithRoot(dirAbsolutePath))
		{
			res.sendStatus(404);
			return;
		}

		res.attachment(`${getTitle(dirPath)}.zip`);

		try {
			await this._fmRepository.downloadDirectory(dirAbsolutePath, res);
		}
		catch (e) {
			res.sendStatus(500);
		}
	};

	fileList = async (req: Request, res: Response) => {
		const {d: dirPath} = req.body;
		const absDirPath = this._toAbsolutePath(dirPath);

		if (!this._checkPathStartsWithRoot(absDirPath)) {
			return this._sendError(res, FMErrorMessage.UNABLE_TO_CREATE_DIRECTORY);
		}

		if (!(await this._fmRepository.isDirectoryOrFileExists(absDirPath))) {
			return this._sendError(res, FMErrorMessage.DIR_DOES_NOT_EXIST, [dirPath]);
		}

		try {
			const fileList = await this._fmRepository.getFiles(absDirPath);
			const pathToCut = path.dirname(this._rootDirPath);

			const data = await Promise.all(
				fileList.map(async (filePath) => ({
					h: null,
					p: filePath.replace(pathToCut, '')
						.split(path.sep)
						.join('/'),
					s: await this._fmRepository.getFileSize(filePath),
					t: await this._fmRepository.getFileCreationTime(filePath),
					w: null,
				})),
			);

			res.json({data, error: null});
		} catch (error) {
			return this._sendError(res, FMErrorMessage.DIR_CANNOT_BE_READ);
		}
	};

	fileDelete = async (req: Request, res: Response) => {
		const {fs: filePaths} = req.body;
		const filePathsList = (filePaths as string).split('|');

		if (
			filePathsList.some((filePath) => {
				const absPath = this._toAbsolutePath(filePath);

				return !this._fmRepository.isDirectoryOrFileExists(absPath) ||
					!this._checkPathStartsWithRoot(absPath);
			})
		) {
			return this._sendError(
				res,
				FMErrorMessage.UNABLE_TO_DELETE_FILE,
				filePathsList.map(getLastDir)
			);
		}

		try {
			await Promise.all(
				filePathsList.map( (filePath) => {
					this._fmRepository.removeFile(this._toAbsolutePath(filePath));
				}),
			);

			res.json({data: true, error: null});
		} catch (error) {
			this._sendError(res, FMErrorMessage.UNABLE_TO_DELETE_FILE);
		}
	};

	fileCopy = async (req: Request, res: Response) => {
		const {fs: filePaths, n: newPath} = req.body;
		const filePathsList = (filePaths as string).split('|');

		if (
			filePathsList.some((filePath) => {
				const absPath = this._toAbsolutePath(filePath);

				return !this._fmRepository.isDirectoryOrFileExists(absPath) ||
					!this._checkPathStartsWithRoot(absPath);
			})
		) {
			return this._sendError(res, FMErrorMessage.ERROR_ON_COPYING_FILES);
		}

		const absNewPath = this._toAbsolutePath(newPath);

		if (!this._checkPathStartsWithRoot(absNewPath)) {
			return this._sendError(res, FMErrorMessage.ERROR_ON_COPYING_FILES);
		}

		try {
			await Promise.all(
				(filePaths as string).split('|').map( (filePath) => (
					this._fmRepository.copyFile(
						this._toAbsolutePath(filePath),
						path.join(absNewPath, getLastDir(filePath)),
					)
				)),
			);

			res.json({data: true, error: null});
		} catch (error) {
			this._sendError(res, FMErrorMessage.ERROR_ON_COPYING_FILES);
		}
	};

	fileRename = async (req: Request, res: Response) => {
		const {f: filePath, n: name} = req.body;

		if (areThereForbiddenCharacters(getFileNameWithoutExt(name))) {
			return this._sendError(res, FMErrorMessage.DIR_NAME_CONTAINS_INVALID_SYMBOLS);
		}

		if (getFileNameWithoutExt(name) === '') {
			return this._sendError(res, FMErrorMessage.UNABLE_TO_RENAME);
		}

		const absFilePath = this._toAbsolutePath(filePath);

		if (
			await this._fmRepository.isDirectoryOrFileExists(
				getPathWithNewName(absFilePath, name),
			) || !this._checkPathStartsWithRoot(absFilePath)
		) {
			return this._sendError(res, FMErrorMessage.FILE_ALREADY_EXISTS, [name]);
		}

		try {
			await this._fmRepository.renameFile(absFilePath, name);

			res.json({data: true, error: null});
		} catch (error) {
			this._sendError(res, FMErrorMessage.UNABLE_TO_RENAME);
		}
	};

	fileMove = async (req: Request, res: Response) => {
		const {fs: filePaths, n: newPath} = req.body;
		const filePathsList = (filePaths as string).split('|');
		const absNewPath = this._toAbsolutePath(newPath);

		if (!this._checkPathStartsWithRoot(absNewPath)) {
			return this._sendError(res, FMErrorMessage.ERROR_ON_MOVING_FILES);
		}

		if (
			filePathsList.some((filePath) => {
				const absPath = this._toAbsolutePath(filePath);

				return !this._fmRepository.isDirectoryOrFileExists(absPath) ||
					!this._checkPathStartsWithRoot(absPath);
			})
		) {
			return this._sendError(res, FMErrorMessage.ERROR_ON_MOVING_FILES);
		}

		try {
			await Promise.all(
				filePathsList.map( (filePath) => {
					this._fmRepository.moveFile(
						this._toAbsolutePath(filePath),
						path.join(this._toAbsolutePath(newPath), getLastDir(filePath)),
					);
				}),
			);

			res.json({data: true, error: null});
		} catch (error) {
			this._sendError(res, FMErrorMessage.ERROR_ON_MOVING_FILES);
		}
	};

	fileOriginal = async (req: Request, res: Response) => {
		const {f: filePath} = req.query;
		const fileAbsolutePath = this._toAbsolutePath(filePath);

		if (!this._fmRepository.isDirectoryOrFileExists(fileAbsolutePath) ||
			!this._checkPathStartsWithRoot(fileAbsolutePath)
		) {
			res.sendStatus(404);
			return;
		}

		try {
			const ext = path.extname(filePath);

			if (ext !== '.gif' && ext !== '.png' && ext !== '.jpg' && ext !== '.jpeg') {
				res.sendStatus(415);

				return;
			}
			res.setHeader('Content-Type', `image/${ext.replace('.', '')}`);
			res.setHeader('Content-Length', await this._fmRepository.getFileSize(fileAbsolutePath));
			res.send(await this._fmRepository.getImageOriginal(fileAbsolutePath));
		} catch (error) {
			res.sendStatus(500);
		}
	};

	filePreview = async (req: Request, res: Response) => {
		const {f: filePath, width, height} = req.query;
		const fileAbsolutePath = this._toAbsolutePath(filePath);

		if (!this._fmRepository.isDirectoryOrFileExists(fileAbsolutePath) ||
			!this._checkPathStartsWithRoot(fileAbsolutePath)
		) {
			res.sendStatus(404);
			return;
		}

		try {
			if (!this._fmRepository.isDirectoryOrFileExists(fileAbsolutePath)) {
				res.sendStatus(404);

				return;
			}

			const ext = path.extname(filePath);

			if (ext !== '.gif' && ext !== '.png' && ext !== '.jpg' && ext !== '.jpeg') {
				res.sendStatus(415);

				return;
			}
			res.setHeader('Content-Type', `image/${ext.replace('.', '')}`);
			res.setHeader('Content-Length', await this._fmRepository.getFileSize(fileAbsolutePath));
			res.send(
				await this._fmRepository.getImagePreview(
					fileAbsolutePath,
					parseInt(width),
					parseInt(height),
					path.join(this._rootDirPath, this._cacheDirName),
				),
			);
		} catch (error) {
			res.sendStatus(500);
		}
	};
}
