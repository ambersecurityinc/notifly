import { describe, it, expect } from 'vitest';
import { ServiceError, ParseError } from './errors.js';

describe('ServiceError', () => {
  it('stores status code', () => {
    const err = new ServiceError('HTTP 500', 500, 'Internal Server Error');
    expect(err.status).toBe(500);
    expect(err.message).toBe('HTTP 500');
  });

  // M7: body is private — not included in JSON serialization
  it('does not include body or _body in JSON.stringify output', () => {
    const err = new ServiceError('HTTP 500', 500, 'secret-response-data');
    const serialized = JSON.stringify(err);
    expect(serialized).not.toContain('secret-response-data');
    expect(serialized).not.toContain('_body');
    expect(serialized).not.toContain('body');
  });

  it('exposes body via getDebugBody()', () => {
    const err = new ServiceError('HTTP 500', 500, 'debug info');
    expect(err.getDebugBody()).toBe('debug info');
  });

  it('has correct name property', () => {
    const err = new ServiceError('msg', 200, '');
    expect(err.name).toBe('ServiceError');
    expect(err).toBeInstanceOf(Error);
  });
});

describe('ParseError', () => {
  it('has correct name property', () => {
    const err = new ParseError('bad url');
    expect(err.name).toBe('ParseError');
    expect(err.message).toBe('bad url');
    expect(err).toBeInstanceOf(Error);
  });
});
