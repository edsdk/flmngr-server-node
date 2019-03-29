export interface IFileListDataItem {
	p: string; // путь до файла
	s: string; // размер файла в байтах
	t: string; // timestamp
	h: string; // высота, если файл - не изображение, то равно null
	w: string; // ширина, если файл - не изображение, то равно null
}

export interface IDirListDataItem {
	d: string; // количество папок в папке
	f: string; // количество файлов в папке
	p: string; // путь до папки
}

export interface IMessage {
	code: string;
	args?: number[];
}

export interface IResponse<T> {
	data: T;
	error: IMessage;
}
