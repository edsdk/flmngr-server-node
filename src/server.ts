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

app.use(errorHandler());
app.set('port', process.env.PORT || 3000);
app.use(morgan('combined'));
app.use(compression());

app.use('/api', (_: Request, res: Response, next: NextFunction): void => {
	res.header('Access-Control-Allow-Origin', '*');
	res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
	next();
});

bindFlmngr({app, url: '/api', dir: process.env.UPLOAD_DIR_PATH!});

app.use(express.static(process.env.UPLOAD_DIR_PATH!));

app.listen(app.get('port'), () => {
	console.log(
		'  App is running at http://localhost:%d in %s mode',
		app.get('port'),
		app.get('env'),
	);
	console.log('  Press CTRL-C to stop\n');
});
