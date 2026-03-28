/**
 * Pushbullet notification service.
 *
 * URL scheme:
 *   pbul://access_token              — push to all devices
 *   pbul://access_token/device_id    — push to a specific device
 *   pbul://access_token/#channel     — push to a channel
 *
 * Where:
 *   access_token — your Pushbullet access token (from pushbullet.com → Settings → Access Tokens)
 *   device_id    — optional device identifier (iden field from the devices API)
 *   #channel     — channel tag prefixed with # (URL-encode as %23channel)
 */
import type { NotiflyMessage, NotiflyResult, ServiceConfig, ServiceDefinition } from '../types.js';
import { BaseService } from './base.js';
import { errorMessage } from '../security.js';

interface PushbulletConfig extends ServiceConfig {
  service: 'pushbullet';
  accessToken: string;
  deviceIden?: string;
  channelTag?: string;
}

class PushbulletService extends BaseService implements ServiceDefinition {
  schemas = ['pbul'];

  parseUrl(url: URL): PushbulletConfig {
    const accessToken = url.hostname;
    const parts = url.pathname.split('/').filter(Boolean);
    const target = parts[0] ? decodeURIComponent(parts[0]) : undefined;

    let deviceIden: string | undefined;
    let channelTag: string | undefined;

    if (target?.startsWith('#')) {
      channelTag = target.slice(1);
    } else if (target) {
      deviceIden = target;
    }

    return { service: 'pushbullet', accessToken, deviceIden, channelTag };
  }

  async send(config: ServiceConfig, message: NotiflyMessage): Promise<NotiflyResult> {
    if (config.service !== 'pushbullet') {
      throw new Error('Misrouted config: expected pushbullet');
    }
    const { accessToken, deviceIden, channelTag } = config as PushbulletConfig;

    const body: Record<string, unknown> = {
      type: 'note',
      title: message.title ?? '',
      body: message.body,
    };
    if (deviceIden) body['device_iden'] = deviceIden;
    if (channelTag) body['channel_tag'] = channelTag;

    try {
      await this.httpPost('https://api.pushbullet.com/v2/pushes', body, {
        'Access-Token': accessToken,
      });
      return { success: true, service: 'pushbullet' };
    } catch (err) {
      return { success: false, service: 'pushbullet', error: errorMessage(err) };
    }
  }
}

export const pushbulletService = new PushbulletService();
