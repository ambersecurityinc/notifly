/**
 * Shared security helpers used across service adapters.
 */

/**
 * Header names that must never be set via user-supplied input.
 * Matches are case-insensitive.
 */
const BLOCKED_HEADERS = new Set([
  'host',
  'authorization',
  'cookie',
  'set-cookie',
  'transfer-encoding',
  'content-length',
  'x-forwarded-for',
  'x-forwarded-host',
  'x-forwarded-proto',
  'proxy-authorization',
  'proxy-connection',
]);

/**
 * Valid header name pattern: ASCII letters, digits, and hyphens only.
 */
const HEADER_NAME_RE = /^[a-zA-Z0-9-]+$/;

/**
 * Validate a user-supplied header name.
 * Throws if the name is blocked or contains invalid characters.
 */
export function validateHeaderName(name: string): void {
  if (!HEADER_NAME_RE.test(name)) {
    throw new Error(`Invalid header name: contains disallowed characters`);
  }
  if (BLOCKED_HEADERS.has(name.toLowerCase())) {
    throw new Error(`Blocked header: "${name}" cannot be set via URL parameters`);
  }
}

/**
 * Sanitize a value before placing it in an HTTP header.
 * Strips CR/LF to prevent CRLF injection, trims whitespace,
 * and truncates to maxLength.
 */
export function sanitizeHeaderValue(value: string, maxLength = 255): string {
  return value.replace(/[\r\n]+/g, ' ').trim().slice(0, maxLength);
}

/**
 * Allowed HTTP methods for the generic webhook service.
 */
const ALLOWED_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH']);

/**
 * Validate and normalise an HTTP method string.
 */
export function validateHttpMethod(method: string): string {
  const upper = method.toUpperCase();
  if (!ALLOWED_METHODS.has(upper)) {
    throw new Error(`HTTP method "${upper}" is not allowed. Permitted: ${[...ALLOWED_METHODS].join(', ')}`);
  }
  return upper;
}

/**
 * IPv4 ranges that must not be targeted by outbound requests.
 * Each entry is [networkBigInt, maskBigInt].
 */
const BLOCKED_IPV4_RANGES: Array<[bigint, bigint]> = [
  // 127.0.0.0/8
  [BigInt('0x7F000000'), BigInt('0xFF000000')],
  // 10.0.0.0/8
  [BigInt('0x0A000000'), BigInt('0xFF000000')],
  // 172.16.0.0/12
  [BigInt('0xAC100000'), BigInt('0xFFF00000')],
  // 192.168.0.0/16
  [BigInt('0xC0A80000'), BigInt('0xFFFF0000')],
  // 169.254.0.0/16 (link-local / cloud metadata)
  [BigInt('0xA9FE0000'), BigInt('0xFFFF0000')],
  // 0.0.0.0/8
  [BigInt('0x00000000'), BigInt('0xFF000000')],
];

function ipv4ToInt(ip: string): bigint {
  const parts = ip.split('.');
  if (parts.length !== 4) return BigInt(-1);
  let result = BigInt(0);
  for (const part of parts) {
    const n = Number(part);
    if (Number.isNaN(n) || n < 0 || n > 255) return BigInt(-1);
    result = (result << BigInt(8)) | BigInt(n);
  }
  return result;
}

function isBlockedIPv4(ip: string): boolean {
  const addr = ipv4ToInt(ip);
  if (addr < BigInt(0)) return false;
  for (const [network, mask] of BLOCKED_IPV4_RANGES) {
    if ((addr & mask) === network) return true;
  }
  return false;
}

/**
 * Blocked IPv6 addresses (exact match after normalisation).
 */
function isBlockedIPv6(ip: string): boolean {
  const stripped = ip.replace(/^\[|\]$/g, '');
  // ::1 (loopback)
  if (stripped === '::1' || stripped === '0000:0000:0000:0000:0000:0000:0000:0001') return true;
  // :: (unspecified)
  if (stripped === '::' || stripped === '0000:0000:0000:0000:0000:0000:0000:0000') return true;
  // fe80::/10 (link-local)
  if (/^fe[89ab]/i.test(stripped)) return true;
  // IPv4-mapped IPv6 (::ffff:x.x.x.x)
  const v4mapped = stripped.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  if (v4mapped && isBlockedIPv4(v4mapped[1])) return true;
  return false;
}

/**
 * Validate that a hostname is safe for outbound requests.
 * Blocks loopback, private, link-local, and unspecified addresses.
 * Throws a descriptive error (without echoing the raw hostname) on violation.
 */
export function validateHost(hostname: string): void {
  const lower = hostname.toLowerCase();

  // Block obvious loopback names
  if (lower === 'localhost' || lower === 'localhost.localdomain') {
    throw new Error('Requests to loopback addresses are not allowed');
  }

  // Check IPv4
  if (isBlockedIPv4(hostname)) {
    throw new Error('Requests to private/loopback/link-local addresses are not allowed');
  }

  // Check IPv6
  if (isBlockedIPv6(hostname)) {
    throw new Error('Requests to private/loopback/link-local addresses are not allowed');
  }
}

/**
 * Escape all MarkdownV2 reserved characters for Telegram.
 * See: https://core.telegram.org/bots/api#markdownv2-style
 */
export function escapeTelegramMarkdownV2(text: string): string {
  return text.replace(/[_*\[\]()~`>#+\-=|{}.!\\]/g, '\\$&');
}
