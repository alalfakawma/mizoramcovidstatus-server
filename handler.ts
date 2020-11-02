import awsServerlessExpress from 'aws-serverless-express';
import app from './src/index';

const server = awsServerlessExpress.createServer(app);

exports.handler = (event: any, context: any) => {
    return awsServerlessExpress.proxy(server, event, context);
};
