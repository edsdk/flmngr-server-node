[![Flmngr file manager logo](https://flmngr.com/img/logo/64px/Flmngr.png)](https://flmngr.com)

# Flmngr Node backend

> Server-side part of the Flmngr file manager for Node.js, as a library

[![Flmngr file manager screenshot](https://flmngr.com/img/browsing.jpg)](https://flmngr.com)

[Flmngr file manager](https://flmngr.com) is used to upload and manage files and images. Can be a standalone file manager (React/Angular/etc. or custom JavaScript or TypeScript integrations) or work together with [TinyMCE](https://flmngr.com/doc/install-tinymce-plugin), [CKEditor&nbsp;4](https://flmngr.com/doc/install-ckeditor-plugin), [CKEditor&nbsp;5](https://flmngr.com/doc/install-ckeditor-5-plugin), [N1ED](https://n1ed.com), or any other JS components.

This package handles the requests the file manager sends to a single URL of your Node server: directory listings, uploads, previews, resizes, renames and so on. It behaves exactly like the [PHP backend](https://github.com/edsdk/flmngr-server-php): the two are kept in step request by request.

## This is a library

Use it directly when there is no ready-made module for your framework. Otherwise take one of these:

- **Backend library** (you are here) — [custom integration manual](https://flmngr.com/doc/install-file-manager-server-node-custom)
- [Express module](https://flmngr.com/doc/install-file-manager-server-node-express) — `@edsdk/flmngr-server-node-express`
- [Nest module](https://flmngr.com/doc/install-file-manager-server-node-nest) — `@edsdk/flmngr-server-node-nest-express`
- [Standalone server](https://flmngr.com/doc/install-file-manager-server-microservice) — nothing to code, runs from a config file

## Install

Node.js 18.17 or newer. In the directory of your project:

```
npm i @edsdk/flmngr-server-node --save
```

Then follow the [integration manual](https://flmngr.com/doc/install-file-manager-server-node-custom) to route requests from your app to it.

## Usage

```js
import {FlmngrServer} from "@edsdk/flmngr-server-node";

// inside the handler of the URL you chose for the file manager:
await FlmngrServer.flmngrRequest(
    {
        dirFiles: "/var/www/files",          // the storage directory
        // dirCache: "/var/www/files/.cache", // previews and file info; this is the default
        // maxUploadSize: "100M",             // no limit by default
        request: yourRequestAdapter           // reads method, query, body fields and files
    },
    {
        onFinish: (status, headers, body) => { /* send status, headers and the body (a string, an object as JSON, or a stream) */ },
        onLogError: (message) => console.error(message),
    }
);
```

The options, all optional but `dirFiles`:

| option | default | meaning |
|---|---|---|
| `dirFiles` | — | the directory with the files the user manages |
| `dirCache` | `dirFiles/.cache` | where previews and file info are kept |
| `dirTmp` | the system temp dir | where an upload sits while a request runs |
| `dirPermissions` | `0o755` | mode of the directories the library creates |
| `denyFilePatterns` | scripts, server config files, HTML | file names that can not be uploaded or renamed to (fnmatch patterns, case-insensitive) |
| `doUpscalePreviews` | `false` | stretch small images to fill the preview box |
| `maxUploadSize` | no limit | the biggest request accepted, in bytes or with a k/m/g suffix |
| `onLogError` | — | where errors are logged |
| `messageExceptionLogger` | — | called instead of the default logging when a request ends with an error the client gets |

SVG files are sanitized on upload and on rename; CORS, authentication and CSRF protection are the job of your app around this library.

## See Also

- [Flmngr](https://flmngr.com) - Flmngr file manager.
- [Flmngr Node backends](https://flmngr.com/doc/install-file-manager-server-node) - the index of all Node packages.
- [Flmngr demos](https://codeplay.democdn.com/flmngr) - collection of JS samples on CodePlay.
- [Flmngr API](https://flmngr.com/doc/api) - API of Flmngr client.
- [N1ED](https://n1ed.com) - a website content builder with Flmngr file manager aboard, also works as a plugin for CKEditor 4, TinyMCE, which has modules for different CMSs.

## License

GNU General Public License v3 or later; see LICENSE.txt
