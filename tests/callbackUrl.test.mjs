import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeCallbackUrl } from '../lib/callbackUrl.mjs';
import { getTrustedApplicationOrigin } from '../lib/server/trustedOrigin.mjs';

const TRUSTED_ORIGIN = 'https://theory-hamodi.com';

test('keeps a valid local path and normalizes a same-origin absolute URL', () => {
  assert.equal(
    sanitizeCallbackUrl('/courses/car?lang=he#question-2', TRUSTED_ORIGIN),
    '/courses/car?lang=he#question-2'
  );
  assert.equal(
    sanitizeCallbackUrl(
      'https://theory-hamodi.com/courses/boat?lang=ar#start',
      TRUSTED_ORIGIN
    ),
    '/courses/boat?lang=ar#start'
  );
});

test('rejects foreign, non-HTTP, protocol-relative, and backslash callback forms', () => {
  const invalid = [
    'http://evil.example/steal',
    'https://evil.example/steal',
    'javascript:alert(1)',
    'data:text/html,evil',
    '//evil.example/steal',
    '/\\evil.example/steal',
    '\\evil.example/steal',
  ];
  for (const candidate of invalid) {
    assert.equal(sanitizeCallbackUrl(candidate, TRUSTED_ORIGIN), '/');
  }
});

test('rejects encoded and repeatedly encoded backslashes or protocol-relative forms', () => {
  const invalid = [
    '/%5cevil.example/steal',
    '/%255cevil.example/steal',
    '%2f%2fevil.example/steal',
    '%252f%252fevil.example/steal',
    '/%2f%2fevil.example/steal',
    '/%252f%252fevil.example/steal',
  ];
  for (const candidate of invalid) {
    assert.equal(sanitizeCallbackUrl(candidate, TRUSTED_ORIGIN), '/');
  }
});

test('rejects protocol-relative paths created by URL dot-segment normalization', () => {
  const invalid = ['/.//evil.example/steal', '/%2e%2e//evil.example/steal'];
  for (const candidate of invalid) {
    assert.equal(sanitizeCallbackUrl(candidate, TRUSTED_ORIGIN), '/');
  }
});

test('rejects non-HTTP, incomplete, and encoded URI schemes', () => {
  const invalid = [
    'blob:https://theory-hamodi.com/object',
    'https:evil.example',
    'javascript%3Aalert(1)',
    'data%3Atext/html,evil',
  ];
  for (const candidate of invalid) {
    assert.equal(sanitizeCallbackUrl(candidate, TRUSTED_ORIGIN), '/');
  }
});

test('fails closed when validation cannot reach a stable decoded form within the pass limit', () => {
  assert.equal(
    sanitizeCallbackUrl(
      '%2525252525252F%2525252525252Fevil.example/steal',
      TRUSTED_ORIGIN
    ),
    '/'
  );
});

test('rejects malformed encoding, controls, credentials, and oversized input', () => {
  const invalid = [
    '/%E0%A4%A',
    '/safe\nhttps://evil.example',
    '/safe\u0000tail',
    'https://user:password@theory-hamodi.com/private',
    '/' + 'a'.repeat(2048),
  ];
  for (const candidate of invalid) {
    assert.equal(sanitizeCallbackUrl(candidate, TRUSTED_ORIGIN), '/');
  }
});

test('falls back literally when the trusted origin or candidate is invalid', () => {
  assert.equal(sanitizeCallbackUrl('/courses/car', 'not a URL'), '/');
  assert.equal(
    sanitizeCallbackUrl('/courses/car', 'ftp://theory-hamodi.com'),
    '/'
  );
  assert.equal(
    sanitizeCallbackUrl('/courses/car', 'https://user:pass@theory-hamodi.com'),
    '/'
  );
  assert.equal(
    sanitizeCallbackUrl('/courses/car', 'https://theory-hamodi.com\n'),
    '/'
  );
  assert.equal(
    sanitizeCallbackUrl(
      '/courses/car',
      'https://theory-hamodi.com\\@evil.example'
    ),
    '/'
  );
  assert.equal(sanitizeCallbackUrl('', TRUSTED_ORIGIN), '/');
  assert.equal(sanitizeCallbackUrl(null, TRUSTED_ORIGIN), '/');
});

test('derives the application origin only from a validated NEXTAUTH_URL', () => {
  const previous = process.env.NEXTAUTH_URL;
  try {
    process.env.NEXTAUTH_URL =
      'https://theory-hamodi.com/auth/callback?source=test';
    assert.equal(getTrustedApplicationOrigin(), TRUSTED_ORIGIN);

    process.env.NEXTAUTH_URL = 'https://user:pass@theory-hamodi.com';
    assert.equal(getTrustedApplicationOrigin(), null);

    process.env.NEXTAUTH_URL = 'https://theory-hamodi.com\n';
    assert.equal(getTrustedApplicationOrigin(), null);

    delete process.env.NEXTAUTH_URL;
    assert.equal(getTrustedApplicationOrigin('https://attacker.example'), null);
  } finally {
    if (previous === undefined) delete process.env.NEXTAUTH_URL;
    else process.env.NEXTAUTH_URL = previous;
  }
});
