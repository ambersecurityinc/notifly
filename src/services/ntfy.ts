import type { NotiflyMessage, NotiflyResult, ServiceConfig, ServiceDefinition } from '../types.js';
import { ServiceError } from '../errors.js';
import { BaseService } from './base.js';
import { sanitizeHeaderValue, validateHost, DEFAULT_TIMEOUT_MS, errorMessage } from '../security.js';

interface NtfyConfig extends ServiceConfig {
  service: 'ntfy';
  host: string;
  topic: string;
}

const PRIORITY_MAP: Record<string, string> = {
  info: '3',
  success: '4',
  warning: '4',
  failure: '5',
};

const TAGS_MAP: Record<string, string> = {
  info: 'information_source',
  success: 'white_check_mark',
  warning: 'warning',
  failure: 'x',
};

class NtfyService extends BaseService implements ServiceDefinition {
  schemas = ['ntfy'];

  parseUrl(url: URL): NtfyConfig {
    const hostname = url.hostname;
    const path = url.pathname.slice(1);
    if (!path) {
      return { service: 'ntfy', host: 'ntfy.sh', topic: hostname };
    }
    return { service: 'ntfy', host: hostname, topic: path };
  }

  async send(config: ServiceConfig, message: NotiflyMessage): Promise<NotiflyResult> {
    if (config.service !== 'ntfy') {
      throw new Error('Misrouted config: expected ntfy');
    }
    const { host, topic } = config as NtfyConfig;

    const headers: Record<string, string> = { 'Content-Type': 'text/plain' };
    if (message.title) headers['Title'] = sanitizeHeaderValue(message.title);
    if (message.type) {
      headers['Priority'] = PRIORITY_MAP[message.type] ?? '3';
      headers['Tags'] = TAGS_MAP[message.type] ?? '';
    }
    try {
      // H5: SSRF validation — inside try so errors return as result, not throw
      validateHost(host);
      const response = await fetch(`https://${host}/${topic}`, {
        method: 'POST',
        headers,
        body: message.body,
        signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
      });
      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new ServiceError(`HTTP ${response.status}`, response.status, text.slice(0, 200));
      }
      return { success: true, service: 'ntfy' };
    } catch (err) {
      return { success: false, service: 'ntfy', error: errorMessage(err) };
    }
  }
}

export const ntfyService = new NtfyService();
