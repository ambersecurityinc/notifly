import type { NotiflyMessage, NotiflyResult, ServiceConfig, ServiceDefinition } from '../types.js';
import { BaseService } from './base.js';

interface TelegramConfig extends ServiceConfig {
  service: 'telegram';
  botToken: string;
  chatId: string;
}

class TelegramService extends BaseService implements ServiceDefinition {
  schemas = ['tgram'];

  parseUrl(url: URL): TelegramConfig {
    const botToken = url.hostname;
    const chatId = url.pathname.slice(1);
    return { service: 'telegram', botToken, chatId };
  }

  async send(config: ServiceConfig, message: NotiflyMessage): Promise<NotiflyResult> {
    const { botToken, chatId } = config as TelegramConfig;
    const text = message.title ? `<b>${message.title}</b>\n${message.body}` : message.body;
    try {
      await this.httpPost(
        `https://api.telegram.org/bot${botToken}/sendMessage`,
        { chat_id: chatId, text, parse_mode: 'HTML' },
      );
      return { success: true, service: 'telegram' };
    } catch (err) {
      return { success: false, service: 'telegram', error: (err as Error).message };
    }
  }
}

export const telegramService = new TelegramService();
