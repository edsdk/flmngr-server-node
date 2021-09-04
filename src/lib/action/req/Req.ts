export interface Req {

    "action": string;

    "test_clearAllFiles"?: boolean;
    "test_serverConfig"?: {[key: string]: string};

    "m_fileName"?: string;
    "m_fileSize"?: number;
    "m_file"?: Buffer;

}