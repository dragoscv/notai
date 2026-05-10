import { describe, it, expect } from 'vitest';
import { buildOpenApiSpec } from './openapi-spec';

describe('openapi spec', () => {
  const spec = buildOpenApiSpec('https://notai.app');

  it('declares OpenAPI 3.1 + version + title', () => {
    expect(spec.openapi).toBe('3.1.0');
    expect(spec.info.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(spec.info.title).toContain('Notai');
  });

  it('uses the provided base URL for the production server', () => {
    expect(spec.servers[0]?.url).toBe('https://notai.app/api/v1');
  });

  it('exposes the documented note endpoints', () => {
    expect(Object.keys(spec.paths)).toEqual(expect.arrayContaining(['/notes', '/notes/{id}']));
    const list = spec.paths['/notes'];
    expect(list).toBeDefined();
    expect(list && 'get' in list).toBe(true);
    expect(list && 'post' in list).toBe(true);
    const item = spec.paths['/notes/{id}'];
    expect(item).toBeDefined();
    expect(item && 'get' in item).toBe(true);
    expect(item && 'patch' in item).toBe(true);
    expect(item && 'delete' in item).toBe(true);
  });

  it('declares bearerAuth security globally', () => {
    expect(spec.security).toEqual([{ bearerAuth: [] }]);
    const schemes = (spec.components as { securitySchemes?: Record<string, unknown> })
      .securitySchemes;
    expect(schemes && 'bearerAuth' in schemes).toBe(true);
  });
});
