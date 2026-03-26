# notifly

Send notifications to multiple services from a single API using Apprise-compatible URLs.

[![npm version](https://img.shields.io/npm/v/notifly)](https://www.npmjs.com/package/notifly)
[![CI](https://img.shields.io/github/actions/workflow/status/YOUR_USERNAME/notifly/ci.yml?branch=main&label=CI)](https://github.com/YOUR_USERNAME/notifly/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Bundle Size](https://img.shields.io/bundlephobia/minzip/notifly)](https://bundlephobia.com/package/notifly)

## Features

- **Web API only** — built on `fetch`, no Node.js-specific dependencies
- **Multi-runtime** — works on Cloudflare Workers, Bun, Deno, and Node 18+
- **Apprise-compatible URLs** — one URL string encodes all connection details
- **Concurrent dispatch** — sends to all services in parallel via `Promise.allSettled()`
- **Plugin system** — register custom services with `registerService()`

## Install

```sh
npm install notifly
```

## Quick Start

```ts
import { notify } from 'notifly';

const results = await notify(
  {
    urls: [
      'discord://1234567890/abcdefghijklmnop',
      'ntfy://my-alerts',
      'tgram://bot123456/987654321',
    ],
  },
  {
    title: 'Deployment complete',
    body: 'v1.2.3 is live!',
    type: 'success',
  },
);

console.log(results);
// [
//   { success: true, service: 'discord' },
//   { success: true, service: 'ntfy' },
//   { success: true, service: 'telegram' },
// ]
```

## Supported Services

| Service  | URL Scheme | Example URL                                  |
|----------|------------|----------------------------------------------|
| Discord  | `discord`  | `discord://webhook_id/webhook_token`         |
| Slack    | `slack`    | `slack://token_a/token_b/token_c/%23channel` |
| Telegram | `tgram`    | `tgram://bot_token/chat_id`                  |
| ntfy     | `ntfy`     | `ntfy://topic` or `ntfy://host/topic`        |
| Gotify   | `gotify`   | `gotify://host/token`                        |

## Custom Services

```ts
import { registerService } from 'notifly';
import type { ServiceDefinition, ServiceConfig, NotiflyMessage } from 'notifly';

const myService: ServiceDefinition = {
  schemas: ['myscheme'],

  parseUrl(url: URL): ServiceConfig {
    return { service: 'myscheme', host: url.hostname, token: url.pathname.slice(1) };
  },

  async send(config: ServiceConfig, message: NotiflyMessage) {
    // send the notification...
    return { success: true, service: 'myscheme' };
  },
};

registerService(myService);

// Now use it
await notify({ urls: ['myscheme://host/token'] }, { body: 'Hello!' });
```

## API Reference

### `notify(options, message)`

Sends a notification to all URLs concurrently. Never throws — failures are captured in results.

```ts
function notify(options: NotiflyOptions, message: NotiflyMessage): Promise<NotiflyResult[]>
```

### `parseUrl(url)`

Parses an Apprise-compatible URL string into a `ServiceConfig` object. Throws `ParseError` for malformed or unknown URLs. Useful for validation before sending.

```ts
function parseUrl(url: string): ServiceConfig
```

### `registerService(service)`

Registers a custom service plugin. Overwrites any existing service registered for the same URL scheme(s).

```ts
function registerService(service: ServiceDefinition): void
```

### Types

```ts
interface NotiflyMessage {
  title?: string;
  body: string;
  type?: 'info' | 'success' | 'warning' | 'failure';
}

interface NotiflyResult {
  success: boolean;
  service: string;
  error?: string;
}

interface NotiflyOptions {
  urls: string[];
}

interface ServiceConfig {
  service: string;
  [key: string]: unknown;
}

interface ServiceDefinition {
  schemas: string[];
  parseUrl(url: URL): ServiceConfig;
  send(config: ServiceConfig, message: NotiflyMessage): Promise<NotiflyResult>;
}
```

## URL Format

### Discord

```
discord://webhook_id/webhook_token
```

### Slack

```
slack://token_a/token_b/token_c/%23channel
```

The channel segment is optional and should be URL-encoded (e.g. `%23general` for `#general`).

### Telegram

```
tgram://bot_token/chat_id
```

### ntfy

```
ntfy://topic                  # uses ntfy.sh
ntfy://your-host.com/topic    # self-hosted
```

### Gotify

```
gotify://your-host.com/app_token
```

## Error Handling

`notify()` never throws. All errors are returned as failed results:

```ts
const results = await notify({ urls: ['discord://bad/token'] }, { body: 'test' });
// [{ success: false, service: 'discord', error: 'HTTP 401 from ...' }]
```

`parseUrl()` throws `ParseError` for invalid or unknown URLs:

```ts
import { parseUrl, ParseError } from 'notifly';

try {
  parseUrl('not-a-url');
} catch (err) {
  if (err instanceof ParseError) {
    console.error('Bad URL:', err.message);
  }
}
```

HTTP failures are exposed as `ServiceError` (with `.status` and `.body` properties) — these are caught internally and returned as failed `NotiflyResult` objects.

## Runtime Compatibility

| Runtime            | Supported |
|--------------------|-----------|
| Node.js 18+        | ✅        |
| Bun                | ✅        |
| Deno               | ✅        |
| Cloudflare Workers | ✅        |
| Browser            | ✅        |

No Node.js-specific APIs are used. Only `fetch` and the `URL` constructor are required.

## Publishing

### First Publish

This project uses a two-workflow setup for npm publishing.

**First publish** is done via `first-publish.yml` using a granular npm access token:

1. Create a granular npm token scoped to the `notifly` package (read-write access)
2. Add it as `NPM_TOKEN` in your GitHub repo → Settings → Secrets → Actions
3. Go to Actions tab → "First Publish" → "Run workflow"
4. Verify the package appears at https://www.npmjs.com/package/notifly

### Ongoing Releases (OIDC Trusted Publishing)

After the first publish, switch to keyless publishing via OIDC:

1. Go to https://www.npmjs.com/package/notifly/access
2. Under "Trusted Publisher", select **GitHub Actions**
3. Fill in: your GitHub org/user, repository name (`notifly`), workflow filename (`release.yml`)
4. Enable "Require two-factor authentication and disallow tokens" (recommended)
5. In your GitHub repo: disable `first-publish.yml` and delete the `NPM_TOKEN` secret

Releases are triggered by pushing a git tag (`v*`) or via the `release.yml` workflow dispatch.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT
