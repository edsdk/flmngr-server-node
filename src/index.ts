import express from 'express';
import bodyParser from 'body-parser';
import FileUploaderServer from '@edsdk/file-uploader-server';

import {createRouter} from './router';

export function bindFlmngr(config: {
	app: express.Express,
	url: string,
	dir: string,
	config?: {[key: string]: string}
}): void {
	config.app.use(config.url, bodyParser.json());
    config.app.use(config.url, bodyParser.urlencoded({extended: true}));

    let urlUploader = config.url + "/uploader";
    let configUploader: {[key: string]: any} = {
        app: config.app,
    	url: urlUploader,
    	dir: config.dir,
        config: config["uploader"]
	};

	FileUploaderServer.bindFileUploader({
		app: config.app,
		url: urlUploader,
		dir: config.dir,
		config: configUploader,
	});

    config.app.use(config.url, createRouter(config.dir));
}


export interface FlmngrMicroserviceConfig {
    host?: string, // host to listen
    port?: number, // port to listen
    url?: string,  // path only
    dirRoot?: string,    // dir to serve static content from
    dirFiles: string,    // dir of directory with files to upload into,
    config?: {[key: string]: string} // config to pass into file-manager-server
}

export function startFlmngrMicroservice(config: FlmngrMicroserviceConfig): Express.Application {

    // Create Express app
    let app = express();

    // Attach Flmngr
    bindFlmngr({
        app: app,
        url: config.url ? config.url : "/",
        dir: config.dirFiles,
        config: config.config
    });

    if (config.dirRoot)
        app.use(express.static(config.dirRoot)); // Serve HTML and CSS files from 'www' directory

    // Listen the 8080-th port on localhost
    app.listen(
        config.port ? config.port : 8080,
        config.host ? config.host : 'localhost',
        () => {
            // Server started successfully
            console.log("Flmngr microservice started on " + config.host + ":" + config.port);
        }
    );

    return app;
}