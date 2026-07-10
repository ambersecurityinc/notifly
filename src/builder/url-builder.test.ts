import { describe, it, expect } from 'vitest';
import { buildUrl } from './index.js';

describe('buildUrl', () => {
  describe('discord', () => {
    it('builds correct discord URL', () => {
      const { url, errors } = buildUrl('discord', {
        webhook_id: '1234567890',
        webhook_token: 'abcdefghijklmnop',
      });
      expect(errors).toHaveLength(0);
      expect(url).toBe('discord://1234567890/abcdefghijklmnop');
    });

    it('returns errors for missing fields', () => {
      const { url, errors } = buildUrl('discord', {});
      expect(url).toBe('');
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('slack', () => {
    it('builds slack URL without channel', () => {
      const { url } = buildUrl('slack', { token_a: 'T000', token_b: 'B000', token_c: 'XXXX' });
      expect(url).toBe('slack://T000/B000/XXXX');
    });

    it('builds slack URL with channel', () => {
      const { url } = buildUrl('slack', { token_a: 'T000', token_b: 'B000', token_c: 'XXXX', channel: '#general' });
      expect(url).toContain('slack://T000/B000/XXXX/');
      expect(url).toContain('general');
    });
  });

  describe('telegram', () => {
    it('builds telegram URL', () => {
      const { url } = buildUrl('telegram', { bot_token: 'bot123:ABC', chat_id: '-1001234' });
      expect(url).toBe('tgram://bot123:ABC/-1001234');
    });
  });

  describe('ntfy', () => {
    it('builds ntfy URL for public server', () => {
      const { url } = buildUrl('ntfy', { topic: 'my-alerts' });
      expect(url).toBe('ntfy://my-alerts');
    });

    it('builds ntfy URL for self-hosted server', () => {
      const { url } = buildUrl('ntfy', { topic: 'alerts', host: 'ntfy.example.com' });
      expect(url).toBe('ntfy://ntfy.example.com/alerts');
    });

    it('builds ntfy URL with default host', () => {
      const { url } = buildUrl('ntfy', { topic: 'alerts', host: 'ntfy.sh' });
      expect(url).toBe('ntfy://alerts');
    });
  });

  describe('gotify', () => {
    it('builds gotify URL', () => {
      const { url } = buildUrl('gotify', { host: 'gotify.example.com', token: 'mytoken' });
      expect(url).toBe('gotify://gotify.example.com/mytoken');
    });
  });

  describe('email', () => {
    it('builds mailto URL with mailchannels gateway', () => {
      const { url, errors } = buildUrl('email', {
        to: 'recipient@example.com',
        gateway: 'mailchannels',
        user: 'noreply',
        host: 'example.com',
      });
      expect(errors).toHaveLength(0);
      expect(url).toContain('mailto://');
      expect(url).toContain('gateway=mailchannels');
      expect(url).toContain('to=recipient%40example.com');
    });

    it('builds mailto URL with resend gateway and api key', () => {
      const { url } = buildUrl('email', {
        to: 'recipient@example.com',
        gateway: 'resend',
        api_key: 're_abc123',
        host: 'example.com',
      });
      expect(url).toContain('gateway=resend');
    });
  });

  describe('msteams', () => {
    it('builds msteams URL with tenant', () => {
      const { url } = buildUrl('msteams', {
        group_id: 'groupid',
        tenant_id: 'tenantid',
        channel_id: 'chan1',
        webhook_id: 'web1',
      });
      expect(url).toBe('msteams://groupid@tenantid/chan1/web1');
    });

    it('builds msteams URL without tenant', () => {
      const { url } = buildUrl('msteams', {
        group_id: 'groupid',
        channel_id: 'chan1',
        webhook_id: 'web1',
      });
      expect(url).toBe('msteams://groupid/chan1/web1');
    });
  });

  describe('workflows', () => {
    it('builds a workflows URL by swapping the scheme, preserving the sig token', () => {
      const raw =
        'https://default.b0.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/486665a7c2be4f109eff8dfe7f26bbf8/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=ZIVFCi7oV6mVHEDMfU2RVTjhfRy29NnUa6hDumHwfrk';
      const { url, errors } = buildUrl('workflows', { webhook_url: raw });
      expect(errors).toEqual([]);
      expect(url).toBe(raw.replace(/^https:\/\//, 'workflows://'));
    });

    it('rejects a non-HTTPS webhook URL', () => {
      const { url, errors } = buildUrl('workflows', { webhook_url: 'ftp://example.com/x' });
      expect(url).toBe('');
      expect(errors.length).toBeGreaterThan(0);
    });

    it('omits the fragment for the default card format', () => {
      const { url } = buildUrl('workflows', {
        webhook_url: 'https://x.powerplatform.com/a/triggers/manual/paths/invoke?sig=x',
        format: 'card',
      });
      expect(url).toBe('workflows://x.powerplatform.com/a/triggers/manual/paths/invoke?sig=x');
    });

    it('appends #format for non-default formats', () => {
      const { url } = buildUrl('workflows', {
        webhook_url: 'https://x.powerplatform.com/a/triggers/manual/paths/invoke?sig=x',
        format: 'message',
      });
      expect(url).toBe('workflows://x.powerplatform.com/a/triggers/manual/paths/invoke?sig=x#format=message');
    });
  });

  describe('pushover', () => {
    it('builds pushover URL without device', () => {
      const { url } = buildUrl('pushover', {
        user_key: 'uQiRzpo4DXghDmr9QzzfQu27cmVRsG',
        api_token: 'azGDORePK8gMaC0QOYAMyEEuzJnyUi',
      });
      expect(url).toBe('pover://uQiRzpo4DXghDmr9QzzfQu27cmVRsG/azGDORePK8gMaC0QOYAMyEEuzJnyUi');
    });

    it('builds pushover URL with device', () => {
      const { url } = buildUrl('pushover', {
        user_key: 'uQiRzpo4DXghDmr9QzzfQu27cmVRsG',
        api_token: 'azGDORePK8gMaC0QOYAMyEEuzJnyUi',
        device: 'myphone',
      });
      expect(url).toContain('/myphone');
    });
  });

  describe('pushbullet', () => {
    it('builds pushbullet URL for all devices', () => {
      const { url } = buildUrl('pushbullet', { access_token: 'o.mytoken' });
      expect(url).toBe('pbul://o.mytoken');
    });

    it('builds pushbullet URL with device', () => {
      const { url } = buildUrl('pushbullet', { access_token: 'o.mytoken', device_id: 'dev123' });
      expect(url).toBe('pbul://o.mytoken/dev123');
    });

    it('builds pushbullet URL with channel', () => {
      const { url } = buildUrl('pushbullet', { access_token: 'o.mytoken', channel: 'mychan' });
      expect(url).toContain('%23mychan');
    });
  });

  describe('webhook', () => {
    it('builds jsons:// URL by default', () => {
      const { url } = buildUrl('webhook', { host: 'example.com', path: '/hook' });
      expect(url).toBe('jsons://example.com/hook');
    });

    it('builds json:// for insecure', () => {
      const { url } = buildUrl('webhook', { host: 'example.com', path: '/hook', secure: false });
      expect(url).toBe('json://example.com/hook');
    });

    it('builds forms:// for form format + secure', () => {
      const { url } = buildUrl('webhook', { host: 'example.com', path: '/hook', format: 'form', secure: true });
      expect(url).toBe('forms://example.com/hook');
    });

    it('includes method param when not POST', () => {
      const { url } = buildUrl('webhook', { host: 'example.com', path: '/hook', method: 'PUT' });
      expect(url).toContain('method=PUT');
    });
  });

  describe('unknown service', () => {
    it('returns error for unknown service', () => {
      const { url, errors } = buildUrl('nonexistent', {});
      expect(url).toBe('');
      expect(errors.some(e => e.field === 'service')).toBe(true);
    });
  });
});
