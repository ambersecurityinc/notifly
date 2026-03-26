# notifly

Send notifications to multiple services from a single API using Apprise-compatible URLs.

## Features

- Send notifications to Discord, Slack, Telegram, ntfy, and Gotify
- Simple URL-based service configuration
- TypeScript-first with full type definitions
- Extensible — register custom notification services
- Promise-based, returns results for all targets (no partial failures)

## Installation

```bash
npm install notifly
```

## Quick Start

```ts
import { notify } from 'notifly';

const results = await notify(
  {
    urls: [
      'discord://webhookId/webhookToken',
      'slack://tokenA/tokenB/tokenC/%23general',
      'tgram://botToken/chatId',
    ],
  },
  {
    title: 'Deployment complete',
    body: 'Version 1.2.3 deployed successfully.',
    type: 'success',
  },
);

console.log(results);
// [
//   { success: true, service: 'discord' },
//   { success: true, service: 'slack' },
//   { success: true, service: 'telegram' },
// ]
```

## Supported Services

### Discord

```
discord://<webhookId>/<webhookToken>
```

### Slack

```
slack://<tokenA>/<tokenB>/<tokenC>
slack://<tokenA>/<tokenB>/<tokenC>/%23<channel>
```

### Telegram

```
tgram://<botToken>/<chatId>
```

### ntfy

```
ntfy://<topic>                    # uses ntfy.sh
ntfy://<host>/<topic>             # self-hosted
```

### Gotify

```
gotify://<host>/<token>
```

## API

### `notify(options, message)`

Sends a notification to all configured URLs and returns an array of results.

```ts
notify(
  options: { urls: string[] },
  message: {
    title?: string;
    body: string;
    type?: 'info' | 'success' | 'warning' | 'failure';
  }
): Promise<NotiflyResult[]>
```

### `parseUrl(urlString)`

Parses a notification URL into a `ServiceConfig` object.

```ts
parseUrl(urlString: string): ServiceConfig
```

Throws a `ParseError` if the URL is invalid or uses an unknown scheme.

### `registerService(service)`

Register a custom notification service.

```ts
registerService(service: ServiceDefinition): void
```

Example:

```ts
import { registerService } from 'notifly';
import type { ServiceDefinition, ServiceConfig, NotiflyMessage, NotiflyResult } from 'notifly';

const myService: ServiceDefinition = {
  schemas: ['myscheme'],
  parseUrl(url: URL): ServiceConfig {
    return { service: 'myscheme', host: url.hostname };
  },
  async send(config: ServiceConfig, message: NotiflyMessage): Promise<NotiflyResult> {
    // send notification...
    return { success: true, service: 'myscheme' };
  },
};

registerService(myService);
```

## Error Handling

- `ParseError` — thrown when a URL cannot be parsed or uses an unknown scheme.
- `ServiceError` — thrown internally when an HTTP request fails (caught and returned as a failed result).

Individual service failures do not throw — they return `{ success: false, service: '...', error: '...' }` in the results array.

## License

MIT
