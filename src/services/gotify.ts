import type { NotiflyMessage, NotiflyResult, ServiceConfig, ServiceDefinition } from '../types.js';
import { BaseService } from './base.js';

interface GotifyConfig extends ServiceConfig {
  service: 'gotify';
  host: string;
  token: string;
}

const PRIORITY_MAP: Record<string, number> = {
  info: 2,
  success: 5,
  warning: 7,
  failure: 10,
};

class GotifyService extends BaseService implements ServiceDefinition {
  schemas = ['gotify'];

  parseUrl(url: URL): GotifyConfig {
    const host = url.hostname;
    const token = url.pathname.slice(1);
    return { service: 'gotify', host, token };
  }

  async send(config: ServiceConfig, message: NotiflyMessage): Promise<NotiflyResult> {
    const { host, token } = config as GotifyConfig;
    const priority = message.type ? (PRIORITY_MAP[message.type] ?? 2) : 2;
    try {
      await this.httpPost(
        `https://${host}/message`,
        { title: message.title ?? '', message: message.body, priority },
        { 'X-Gotify-Key': token },
      );
      return { success: true, service: 'gotify' };
    } catch (err) {
      return { success: false, service: 'gotify', error: (err as Error).message };
    }
  }
}

export const gotifyService = new GotifyService();
