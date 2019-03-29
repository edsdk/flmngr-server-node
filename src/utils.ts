import path from 'path';

import last from 'lodash/last';

export const flatten = <T>(lists: T[][]): T[] => {
	return lists.reduce((a, b) => a.concat(b), []);
};

export const getLastDir = (dirPath: string) => path.basename(dirPath);

export const getParentPath = (dirPath: string): string => path.dirname(dirPath);

export const getTitle = (dirPath: string): string => last(dirPath.split('/').slice(1))!;

export const areThereForbiddenCharacters = (name: string): boolean => /[/\\?%*:;|"<>. ]/.test(name);

export const getFileNameWithoutExt = (name: string): string => name.split('.')[0];

export const getPathWithNewName = (dirPath: string, name: string) => `${getParentPath(dirPath)}/${name}`;
