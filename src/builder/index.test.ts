import { describe, it, expect } from 'vitest';
import {
  getServiceSchemas,
  getServiceSchema,
  searchServices,
  getServicesByCategory,
  getCategories,
} from './index.js';

describe('getServiceSchemas', () => {
  it('returns all 11 schemas', () => {
    const schemas = getServiceSchemas();
    expect(schemas.length).toBe(11);
  });

  it('includes all expected services', () => {
    const services = getServiceSchemas().map(s => s.service);
    expect(services).toContain('discord');
    expect(services).toContain('slack');
    expect(services).toContain('telegram');
    expect(services).toContain('ntfy');
    expect(services).toContain('gotify');
    expect(services).toContain('email');
    expect(services).toContain('msteams');
    expect(services).toContain('pushover');
    expect(services).toContain('pushbullet');
    expect(services).toContain('webhook');
  });

  it('all schemas have required fields', () => {
    for (const schema of getServiceSchemas()) {
      expect(schema.service).toBeTruthy();
      expect(schema.label).toBeTruthy();
      expect(schema.description).toBeTruthy();
      expect(schema.schemes.length).toBeGreaterThan(0);
      expect(schema.category).toBeTruthy();
      expect(schema.iconHint).toBeTruthy();
      expect(schema.fields.length).toBeGreaterThan(0);
    }
  });
});

describe('getServiceSchema', () => {
  it('returns schema for known service', () => {
    const schema = getServiceSchema('discord');
    expect(schema).toBeDefined();
    expect(schema?.service).toBe('discord');
    expect(schema?.label).toBe('Discord');
  });

  it('returns undefined for unknown service', () => {
    expect(getServiceSchema('nonexistent')).toBeUndefined();
  });
});

describe('searchServices', () => {
  it('returns all schemas for empty query', () => {
    expect(searchServices('').length).toBe(11);
  });

  it('finds discord by label', () => {
    const results = searchServices('Discord');
    expect(results.some(s => s.service === 'discord')).toBe(true);
  });

  it('finds services by category', () => {
    const results = searchServices('push');
    expect(results.some(s => s.service === 'pushover')).toBe(true);
    expect(results.some(s => s.service === 'pushbullet')).toBe(true);
  });

  it('finds services by scheme', () => {
    const results = searchServices('tgram');
    expect(results.some(s => s.service === 'telegram')).toBe(true);
  });

  it('finds services by description keyword', () => {
    const results = searchServices('webhook');
    expect(results.length).toBeGreaterThan(0);
  });

  it('is case-insensitive', () => {
    const lower = searchServices('discord');
    const upper = searchServices('DISCORD');
    expect(lower.length).toBe(upper.length);
  });

  it('returns empty array for no matches', () => {
    expect(searchServices('zzznomatch')).toHaveLength(0);
  });
});

describe('getServicesByCategory', () => {
  it('returns only chat services', () => {
    const results = getServicesByCategory('chat');
    expect(results.every(s => s.category === 'chat')).toBe(true);
    expect(results.some(s => s.service === 'discord')).toBe(true);
    expect(results.some(s => s.service === 'slack')).toBe(true);
    expect(results.some(s => s.service === 'telegram')).toBe(true);
    expect(results.some(s => s.service === 'msteams')).toBe(true);
  });

  it('returns push services', () => {
    const results = getServicesByCategory('push');
    expect(results.some(s => s.service === 'pushover')).toBe(true);
    expect(results.some(s => s.service === 'pushbullet')).toBe(true);
  });

  it('returns self-hosted services', () => {
    const results = getServicesByCategory('self-hosted');
    expect(results.some(s => s.service === 'ntfy')).toBe(true);
    expect(results.some(s => s.service === 'gotify')).toBe(true);
  });
});

describe('getCategories', () => {
  it('returns all 5 categories', () => {
    const cats = getCategories();
    const keys = cats.map(c => c.key);
    expect(keys).toContain('chat');
    expect(keys).toContain('push');
    expect(keys).toContain('email');
    expect(keys).toContain('webhook');
    expect(keys).toContain('self-hosted');
  });

  it('includes display labels', () => {
    const cats = getCategories();
    for (const cat of cats) {
      expect(cat.label).toBeTruthy();
    }
  });

  it('includes correct counts', () => {
    const cats = getCategories();
    const chat = cats.find(c => c.key === 'chat');
    expect(chat?.count).toBeGreaterThanOrEqual(4); // discord, slack, telegram, msteams
  });
});
