import { ParseError } from './errors.js';
import { getService } from './services/index.js';
import type { ServiceConfig } from './types.js';

export function parseUrl(urlString: string): ServiceConfig {
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    throw new ParseError(`Invalid URL: ${urlString}`);
  }

  const schema = url.protocol.replace(/:$/, '');
  const service = getService(schema);

  if (!service) {
    throw new ParseError(`Unknown service scheme: ${schema}`);
  }

  return service.parseUrl(url);
}
