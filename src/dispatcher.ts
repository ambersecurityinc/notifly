import type { NotiflyMessage, NotiflyResult } from './types.js';
import { parseUrl } from './url-parser.js';
import { getService } from './services/index.js';
import { errorMessage, enforceMessageLimits } from './security.js';

const MAX_CONCURRENCY = 10;

export async function notify(
  options: { urls: string[] },
  message: NotiflyMessage,
): Promise<NotiflyResult[]> {
  const limited = enforceMessageLimits(message);
  const results: NotiflyResult[] = new Array(options.urls.length);
  let nextIndex = 0;
  const total = options.urls.length;

  async function worker(): Promise<void> {
    while (nextIndex < total) {
      const i = nextIndex++;
      results[i] = await dispatch(options.urls[i], limited);
    }
  }

  const workerCount = Math.min(MAX_CONCURRENCY, total);
  const workers: Promise<void>[] = [];
  for (let w = 0; w < workerCount; w++) {
    workers.push(worker());
  }
  await Promise.allSettled(workers);

  return results;
}

async function dispatch(
  urlString: string,
  message: { title?: string; body: string; type?: 'info' | 'success' | 'warning' | 'failure' },
): Promise<NotiflyResult> {
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    return { success: false, service: 'unknown', error: 'Invalid URL format' };
  }

  const schema = url.protocol.replace(/:$/, '');
  const service = getService(schema);
  if (!service) {
    return { success: false, service: schema, error: `Unknown service scheme: ${schema}` };
  }

  let config;
  try {
    config = parseUrl(urlString);
  } catch (err) {
    return { success: false, service: schema, error: errorMessage(err) };
  }

  try {
    return await service.send(config, message);
  } catch (err) {
    return { success: false, service: schema, error: errorMessage(err) };
  }
}
