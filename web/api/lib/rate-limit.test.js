import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkRateLimit } from './rate-limit.js';

test('allows up to 100 and blocks the next request', () => {
  for (let i = 0; i < 100; i++) {
    assert.equal(checkRateLimit('u1').allowed, true);
  }
  const blocked = checkRateLimit('u1');
  assert.equal(blocked.allowed, false);
  assert.ok(blocked.retryAfterSeconds > 0);
});

test('different uids have independent limits', () => {
  for (let i = 0; i < 100; i++) checkRateLimit('u2');
  assert.equal(checkRateLimit('u3').allowed, true);
});
