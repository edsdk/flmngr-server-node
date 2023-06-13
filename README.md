## THIS REPO IS DEPRECATED. PLEASE MIGRATE TO THE NEW VERSION OF FLMNGR BACKEND AVAILABLE IN A SET OF PACKAGES:

- [@flmngr/flmngr-server-node](https://github.com/flmngr/flmngr-server-node) - base file manager server side (a library)
- [@flmngr/flmngr-server-node-express](https://github.com/flmngr/flmngr-server-node-express) - ExpressJS module
- [@flmngr/flmngr-server-node-nest-express](https://github.com/flmngr/flmngr-server-node-nest-express) - NestJS module
- [@flmngr/flmngr-server-microservice](https://github.com/flmngr/flmngr-server-microservice) - standalone server for a command line


> We recommend you start from the **[index page](https://flmngr.com/doc/install-file-manager-server-node)** for all Flmngr Node.js backends

*The text below is an archive copy of readme file of the old package.*

---

# Flmngr server

Flmngr allows you to browse and upload the files onto the server. This package provides Node backend support for Flmngr as TypeScript/JavaScript library.

## Install

With NPM installed, run

```
$ npm install @edsdk/flmngr-server
```

Yarn users can run

```
$ yarn add @edsdk/flmngr-server
```


## Usage


### Using inside your own Express server

Bind required URL in your application in this way:

```js
import express from 'express';
import bindFlmngr from '@edsdk/flmngr-server';

const app = express();

bindFlmngr({
    app: app,              // your Express application
    url: '/flmngr',        // URL to handle
    dir: '/var/www/files', // where files are stored into
    config: {}             // optional config
});
```

If you want to allow access to uploaded files (usually you do) then write something like:

```js
app.use(express.static('/var/www/files'));
```

Please also see [example of usage](https://github.com/edsdk/flmngr-example) Flmngr for browsing and uploading files.


### Running as microservice instance

If you do not have your own Express server, you can run Flmngr as microservice.
This means it will create new Express instance, do all required bindings and start to listen incoming requests.

```js
require("@edsdk/flmngr-server").startFlmngrMicroservice({
    host: 'localhost',
    port: 8080,
    url: '/flmngr',
    dirFiles: './www/files',
    dirRoot: './www'
});
```

The code above will:

- Listen `http://localhost:8080/flmngr` and response to frontend of  Flmngr with requested info. It will also use URL `http://localhost:8080/flmngr/uploader` for handling file uploads.
- Save uploaded files to `./www/files` directory
- Serve `./www` directory as public in order to allow accessing uploaded files by there URLs.

If you do not wish to share all files you can set `dirRoot: null`. This can be useful if this server has only Flmngr installed but all files really are mounted from another server and those server's URL will be used for generating files URLs too.

See [sample of usage](https://github.com/edsdk/flmngr-example) of Flmngr microservice together with [Flmngr](https://flmngr.com) file manager.


## Server languages support

Current package is targeted to serve uploads inside Express server in Node environment.

If you need another backend support, please purchase [Flmngr](https://flmngr.com).
Currently there are available server side modules for:

- Node (TypeScript/JavaScript)
- PHP
- Java



## See Also

- Website: [flmngr.com](https://flmngr.com)
- Flmngr frontend package: [npm package](https://npmjs.org/package/@edsdk/flmngr)  |  [GitHub project](https://github.com/edsdk/flmngr)
- Flmngr example: [npm package](https://npmjs.org/package/@edsdk/flmngr-example)  |  [GitHub project](https://github.com/edsdk/flmngr-example)


## License

Double licensing with EdSDK licenses family.
See [https://flmngr.com] for details.