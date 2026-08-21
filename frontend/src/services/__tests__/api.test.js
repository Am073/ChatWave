import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import api from '../api';

describe('api service', () => {
  beforeEach(() => {
    // Reset cookies before each test.
    document.cookie.split(';').forEach((c) => {
      const eqPos = c.indexOf('=');
      const name = eqPos > -1 ? c.substring(0, eqPos).trim() : c.trim();
      document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('uses the configured baseURL', () => {
    expect(api.defaults.baseURL).toMatch(/\/api$/);
  });

  it('attaches the CSRF token from the cookie', () => {
    document.cookie = 'csrf_token=abc123;path=/';
    const interceptor = api.interceptors.request.handlers[0].fulfilled;
    const config = { headers: {} };
    const out = interceptor(config);
    expect(out.headers['X-CSRF-Token']).toBe('abc123');
  });

  it('sends requests with credentials', () => {
    expect(api.defaults.withCredentials).toBe(true);
  });
});
