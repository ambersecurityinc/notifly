import type { NotiflyMessage, NotiflyResult, ServiceConfig, ServiceDefinition } from '../types.js';
import { BaseService } from './base.js';
import { escapeTelegramMarkdownV2 } from '../security.js';

interface TelegramConfig extends ServiceConfig {
  service: 'telegram';
  botToken: string;
  chatId: string;
  parseMode?: 'MarkdownV2' | 'HTML';
}

class TelegramService extends BaseService implements ServiceDefinition {
  schemas = ['tgram'];

  parseUrl(url: URL): TelegramConfig {
    const botToken = url.hostname;
    const chatId = url.pathname.slice(1);
    const parseMode = url.searchParams.get('parse_mode') === 'HTML' ? 'HTML' as const : undefined;
    return { service: 'telegram', botToken, chatId, ...(parseMode ? { parseMode } : {}) };
  }

  async send(config: ServiceConfig, message: NotiflyMessage): Promise<NotiflyResult> {
    const { botToken, chatId, parseMode } = config as TelegramConfig;
    const useHtml = parseMode === 'HTML';
    let text: string;
    if (useHtml) {
      text = message.title ? `<b>${message.title}</b>\n${message.body}` : message.body;
    } else {
      const escapedBody = escapeTelegramMarkdownV2(message.body);
      text = message.title
        ? `*${escapeTelegramMarkdownV2(message.title)}*\n${escapedBody}`
        : escapedBody;
    }
    try {
      await this.httpPost(
        `https://api.telegram.org/bot${botToken}/sendMessage`,
        { chat_id: chatId, text, parse_mode: useHtml ? 'HTML' : 'MarkdownV2' },
      );
      return { success: true, service: 'telegram' };
    } catch (err) {
      return { success: false, service: 'telegram', error: (err as Error).message };
    }
  }
}

export const telegramService = new TelegramService();
