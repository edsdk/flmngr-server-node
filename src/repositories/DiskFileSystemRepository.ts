import fs from 'fs';
import path from 'path';
import {createHash} from 'crypto';
import {promisify} from 'util';
import fse from 'fs-extra';
import del from 'del';
import archiver from 'archiver';
import sharp from 'sharp';
import {Writable} from 'stream';

import {IFMRepository} from './FMRepository';
import {flatten, getPathWithNewName} from '../utils';

const asyncReaddir = promisify(fs.readdir);

export class DiskFileSystemRepository implements IFMRepository {
	private getDirsInDir = async (dirPath: string): Promise<string[]> => {
		return (await asyncReaddir(dirPath))
			.map((f) => path.join(dirPath, f))
			.filter((f) => fs.lstatSync(f).isDirectory())
	};

	getDirectories = async (dirPath: string): Promise<string[]> => {
		const dirList = await Promise.all(
			(await this.getDirsInDir(dirPath)).map(this.getDirectories),
		);

		return [dirPath, ...flatten(dirList)];
	};

	createDirectory = async (dirPath: string, name: string) => {
		await fse.mkdir(path.join(dirPath, name));
	};

	removeDirectory = async (dirPath: string) => {
		await del(dirPath, {force: true});
	};

	copyDirectory = async (dirPath: string, newPath: string) => {
		await fse.copy(dirPath, newPath);
	};

	renameDirectory = async (dirPath: string, newName: string) => {
		await fse.rename(dirPath, getPathWithNewName(dirPath, newName));
	};

	moveDirectory = async (dirPath: string, newPath: string) => {
		await fse.move(dirPath, newPath);
	};

	downloadDirectory = (dirPath: string, out: Writable) => {
		const zip = archiver('zip');

		return new Promise<void>((resolve, reject) => {
			zip.directory(dirPath, false).pipe(out);
			zip.on('error', reject);
			zip.on('end', () => resolve());
			zip.finalize();
		});
	};

	countFiles = async (dirPath: string) => {
		return (await asyncReaddir(dirPath))
			.map((f) => path.join(dirPath, f))
			.filter((f) => fs.lstatSync(f).isFile()).length;
	};

	countDirectories = async (dirPath: string) => {
		return (await asyncReaddir(dirPath))
			.filter(
				(f) => fs.lstatSync(path.join(dirPath, f)).isDirectory() &&
				!['tmp', 'cache'].includes(f)
			).length;
	};

	getFiles = async (dirPath: string) => {
		return (await asyncReaddir(dirPath))
			.filter((f) => fs.lstatSync(path.join(dirPath, f)).isFile())
			.map((f) => `${dirPath}/${f}`);
	};

	getFileSize = async (filePath: string) => (await fse.stat(filePath)).size;

	getFileCreationTime = async (filePath: string) =>
		Math.floor((await fse.stat(filePath)).birthtimeMs);

	removeFile = async (filePath: string) => {
		await del(filePath, {force: true});
	};

	copyFile = async (filePath: string, newPath: string) => {
		await fse.copy(filePath, newPath);
	};

	renameFile = async (filePath: string, newName: string) => {
		await fse.rename(filePath, getPathWithNewName(filePath, newName));
	};

	moveFile = async (filePath: string, newPath: string) => {
		await fse.move(filePath, newPath);
	};

	isDirectoryOrFileExists = (dirPath: string) => {
		return fse.pathExistsSync(dirPath);
	};

	getImageOriginal = async (filePath: string) => fse.readFile(filePath);

	getImagePreview = async (
		filePath: string,
		width: number,
		height: number,
		cachePath: string,
	) => {
		const cacheFileName = `${createHash('md5')
			.update(filePath + width + height)
			.digest('base64')}.jpg`;

		const fullPath = path.join(cachePath, cacheFileName);

		try {
			return await fse.readFile(fullPath);
		} catch (error) {
			const image = await sharp(await fse.readFile(filePath))
				.resize(width, height)
				.toBuffer();

			await fse.outputFile(fullPath, image);

			return image;
		}
	};
}
