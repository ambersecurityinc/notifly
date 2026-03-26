import type { NotiflyMessage, NotiflyResult } from './types.js';
import { parseUrl } from './url-parser.js';
import { getService } from './services/index.js';

export async function notify(
  options: { urls: string[] },
  message: NotiflyMessage,
): Promise<NotiflyResult[]> {
  const tasks = options.urls.map(async (urlString): Promise<NotiflyResult> => {
    let url: URL;
    try {
      url = new URL(urlString);
    } catch {
      return { success: false, service: 'unknown', error: `Invalid URL: ${urlString}` };
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
      return { success: false, service: schema, error: (err as Error).message };
    }

    return service.send(config, message);
  });

  const settled = await Promise.allSettled(tasks);
  return settled.map((result) => {
    if (result.status === 'fulfilled') return result.value;
    return { success: false, service: 'unknown', error: result.reason?.message ?? 'Unknown error' };
  });
}
