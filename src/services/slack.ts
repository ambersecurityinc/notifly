import type { NotiflyMessage, NotiflyResult, ServiceConfig, ServiceDefinition } from '../types.js';
import { BaseService } from './base.js';
import { errorMessage } from '../security.js';

interface SlackConfig extends ServiceConfig {
  service: 'slack';
  tokenA: string;
  tokenB: string;
  tokenC: string;
  channel?: string;
}

class SlackService extends BaseService implements ServiceDefinition {
  schemas = ['slack'];

  parseUrl(url: URL): SlackConfig {
    const tokenA = url.hostname;
    const parts = url.pathname.split('/').filter(Boolean);
    const tokenB = parts[0] ?? '';
    const tokenC = parts[1] ?? '';
    const channel = parts[2] ? decodeURIComponent(parts[2]) : undefined;
    return { service: 'slack', tokenA, tokenB, tokenC, channel };
  }

  async send(config: ServiceConfig, message: NotiflyMessage): Promise<NotiflyResult> {
    if (config.service !== 'slack') {
      throw new Error('Misrouted config: expected slack');
    }
    const { tokenA, tokenB, tokenC, channel } = config as SlackConfig;
    const text = message.title ? `*${message.title}*\n${message.body}` : message.body;
    const body: Record<string, unknown> = { text };
    if (channel) body['channel'] = channel;
    try {
      await this.httpPost(
        `https://hooks.slack.com/services/${tokenA}/${tokenB}/${tokenC}`,
        body,
      );
      return { success: true, service: 'slack' };
    } catch (err) {
      return { success: false, service: 'slack', error: errorMessage(err) };
    }
  }
}

export const slackService = new SlackService();
