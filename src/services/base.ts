import { ServiceError } from '../errors.js';

export abstract class BaseService {
  protected async httpPost(url: string, body: unknown, headers: Record<string, string> = {}): Promise<void> {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new ServiceError(
        `HTTP ${response.status} from ${url}`,
        response.status,
        text.slice(0, 200),
      );
    }
  }
}
