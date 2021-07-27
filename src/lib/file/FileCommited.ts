import {IConfig} from "../config/IConfig";
import {AFile} from "../file/AFile";
import {Size} from "../action/req/ReqUploadCommit";
import * as fsx from "fs-extra"
import {Utils} from "../file/Utils";
import {Message} from "../action/resp/Message";
import {MessageException} from "../MessageException";
import * as gm from "gm";

export class FileCommited extends AFile {

    protected static readonly SIZE_PREVIEW = "preview";
    protected static readonly SIZE_FULL = "full";

    protected m_modificationName: string = '';

    constructor(config: IConfig, dir: string, name: string) {
        super(config, dir, name);
    }

    public getBaseDir(): string { return this.m_config.getBaseDir(); }

    protected getFileModification(modificationName: string): FileCommited {
        if (!this.isImage() || this.m_mainFile != null)
            throw new Error("Illegal argument");
        let name: string = this.getNameWithoutExt() + "-" + modificationName + "." + this.getExt();
        let file: FileCommited = new FileCommited(this.m_config, this.getDir(), name);
        file.m_modificationName = modificationName;
        file.m_mainFile = this;
        return file;
    }

    public getFileOriginal(): FileCommited { return this.getFileModification("original"); }
    public getFilePreview(): FileCommited { return this.getFileModification("preview"); }

    public getModificationName(): string { return this.m_modificationName; }

    public getModifications(): AFile[] {
        let modifications: AFile[] = [];
        let f: FileCommited = this.getFilePreview();
        if (f.exists())
            modifications.push(f);
        f = this.getFileOriginal();
        if (f.exists())
            modifications.push(f);
        return modifications;
    }

    public applySizes(sizes: {[key: string]: Size}, onFinish: (e: Error) => void) {
        try {
            if (!this.isImage()) {
                onFinish(null as any);
                return;
            }

            let currPreviewWidth = -1;
            let currPreviewHeight = -1;
            let filePreview: FileCommited = this.getFilePreview();
            if (filePreview.exists()) {
                currPreviewWidth = filePreview.getImageWidth();
                currPreviewHeight = filePreview.getImageHeight();
            }

            let currFullWidth = this.getImageWidth();
            let currFullHeight = this.getImageHeight();

            let fileOriginal: FileCommited = this.getFileOriginal();
            let fileOriginalOrFull: FileCommited = this;
            if (fileOriginal.exists())
                fileOriginalOrFull = fileOriginal;

            let currOriginalWidth = fileOriginalOrFull.getImageWidth();
            let currOriginalHeight = fileOriginalOrFull.getImageHeight();

            this.applySizePreview(
                filePreview,
                fileOriginalOrFull,
                currPreviewWidth,
                currPreviewHeight,
                currOriginalWidth,
                currOriginalHeight,
                sizes,
                (e: Error|number) => {

                    if (e != null && e !== -1) {
                        onFinish(e as Error);
                        return;
                    }
                    this.applySizeFull(
                        fileOriginal,
                        currFullWidth,
                        currFullHeight,
                        currOriginalWidth,
                        currOriginalHeight,
                        sizes,
                        (e: Error) => {

                            if (e != null) {
                                onFinish(e);
                                return;
                            }

                            onFinish(null as any);

                        }
                    );

                }
            );


        } catch (e) {
            onFinish(e);
        }
    }

    private applySizeFull(
        fileOriginal: FileCommited,
        currFullWidth: number,
        currFullHeight: number,
        currOriginalWidth: number,
        currOriginalHeight: number,
        sizes: {[key: string]: Size},
        onFinish: (e: Error) => void
    ) {
        let doResizeFull: boolean = false;
        let targetSize: Size = sizes[FileCommited.SIZE_FULL];
        if (FileCommited.SIZE_FULL in sizes) {
            if (targetSize["width"] !== currFullWidth || targetSize["height"] !== currFullHeight)
                if (targetSize["width"] > 0 || targetSize["height"] > 0)
                    if ((targetSize["width"] < currOriginalWidth || targetSize["height"] < currOriginalHeight) || targetSize["enlarge"])
                        doResizeFull = true;
        }

        if (doResizeFull) {
            try {

                let originalExisted: boolean = fileOriginal.exists();
                if (!originalExisted)
                    this.copyTo(fileOriginal);
                this.resizeImage(
                    targetSize,
                    (function () {
                        let _fileOriginal = fileOriginal;
                        let _originalExisted = originalExisted;
                        return (e: Error|number) => {
                            if (e) // error or -1
                                if (!originalExisted && _fileOriginal.exists())
                                    _fileOriginal.delete();
                            onFinish(e === -1 ? null as any : e as Error);
                        }
                    })()
                );
            } catch (e) {
                onFinish(e);
            }
        } else {
            onFinish(null as any);
        }
    }

    private applySizePreview(
        filePreview: FileCommited,
        fileOriginalOrFull: FileCommited,
        currPreviewWidth: number,
        currPreviewHeight: number,
        currOriginalWidth: number,
        currOriginalHeight: number,
        sizes: {[key: string]: Size},
        onFinish: (e: Error) => void
    ) {
        let doResizePreview = false;
        let targetSizePreview: Size = sizes[FileCommited.SIZE_PREVIEW];
        if (FileCommited.SIZE_PREVIEW in sizes) {
            if (!filePreview.exists())
                fileOriginalOrFull.copyTo(filePreview);
            if (targetSizePreview["width"] !== currPreviewWidth || targetSizePreview["height"] !== currPreviewHeight) // Target size differs from current
                if (targetSizePreview["width"] > 0 || targetSizePreview["height"] > 0) // not fully auto
                    if ((targetSizePreview["width"] < currOriginalWidth || targetSizePreview["height"] < currOriginalHeight) || targetSizePreview["enlarge"]) // We reduce size of image or have enlarge allowed
                        doResizePreview = true;
        }

        if (doResizePreview) {
            try {
                filePreview.resizeImage(targetSizePreview, (e: Error|number) => {
                    onFinish(e === -1 ? null as any : e as Error);
                });
            } catch (e) {
                onFinish(e);
            }
        } else {
            onFinish(null as any);
        }
    }

    public getSizes(): string[] {
        let thisFile: string = this.getFile();
        let thisName: string = this.getNameWithoutExt();

        let dir: string = this.getBaseDir() + "/" + this.getDir();

        let files: string[] = fsx.readdirSync(dir);
        let sizes: string[] = [];
        for (let i=0; i<files.length; i++) {
            let file: string = files[i];
            let name = Utils.getNameWithoutExt(file);
            if ((thisFile !== file) && name.indexOf(thisName + "-") === 0)
                sizes.push(name.substr(thisName.length + 1));
        }
        return sizes;
    }

    public resizeImage(targetSize: Size, onFinish: (e: Error|number) => void): void {
        if (this.m_config.getMaxImageResizeWidth() > 0 && targetSize["width"] > this.m_config.getMaxImageResizeWidth()) {
            onFinish(
                new MessageException(
                    Message.createMessage(
                        Message.MAX_RESIZE_WIDTH_EXCEEDED,
                        targetSize["width"].toString(),
                        this.getName(),
                        this.m_config.getMaxImageResizeWidth().toString()
                    )
                )
            );
            return;
        }


        if (this.m_config.getMaxImageResizeHeight() > 0 && targetSize["height"] > this.m_config.getMaxImageResizeHeight()) {
            onFinish(
                new MessageException(
                    Message.createMessage(
                        Message.MAX_RESIZE_HEIGHT_EXCEEDED,
                        targetSize["height"].toString(),
                        this.getName(),
                        this.m_config.getMaxImageResizeHeight().toString()
                    )
                )
            );
            return;
        }

        let fileSrc: FileCommited = this;
        if (this.m_mainFile != null) // if this is just a size of main file
            fileSrc = this.m_mainFile;
        let fileOriginal: FileCommited = fileSrc.getFileOriginal();
        if (fileOriginal.exists())
            fileSrc = fileOriginal;

        let imageWidth = this.getImageWidth();
        let imageHeight = this.getImageHeight();

        if (targetSize["width"] === 0 && targetSize["height"] === 0) {
            onFinish(null as any);
            return;
        }
        if (targetSize["width"] === 0 && targetSize["height"] === imageHeight) {
            onFinish(null as any);
            return;
        }
        if (targetSize["height"] === 0 && targetSize["width"] === imageWidth) {
            onFinish(null as any);
            return;
        }
        if (targetSize["width"] > 0 && targetSize["height"] > 0 && targetSize["width"] === imageWidth && targetSize["height"] === imageHeight) {
            onFinish(null as any);
            return;
        }

        // Calc full target size of image (with paddings)
        let scaleWWithPadding = -1;
        let scaleHWithPadding = -1;
        if (targetSize["width"] > 0 && targetSize["height"] > 0) {
            scaleWWithPadding = targetSize["width"];
            scaleHWithPadding = targetSize["height"];
        } else if (targetSize["width"] > 0) {
            scaleWWithPadding = targetSize["width"];
            scaleHWithPadding = Math.floor((scaleWWithPadding / imageWidth) * imageHeight);
        } else if (targetSize["height"] > 0) {
            scaleHWithPadding = targetSize["height"];
            scaleWWithPadding = Math.floor((scaleHWithPadding / imageHeight) * imageWidth);
        }

        if ((scaleWWithPadding > imageWidth || scaleHWithPadding > imageHeight) && !targetSize["enlarge"]) {
            scaleWWithPadding = imageWidth;
            scaleHWithPadding = imageHeight;
        }

        // Check we have not exceeded max width/height
        if (
            (this.m_config.getMaxImageResizeWidth() > 0 && scaleWWithPadding > this.m_config.getMaxImageResizeWidth())
            ||
            (this.m_config.getMaxImageResizeHeight() > 0 && scaleHWithPadding > this.m_config.getMaxImageResizeHeight())
        ){
            let coef = Math.max(
                scaleWWithPadding / this.m_config.getMaxImageResizeWidth(),
                scaleHWithPadding / this.m_config.getMaxImageResizeHeight()
            );
            scaleWWithPadding = Math.floor(scaleWWithPadding / coef);
            scaleHWithPadding = Math.floor(scaleHWithPadding / coef);
        }

        // Calc actual size of image (without paddings)
        let scaleW = -1;
        let scaleH = -1;
        if (scaleWWithPadding / imageWidth < scaleHWithPadding / imageHeight) {
            scaleW = scaleWWithPadding;
            scaleH = Math.floor((scaleW / imageWidth) * imageHeight);
        } else {
            scaleH = scaleHWithPadding;
            scaleW = Math.floor((scaleH / imageHeight) * imageWidth);
        }

        if (scaleWWithPadding === imageWidth && scaleW === imageWidth && scaleHWithPadding === imageHeight && scaleH === imageHeight) {
            onFinish(-1); // no resize is needed
            return;
        }

        let fitMode = FileCommited.FIT_EXACT;
        if (targetSize["width"] === 0)
            fitMode = FileCommited.FIT_TO_HEIGHT;
        else if (targetSize["height"] === 0)
            fitMode = FileCommited.FIT_TO_WIDTH;


        if (scaleWWithPadding > scaleW || scaleHWithPadding > scaleH) {
            scaleW = scaleWWithPadding;
            scaleH = scaleHWithPadding;
        }

        this
          .resizeImageNative(this.getImage(), scaleW, scaleH, fitMode)
          .write(
              this.getImage(),
              (err: Error | any, stdout: string| any, stderr: string| any, cmd: string | any): any => {
                  if (err) {
                      onFinish(new MessageException(Message.createMessage(Message.UNABLE_TO_WRITE_IMAGE_TO_FILE, this.getName())));
                  } else {
                      onFinish(null as any);
                  }
              }
          );
    }

    // fitMode: 0 - fit exact, 1 - fit to width, 2 - fit to height
    static readonly FIT_EXACT = 0;
    static readonly FIT_TO_WIDTH = 1;
    static readonly FIT_TO_HEIGHT = 2;
    private resizeImageNative(image: string, scaleW: number, scaleH: number, fitMode: number): gm.State {
        let newW = scaleW;
        let newH = scaleH;
        if (fitMode === FileCommited.FIT_TO_WIDTH) {
            newH = Math.round(newW * scaleH / scaleW);
        } else if (fitMode === FileCommited.FIT_TO_HEIGHT) {
            newW = Math.round(newH * scaleW / scaleH);
        }

        let newImage = gm.subClass({"imageMagick": true})(image);
        newImage.resize(newW, newH).gravity('Center').background('none').extent(newW, newH);
        return newImage;
    }

    public isCommited(): boolean {
        return true;
    }

}

