import type { IncomingMessage, ServerResponse } from 'node:http';
import { AppError, badRequest, notFound } from '../errors';
import { CommandCenterService } from '../services/commandCenterService';
import { EngagementConfigService } from '../services/engagementConfigService';
import { LegalEntityService } from '../services/legalEntityService';

/**
 * Thin HTTP adapter: parse → call a service → serialise. No business rules here.
 * Base path /api/v1, per docs/design/LLD.md §5.
 * NOTE: no authentication yet — put the JWT check in `handle` before routing.
 */

const entities = new LegalEntityService();
const configs = new EngagementConfigService();
const commandCenter = new CommandCenterService();

const MAX_BODY = 5 * 1024 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const c of req) {
    size += (c as Buffer).length;
    if (size > MAX_BODY) throw new AppError(413, 'PAYLOAD_TOO_LARGE', 'Request body is too large');
    chunks.push(c as Buffer);
  }
  if (!chunks.length) return undefined;
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw badRequest('Body is not valid JSON');
  }
}

function send(res: ServerResponse, status: number, body?: unknown) {
  if (body === undefined) {
    res.writeHead(status).end();
    return;
  }
  res.writeHead(status, { 'Content-Type': 'application/json' }).end(JSON.stringify(body));
}

async function route(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const m = /^\/api\/v1\/engagements\/([^/]+)\/(entities|configs|summary)(?:\/([^/]+))?$/.exec(url.pathname);
  if (!m) throw notFound('No such route');
  const [, engagementId, resource, rawCode] = m;
  if (!UUID.test(engagementId)) throw badRequest('Engagement id must be a UUID');
  const code = rawCode ? decodeURIComponent(rawCode) : undefined;
  const method = req.method ?? 'GET';

  if (resource === 'summary' && !code && method === 'GET') {
    return send(res, 200, await commandCenter.setupSummary(engagementId));
  }
  if (resource === 'configs' && !code) {
    if (method === 'GET') return send(res, 200, await configs.list(engagementId));
    if (method === 'PUT') return send(res, 200, await configs.save(engagementId, await readJson(req)));
  }
  if (resource === 'configs' && code && method === 'DELETE') {
    return void (await configs.remove(engagementId, code), send(res, 204));
  }
  if (resource === 'entities') {
    if (!code) {
      if (method === 'GET') return send(res, 200, await entities.list(engagementId));
      if (method === 'POST') return send(res, 201, await entities.create(engagementId, await readJson(req)));
    } else if (code === 'import') {
      if (method === 'POST') return send(res, 200, await entities.importMany(engagementId, await readJson(req)));
    } else {
      if (method === 'PATCH') return send(res, 200, await entities.update(engagementId, code, await readJson(req)));
      if (method === 'DELETE') return void (await entities.remove(engagementId, code), send(res, 204));
    }
  }
  throw new AppError(405, 'METHOD_NOT_ALLOWED', `${method} is not supported here`);
}

export async function handle(req: IncomingMessage, res: ServerResponse) {
  try {
    await route(req, res);
  } catch (e) {
    if (e instanceof AppError) {
      send(res, e.status, { error: { code: e.code, message: e.message, details: e.details } });
    } else {
      console.error(e); // full detail stays in the log; the client gets nothing about SQL or internals
      send(res, 500, { error: { code: 'INTERNAL', message: 'Something went wrong' } });
    }
  }
}
