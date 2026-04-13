/**
 * Pushover notification service.
 *
 * URL scheme:
 *   pover://user_key/api_token
 *   pover://user_key/api_token/device
 *
 * Where:
 *   user_key  — your Pushover user key (found on the Pushover dashboard)
 *   api_token — your application's API token
 *   device    — optional specific device name to target
 *
 * Message types map to Pushover priorities:
 *   info=0, success=0, warning=1, failure=2
 */
import type { NotiflyMessage, NotiflyResult, ServiceConfig, ServiceDefinition } from '../types.js';
import { BaseService } from './base.js';
import { errorMessage } from '../security.js';

interface PushoverConfig extends ServiceConfig {
  service: 'pushover';
  userKey: string;
  apiToken: string;
  device?: string;
}

const PRIORITY_MAP: Record<string, number> = {
  info: 0,
  success: 0,
  warning: 1,
  failure: 2,
};

class PushoverService extends BaseService implements ServiceDefinition {
  schemas = ['pover'];

  parseUrl(url: URL): PushoverConfig {
    const userKey = url.hostname;
    const parts = url.pathname.split('/').filter(Boolean);
    const apiToken = parts[0] ?? '';
    const device = parts[1] ?? undefined;
    return { service: 'pushover', userKey, apiToken, device };
  }

  async send(config: ServiceConfig, message: NotiflyMessage): Promise<NotiflyResult> {
    if (config.service !== 'pushover') {
      throw new Error('Misrouted config: expected pushover');
    }
    const { userKey, apiToken, device } = config as PushoverConfig;
    const priority = message.type !== undefined ? (PRIORITY_MAP[message.type] ?? 0) : 0;

    const body: Record<string, unknown> = {
      token: apiToken,
      user: userKey,
      message: message.body,
      priority,
    };
    if (message.title) body['title'] = message.title;
    if (device) body['device'] = device;

    try {
      await this.httpPost('https://api.pushover.net/1/messages.json', body);
      return { success: true, service: 'pushover' };
    } catch (err) {
      return { success: false, service: 'pushover', error: errorMessage(err) };
    }
  }
}

export const pushoverService = new PushoverService();
