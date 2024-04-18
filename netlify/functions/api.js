// const serverless = require('serverless-http');

// require('@babel/register');

// const app        = require('../../app');

// module.exports.handler = serverless(app);

import serverless from 'serverless-http';
import app        from '../../app.ts';

export const handler = serverless(app);

