import request from 'supertest';
import { jest } from '@jest/globals';

// Mock Redis BEFORE importing the app
jest.unstable_mockModule('../src/shared/utils/cache.js', () => ({
  getRedisClient: jest.fn(() => ({
    call: jest.fn(() => Promise.resolve('OK')),
    incr: jest.fn(() => Promise.resolve(1)),
    expire: jest.fn(() => Promise.resolve(1)),
    status: 'ready',
    on: jest.fn(),
  })),
  getPubSub: jest.fn(() => ({ pub: {}, sub: {} })),
  cacheGet: jest.fn(() => Promise.resolve(null)),
  cacheSet: jest.fn(() => Promise.resolve('OK')),
  cacheSetNX: jest.fn(() => Promise.resolve(true)),
  cacheDel: jest.fn(() => Promise.resolve(1)),
  cacheDelPattern: jest.fn(() => Promise.resolve(1)),
  getCacheVersion: jest.fn(() => Promise.resolve(1)),
  bumpCacheVersion: jest.fn(() => Promise.resolve(1)),
  blacklistToken: jest.fn(() => Promise.resolve('OK')),
  isTokenBlacklisted: jest.fn(() => Promise.resolve(false)),
  default: {
    cacheGet: jest.fn(),
    cacheSet: jest.fn(),
  }
}));




const { createApp } = await import('../src/app.js');
const app = createApp();

describe('Adaptive Rate Limiting & Bot Shield', () => {

  test('Normal request should have standard limits (500)', async () => {
    const res = await request(app)
      .get('/api/test')
      .set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')

      .set('accept-language', 'en-US')
      .set('sec-ch-ua', '"Google Chrome";v="119"');

    // Ignore 500 error (DB missing in test), we only care about middleware headers
    expect(res.headers['ratelimit-limit']).toBeDefined();
    expect(parseInt(res.headers['ratelimit-limit'])).toBe(500);
  });

  test('Bot request should have halved limits (250)', async () => {
    const res = await request(app)
      .get('/api/v1/catalog')
      .set('User-Agent', 'axios/1.6.0');

    expect(res.headers['ratelimit-limit']).toBeDefined();
    expect(parseInt(res.headers['ratelimit-limit'])).toBeLessThanOrEqual(250);
  });

  test('Bot should be blocked from purchase route', async () => {
    const res = await request(app)
      .post('/api/v1/tickets/purchase')
      .set('User-Agent', 'headless-chrome');

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('ERR_BOT_DETECTED');
  });

  test('Sensitive catalog routes should use pricingScraperLimiter (100)', async () => {
    const res = await request(app)
      .get('/api/v1/catalog/123/dynamic-prices')
      .set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')
      .set('accept-language', 'en-US')
      .set('sec-ch-ua', '"Google Chrome";v="119"');

    expect(res.headers['ratelimit-limit']).toBeDefined();
    expect(parseInt(res.headers['ratelimit-limit'])).toBeLessThanOrEqual(100);
  });


});
