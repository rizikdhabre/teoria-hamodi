import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { NextResponse } from 'next/server.js';
import * as seaCourseGrantModule from '../lib/server/seaCourseGrant.mjs';

const {
  SEA_COURSE_COOKIE_NAME,
  SeaCourseGrantConfigurationError,
  getSeaCourseCookieClearOptions,
  getSeaCourseCookieOptions,
  signSeaCourseGrant,
  verifySeaCourseGrant,
} = seaCourseGrantModule;

const TEST_SECRET = 'test-only-nextauth-secret-not-from-environment';
const USER_ID = 'user-123';
const NOW = 2_000_000_000;
const DOMAIN_LABEL = 'theory-hamodi:sea-course-access:v1';

function testKey(secret = TEST_SECRET) {
  return createHmac('sha256', secret).update(DOMAIN_LABEL).digest();
}

function signFixture(payload, algorithm = 'HS256') {
  return jwt.sign(payload, testKey(), { algorithm });
}

test('signs a domain-separated HS256 grant with the exact claims and 900-second lifetime', () => {
  const token = signSeaCourseGrant(USER_ID, TEST_SECRET, NOW);
  const decoded = jwt.decode(token, { complete: true });
  assert.equal(decoded.header.alg, 'HS256');
  assert.deepEqual(decoded.payload, {
    purpose: 'sea-course-access',
    version: 1,
    sub: USER_ID,
    iat: NOW,
    exp: NOW + 900,
    iss: 'theory-hamodi',
    aud: 'sea-course-access',
  });
  assert.equal(
    jwt.verify(token, testKey(), { algorithms: ['HS256'] }).sub,
    USER_ID
  );
  assert.equal(verifySeaCourseGrant(token, USER_ID, TEST_SECRET, NOW), true);
});

test('accepts the five-second future-issued boundary and rejects unsafe timing claims', () => {
  const validPayload = jwt.decode(
    signSeaCourseGrant(USER_ID, TEST_SECRET, NOW)
  );
  assert.equal(
    verifySeaCourseGrant(
      signFixture({ ...validPayload, iat: NOW + 5, exp: NOW + 905 }),
      USER_ID,
      TEST_SECRET,
      NOW
    ),
    true
  );

  const invalidTiming = [
    { ...validPayload, iat: NOW - 901, exp: NOW - 1 },
    { ...validPayload, iat: NOW + 6, exp: NOW + 906 },
    { ...validPayload, exp: NOW + 899 },
    { ...validPayload, iat: 0, exp: 900 },
    { ...validPayload, iat: NOW + 0.5, exp: NOW + 900.5 },
  ];
  for (const payload of invalidTiming) {
    assert.equal(
      verifySeaCourseGrant(signFixture(payload), USER_ID, TEST_SECRET, NOW),
      false
    );
  }
});

test('rejects tampering, broken token structures, and the legacy boolean cookie', () => {
  const validToken = signSeaCourseGrant(USER_ID, TEST_SECRET, NOW);
  const [header, payload, signature] = validToken.split('.');
  const modifiedPayload = Buffer.from(
    JSON.stringify({ ...jwt.decode(validToken), purpose: 'tampered' })
  ).toString('base64url');
  const changedSignature =
    (signature[0] === 'a' ? 'b' : 'a') + signature.slice(1);
  const invalid = [
    `${header}.${modifiedPayload}.${signature}`,
    `${header}.${payload}.${changedSignature}`,
    `${header}.${payload}.${signature.slice(0, -1)}`,
    `${header}.${payload}`,
    'not-a-token',
    'true',
  ];
  for (const token of invalid) {
    assert.equal(verifySeaCourseGrant(token, USER_ID, TEST_SECRET, NOW), false);
  }
});

test('rejects correctly signed grants with wrong identity or fixed claims', () => {
  const validPayload = jwt.decode(
    signSeaCourseGrant(USER_ID, TEST_SECRET, NOW)
  );
  const invalidPayloads = [
    { ...validPayload, purpose: 'other-purpose' },
    { ...validPayload, version: 2 },
    { ...validPayload, sub: 'different-user' },
    { ...validPayload, iss: 'different-issuer' },
    { ...validPayload, aud: 'different-audience' },
  ];
  for (const payload of invalidPayloads) {
    assert.equal(
      verifySeaCourseGrant(signFixture(payload), USER_ID, TEST_SECRET, NOW),
      false
    );
  }
  assert.equal(
    verifySeaCourseGrant(
      signFixture(validPayload, 'HS384'),
      USER_ID,
      TEST_SECRET,
      NOW
    ),
    false
  );
});

test('fails closed when the signing secret is missing or empty', () => {
  assert.throws(
    () => signSeaCourseGrant(USER_ID, undefined, NOW),
    SeaCourseGrantConfigurationError
  );
  assert.throws(
    () => signSeaCourseGrant(USER_ID, '', NOW),
    SeaCourseGrantConfigurationError
  );
  assert.equal(
    verifySeaCourseGrant(
      signSeaCourseGrant(USER_ID, TEST_SECRET, NOW),
      USER_ID,
      undefined,
      NOW
    ),
    false
  );
  assert.equal(
    verifySeaCourseGrant(
      signSeaCourseGrant(USER_ID, TEST_SECRET, NOW),
      USER_ID,
      '',
      NOW
    ),
    false
  );
});

test('uses the exact sea-course cookie name and scoped issuance and clearing options', () => {
  assert.equal(SEA_COURSE_COOKIE_NAME, 'sea_course_access');
  assert.deepEqual(getSeaCourseCookieOptions('production'), {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/courses',
    maxAge: 900,
  });
  assert.equal(getSeaCourseCookieOptions('development').secure, false);
  assert.deepEqual(getSeaCourseCookieClearOptions('production'), {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/courses',
    maxAge: 0,
    expires: new Date(0),
  });
});

test('grant issuance keeps the signed course cookie while expiring the legacy root cookie', () => {
  assert.equal(
    typeof seaCourseGrantModule.setSeaCourseGrantCookies,
    'function'
  );

  const response = NextResponse.json({ success: true });
  seaCourseGrantModule.setSeaCourseGrantCookies(
    response,
    'signed-grant',
    'production'
  );

  const setCookieHeaders = response.headers.getSetCookie();
  assert.equal(setCookieHeaders.length, 2);
  assert.match(
    setCookieHeaders[0],
    /^sea_course_access=signed-grant; Path=\/courses; .*Max-Age=900; Secure; HttpOnly; SameSite=lax$/
  );
  assert.equal(
    setCookieHeaders[1],
    'sea_course_access=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; Secure; HttpOnly; SameSite=lax'
  );
});

test('grant clearing expires both the current course cookie and the legacy root cookie', () => {
  assert.equal(
    typeof seaCourseGrantModule.clearSeaCourseGrantCookies,
    'function'
  );

  const response = new NextResponse(null, { status: 303 });
  seaCourseGrantModule.clearSeaCourseGrantCookies(response, 'production');

  assert.deepEqual(response.headers.getSetCookie(), [
    'sea_course_access=; Path=/courses; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; Secure; HttpOnly; SameSite=lax',
    'sea_course_access=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; Secure; HttpOnly; SameSite=lax',
  ]);
});

test('development migration headers remain usable over local HTTP', () => {
  const issuanceResponse = NextResponse.json({ success: true });
  seaCourseGrantModule.setSeaCourseGrantCookies(
    issuanceResponse,
    'signed-grant',
    'development'
  );

  const clearingResponse = new NextResponse(null, { status: 303 });
  seaCourseGrantModule.clearSeaCourseGrantCookies(
    clearingResponse,
    'development'
  );

  for (const response of [issuanceResponse, clearingResponse]) {
    const setCookieHeaders = response.headers.getSetCookie();
    assert.equal(setCookieHeaders.length, 2);
    assert.match(setCookieHeaders[0], /Path=\/courses/);
    assert.match(setCookieHeaders[1], /Path=\//);
    assert.doesNotMatch(setCookieHeaders[0], /; Secure/);
    assert.doesNotMatch(setCookieHeaders[1], /; Secure/);
  }
});
