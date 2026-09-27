import type { IncomingMessage, ServerResponse } from 'node:http';
import serverless from 'serverless-http';
import { createApp } from '../src/server/app.js';

type VercelRequest = IncomingMessage & { body?: unknown };
type VercelResponse = ServerResponse;

type LambdaEvent = {
  httpMethod: string;
  path: string;
  headers: Record<string, string>;
  queryStringParameters: Record<string, string> | null;
  body: string | Buffer | object;
  isBase64Encoded: boolean;
  requestContext: { identity: { sourceIp?: string }; requestId?: string };
};

type LambdaResult = {
  statusCode: number;
  isBase64Encoded: boolean;
  body: string;
  headers?: Record<string, string>;
  multiValueHeaders?: Record<string, string[]>;
};

const app = createApp();

const runServerless = serverless(app) as unknown as (
  event: LambdaEvent,
  context: Record<string, unknown>,
) => Promise<LambdaResult>;

function normalizeBody(body: unknown): string | Buffer | object {
  if (body === undefined || body === null) return '';
  if (Buffer.isBuffer(body)) return body;
  if (typeof body === 'string') return body;
  return JSON.stringify(body);
}

function toLambdaEvent(req: VercelRequest): LambdaEvent {
  const parsed = new URL(req.url ?? '/', 'http://vercel.local');

  const headers: Record<string, string> = {};
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    if (key === 'content-length' || key === 'transfer-encoding') continue;
    headers[key.toLowerCase()] = Array.isArray(value) ? value.join(', ') : value;
  }

  const queryStringParameters: Record<string, string> = {};
  for (const [key, value] of parsed.searchParams) queryStringParameters[key] = value;

  return {
    httpMethod: req.method ?? 'GET',
    path: parsed.pathname,
    headers,
    queryStringParameters: Object.keys(queryStringParameters).length > 0 ? queryStringParameters : null,
    body: normalizeBody(req.body),
    isBase64Encoded: false,
    requestContext: {
      identity: { sourceIp: req.socket?.remoteAddress },
      requestId: headers['x-request-id'],
    },
  };
}

function writeResult(res: VercelResponse, result: LambdaResult): void {
  res.statusCode = result.statusCode;
  for (const [key, value] of Object.entries(result.headers ?? {})) {
    if (key.toLowerCase() === 'set-cookie') continue;
    res.setHeader(key, value);
  }
  const setCookie = result.multiValueHeaders?.['set-cookie'];
  if (setCookie?.length) res.setHeader('set-cookie', setCookie);
  res.end(result.isBase64Encoded ? Buffer.from(result.body, 'base64') : result.body);
}

export async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    writeResult(res, await runServerless(toLambdaEvent(req), {}));
  } catch (error) {
    console.error('[api] unhandled error in serverless handler', error);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('content-type', 'application/json');
    }
    res.end(JSON.stringify({ error: { code: 'SERVER_ERROR', message: 'Internal server error.' } }));
  }
}

export default handler;
