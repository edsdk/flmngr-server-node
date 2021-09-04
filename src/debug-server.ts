import errorHandler from 'errorhandler';
import morgan from 'morgan';
import compression from 'compression';
import express, {NextFunction, Request, Response} from 'express';
import dotenv from 'dotenv';

import {bindFlmngr} from './index';

// Create Express server
const app = express();

// Load environment variables from .env file, where API keys and passwords are configured
dotenv.config({path: '.env'});

if (!process.env.FLMNGR_PORT || !process.env.FLMNGR_URL_PATH || !process.env.FLMNGR_DIR) {
	console.log("See .env.sample, follow instructions and re-run this debug app.");
	process.exit(-1);
}

app.use(errorHandler());
app.set('port', process.env.FLMNGR_PORT);
app.use(morgan('combined'));
app.use(compression());

app.use('/api', (_: Request, res: Response, next: NextFunction): void => {
	res.header('Access-Control-Allow-Origin', '*');
	res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
	next();
});

bindFlmngr({app, url: process.env.FLMNGR_URL_PATH, dir: process.env.FLMNGR_DIR});

//app.use(express.static(process.env.FLMNGR_DIR));

app.listen(app.get('port'), () => {
	console.log(
		'  App is running at http://localhost:%d%s in %s mode',
		process.env.FLMNGR_PORT,
		process.env.FLMNGR_URL_PATH,
		process.env.FLMNGR_DIR,
	);
	console.log('  Press CTRL-C to stop\n');
});
