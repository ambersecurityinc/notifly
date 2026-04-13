import { ServiceError } from '../errors.js';
import { DEFAULT_TIMEOUT_MS } from '../security.js';

export abstract class BaseService {
  protected async httpPost(
    url: string,
    body: unknown,
    headers: Record<string, string> = {},
    timeoutMs: number = DEFAULT_TIMEOUT_MS,
  ): Promise<void> {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      const err = new ServiceError(
        `HTTP ${response.status}`,
        response.status,
        text.slice(0, 200),
      );
      Object.defineProperty(err, '_debugUrl', { value: url, enumerable: false });
      throw err;
    }
  }
}
