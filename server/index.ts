import { createServer } from 'node:http';
import { config } from './config';
import { pool } from './db/pool';
import { handle } from './http/router';

const server = createServer(handle);
server.listen(config.port, () => console.log(`Fusion Close API on http://localhost:${config.port}/api/v1`));

const shutdown = () => server.close(() => pool.end().then(() => process.exit(0)));
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
