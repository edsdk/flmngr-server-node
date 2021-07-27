export interface IConfig {

    setTestConfig(testConf: {[key: string]: string}): void;

    getBaseDir(): string;
    getTmpDir(): string;

    getMaxUploadFileSize(): number;
    getAllowedExtensions(): string[];
    getJpegQuality(): number;

    getMaxImageResizeWidth(): number;
    getMaxImageResizeHeight(): number;

    getCrossDomainUrl(): string;

    doKeepUploads(): boolean;

    isTestAllowed(): boolean;

    getRelocateFromHosts(): string[];

}