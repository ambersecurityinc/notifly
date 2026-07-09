import { describe, it, expect } from 'vitest';
import { decomposeUrl } from './index.js';
import { buildUrl } from './index.js';

describe('decomposeUrl', () => {
  describe('discord', () => {
    it('decomposes discord URL', () => {
      const result = decomposeUrl('discord://1234567890/abcdefghijklmnop');
      expect(result.service).toBe('discord');
      expect(result.fields['webhook_id']).toBe('1234567890');
      expect(result.fields['webhook_token']).toBe('abcdefghijklmnop');
    });
  });

  describe('slack', () => {
    it('decomposes slack URL without channel', () => {
      const result = decomposeUrl('slack://T000/B000/XXXX');
      expect(result.service).toBe('slack');
      expect(result.fields['token_a']).toBe('T000');
      expect(result.fields['token_b']).toBe('B000');
      expect(result.fields['token_c']).toBe('XXXX');
      expect(result.fields['channel']).toBeUndefined();
    });

    it('decomposes slack URL with channel', () => {
      const result = decomposeUrl('slack://T000/B000/XXXX/%23general');
      expect(result.fields['channel']).toBe('#general');
    });
  });

  describe('telegram', () => {
    it('decomposes telegram URL', () => {
      // Note: Telegram bot tokens with ':' are not URL-safe as the hostname segment;
      // the token is stored as a single hostname segment without the colon.
      const result = decomposeUrl('tgram://mybot123/987654321');
      expect(result.service).toBe('telegram');
      expect(result.fields['bot_token']).toBe('mybot123');
      expect(result.fields['chat_id']).toBe('987654321');
    });
  });

  describe('ntfy', () => {
    it('decomposes simple ntfy URL (public server)', () => {
      const result = decomposeUrl('ntfy://my-alerts');
      expect(result.service).toBe('ntfy');
      expect(result.fields['topic']).toBe('my-alerts');
      expect(result.fields['host']).toBe('ntfy.sh');
    });

    it('decomposes ntfy URL with self-hosted host', () => {
      const result = decomposeUrl('ntfy://ntfy.example.com/alerts');
      expect(result.fields['host']).toBe('ntfy.example.com');
      expect(result.fields['topic']).toBe('alerts');
    });
  });

  describe('gotify', () => {
    it('decomposes gotify URL', () => {
      const result = decomposeUrl('gotify://gotify.example.com/mytoken');
      expect(result.service).toBe('gotify');
      expect(result.fields['host']).toBe('gotify.example.com');
      expect(result.fields['token']).toBe('mytoken');
    });
  });

  describe('email', () => {
    it('decomposes mailto URL', () => {
      const result = decomposeUrl('mailto://noreply:re_key@example.com/?to=a%40b.com&gateway=resend');
      expect(result.service).toBe('email');
      expect(result.fields['user']).toBe('noreply');
      expect(result.fields['api_key']).toBe('re_key');
      expect(result.fields['host']).toBe('example.com');
      expect(result.fields['to']).toBe('a@b.com');
      expect(result.fields['gateway']).toBe('resend');
    });
  });

  describe('msteams', () => {
    it('decomposes msteams URL with tenant', () => {
      const result = decomposeUrl('msteams://groupid@tenantid/chan1/web1');
      expect(result.service).toBe('msteams');
      expect(result.fields['group_id']).toBe('groupid');
      expect(result.fields['tenant_id']).toBe('tenantid');
      expect(result.fields['channel_id']).toBe('chan1');
      expect(result.fields['webhook_id']).toBe('web1');
    });

    it('decomposes teams:// alias', () => {
      const result = decomposeUrl('teams://token_a/chan/wid');
      expect(result.service).toBe('msteams');
    });
  });

  describe('workflows', () => {
    it('decomposes a workflows URL back to the full HTTPS webhook URL', () => {
      const result = decomposeUrl(
        'workflows://default.b0.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/486665a7c2be4f109eff8dfe7f26bbf8/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=ZIVFCi7oV6mVHEDMfU2RVTjhfRy29NnUa6hDumHwfrk',
      );
      expect(result.service).toBe('workflows');
      expect(result.fields['webhook_url']).toBe(
        'https://default.b0.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/486665a7c2be4f109eff8dfe7f26bbf8/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=ZIVFCi7oV6mVHEDMfU2RVTjhfRy29NnUa6hDumHwfrk',
      );
    });

    it('decomposes the workflow:// alias', () => {
      const result = decomposeUrl('workflow://host.example.com/triggers/manual/paths/invoke?sig=x');
      expect(result.service).toBe('workflows');
    });
  });

  describe('pushover', () => {
    it('decomposes pushover URL without device', () => {
      const result = decomposeUrl('pover://myuserkey/myapitoken');
      expect(result.service).toBe('pushover');
      expect(result.fields['user_key']).toBe('myuserkey');
      expect(result.fields['api_token']).toBe('myapitoken');
      expect(result.fields['device']).toBeUndefined();
    });

    it('decomposes pushover URL with device', () => {
      const result = decomposeUrl('pover://myuserkey/myapitoken/myphone');
      expect(result.fields['device']).toBe('myphone');
    });
  });

  describe('pushbullet', () => {
    it('decomposes pushbullet URL for all devices', () => {
      const result = decomposeUrl('pbul://mytoken');
      expect(result.service).toBe('pushbullet');
      expect(result.fields['access_token']).toBe('mytoken');
      expect(result.fields['device_id']).toBeUndefined();
      expect(result.fields['channel']).toBeUndefined();
    });

    it('decomposes pushbullet URL with device', () => {
      const result = decomposeUrl('pbul://mytoken/dev123');
      expect(result.fields['device_id']).toBe('dev123');
    });

    it('decomposes pushbullet URL with channel', () => {
      const result = decomposeUrl('pbul://mytoken/%23mychan');
      expect(result.fields['channel']).toBe('mychan');
    });
  });

  describe('webhook', () => {
    it('decomposes jsons:// URL', () => {
      const result = decomposeUrl('jsons://example.com/hook');
      expect(result.service).toBe('webhook');
      expect(result.fields['host']).toBe('example.com');
      expect(result.fields['path']).toBe('/hook');
      expect(result.fields['format']).toBe('json');
      expect(result.fields['secure']).toBe(true);
      expect(result.fields['method']).toBe('POST');
    });

    it('decomposes form:// URL', () => {
      const result = decomposeUrl('form://example.com/hook');
      expect(result.fields['format']).toBe('form');
      expect(result.fields['secure']).toBe(false);
    });

    it('decomposes method override', () => {
      const result = decomposeUrl('jsons://example.com/hook?method=PUT');
      expect(result.fields['method']).toBe('PUT');
    });
  });

  describe('malformed and unknown URLs', () => {
    it('returns unknown for completely invalid URL', () => {
      const result = decomposeUrl('not-a-url');
      expect(result.service).toBe('unknown');
    });

    it('returns unknown for unknown scheme', () => {
      const result = decomposeUrl('unknown://somehost/somepath');
      expect(result.service).toBe('unknown');
    });
  });

  describe('round-trip: buildUrl → decomposeUrl', () => {
    it('round-trips discord URL', () => {
      const fields = { webhook_id: '1234567890', webhook_token: 'abc' };
      const { url } = buildUrl('discord', fields);
      const decomposed = decomposeUrl(url);
      expect(decomposed.service).toBe('discord');
      expect(decomposed.fields['webhook_id']).toBe(fields['webhook_id']);
      expect(decomposed.fields['webhook_token']).toBe(fields['webhook_token']);
    });

    it('round-trips gotify URL', () => {
      const fields = { host: 'gotify.example.com', token: 'mytoken' };
      const { url } = buildUrl('gotify', fields);
      const decomposed = decomposeUrl(url);
      expect(decomposed.fields['host']).toBe(fields['host']);
      expect(decomposed.fields['token']).toBe(fields['token']);
    });

    it('round-trips pushover URL', () => {
      const fields = {
        user_key: 'uQiRzpo4DXghDmr9QzzfQu27cmVRsG',
        api_token: 'azGDORePK8gMaC0QOYAMyEEuzJnyUi',
        device: 'myphone',
      };
      const { url } = buildUrl('pushover', fields);
      const decomposed = decomposeUrl(url);
      expect(decomposed.fields['user_key']).toBe(fields['user_key']);
      expect(decomposed.fields['device']).toBe(fields['device']);
    });

    it('round-trips webhook URL', () => {
      const fields = { host: 'example.com', path: '/hook', format: 'form', secure: true, method: 'PUT' };
      const { url } = buildUrl('webhook', fields);
      const decomposed = decomposeUrl(url);
      expect(decomposed.fields['format']).toBe('form');
      expect(decomposed.fields['secure']).toBe(true);
      expect(decomposed.fields['method']).toBe('PUT');
    });

    it('round-trips workflows URL, preserving the sig token', () => {
      const webhook_url =
        'https://default.b0.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/486665a7c2be4f109eff8dfe7f26bbf8/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=ZIVFCi7oV6mVHEDMfU2RVTjhfRy29NnUa6hDumHwfrk';
      const { url } = buildUrl('workflows', { webhook_url });
      const decomposed = decomposeUrl(url);
      expect(decomposed.service).toBe('workflows');
      expect(decomposed.fields['webhook_url']).toBe(webhook_url);
    });
  });
});
