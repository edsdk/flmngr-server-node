import {Writable} from 'stream';

export interface IFMRepository {
	getDirectories: (path: string) => Promise<string[]>;
	createDirectory: (dirPath: string, name: string) => Promise<void>;
	removeDirectory: (dirPath: string) => Promise<void>;
	copyDirectory: (dirPath: string, newPath: string) => Promise<void>;
	renameDirectory: (dirPath: string, newName: string) => Promise<void>;
	moveDirectory: (dirPath: string, newPath: string) => Promise<void>;
	downloadDirectory: (dirPath: string, out: Writable) => Promise<void>;
	countFiles: (dirPath: string) => Promise<number>;
	countDirectories: (dirPath: string) => Promise<number>;
	getFiles: (dirPath: string) => Promise<string[]>;
	getFileSize: (filePath: string) => Promise<number>;
	getFileCreationTime: (filePath: string) => Promise<number>;
	removeFile: (filePath: string) => Promise<void>;
	copyFile: (filePath: string, newPath: string) => Promise<void>;
	renameFile: (filePath: string, newName: string) => Promise<void>;
	moveFile: (filePath: string, newPath: string) => Promise<void>;
	isDirectoryOrFileExists: (dirPath: string) => boolean;
	getImagePreview: (
		filePath: string,
		height: number,
		width: number,
		cachePath: string,
	) => Promise<Buffer>;
	getImageOriginal: (filePath: string) => Promise<Buffer>;
}
