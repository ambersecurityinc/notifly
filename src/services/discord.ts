import type { NotiflyMessage, NotiflyResult, ServiceConfig, ServiceDefinition } from '../types.js';
import { BaseService } from './base.js';

interface DiscordConfig extends ServiceConfig {
  service: 'discord';
  webhookId: string;
  webhookToken: string;
}

class DiscordService extends BaseService implements ServiceDefinition {
  schemas = ['discord'];

  parseUrl(url: URL): DiscordConfig {
    const webhookId = url.hostname;
    const webhookToken = url.pathname.slice(1);
    return { service: 'discord', webhookId, webhookToken };
  }

  async send(config: ServiceConfig, message: NotiflyMessage): Promise<NotiflyResult> {
    const { webhookId, webhookToken } = config as DiscordConfig;
    const content = message.title ? `**${message.title}**\n${message.body}` : message.body;
    try {
      await this.httpPost(
        `https://discord.com/api/webhooks/${webhookId}/${webhookToken}`,
        { content },
      );
      return { success: true, service: 'discord' };
    } catch (err) {
      return { success: false, service: 'discord', error: (err as Error).message };
    }
  }
}

export const discordService = new DiscordService();
