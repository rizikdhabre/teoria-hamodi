import { createHmac } from 'node:crypto';
import jwt from 'jsonwebtoken';

export const SEA_COURSE_COOKIE_NAME = 'sea_course_access';

const GRANT_LIFETIME_SECONDS = 900;
const FUTURE_IAT_TOLERANCE_SECONDS = 5;
const GRANT_PURPOSE = 'sea-course-access';
const GRANT_VERSION = 1;
const GRANT_ISSUER = 'theory-hamodi';
const GRANT_AUDIENCE = 'sea-course-access';
const KEY_DOMAIN_LABEL = 'theory-hamodi:sea-course-access:v1';

export class SeaCourseGrantConfigurationError extends Error {
  constructor(message = 'Sea course grant secret is not configured') {
    super(message);
    this.name = 'SeaCourseGrantConfigurationError';
  }
}

function hasSecret(secret) {
  return typeof secret === 'string' && secret.length > 0;
}

function hasUserId(userId) {
  return typeof userId === 'string' && userId.trim().length > 0;
}

function deriveKey(secret) {
  if (!hasSecret(secret)) throw new SeaCourseGrantConfigurationError();
  return createHmac('sha256', secret).update(KEY_DOMAIN_LABEL).digest();
}

function currentEpochSeconds() {
  return Math.floor(Date.now() / 1000);
}

export function signSeaCourseGrant(
  userId,
  secret,
  nowSeconds = currentEpochSeconds()
) {
  if (!hasUserId(userId)) throw new TypeError('A nonempty user ID is required');
  if (!Number.isInteger(nowSeconds) || nowSeconds <= 0)
    throw new TypeError('A positive integer epoch is required');

  const payload = {
    purpose: GRANT_PURPOSE,
    version: GRANT_VERSION,
    sub: userId,
    iat: nowSeconds,
    exp: nowSeconds + GRANT_LIFETIME_SECONDS,
    iss: GRANT_ISSUER,
    aud: GRANT_AUDIENCE,
  };
  return jwt.sign(payload, deriveKey(secret), { algorithm: 'HS256' });
}

export function verifySeaCourseGrant(
  token,
  userId,
  secret,
  nowSeconds = currentEpochSeconds()
) {
  if (
    !hasSecret(secret) ||
    !hasUserId(userId) ||
    typeof token !== 'string' ||
    token.length === 0
  )
    return false;
  if (!Number.isInteger(nowSeconds) || nowSeconds <= 0) return false;

  try {
    const payload = jwt.verify(token, deriveKey(secret), {
      algorithms: ['HS256'],
      issuer: GRANT_ISSUER,
      audience: GRANT_AUDIENCE,
      subject: userId,
      clockTimestamp: nowSeconds,
    });
    return (
      payload !== null &&
      typeof payload === 'object' &&
      payload.purpose === GRANT_PURPOSE &&
      payload.version === GRANT_VERSION &&
      payload.sub === userId &&
      payload.iss === GRANT_ISSUER &&
      payload.aud === GRANT_AUDIENCE &&
      Number.isInteger(payload.iat) &&
      payload.iat > 0 &&
      Number.isInteger(payload.exp) &&
      payload.exp > 0 &&
      payload.exp - payload.iat === GRANT_LIFETIME_SECONDS &&
      payload.iat <= nowSeconds + FUTURE_IAT_TOLERANCE_SECONDS &&
      payload.exp > nowSeconds
    );
  } catch {
    return false;
  }
}

export function getSeaCourseCookieOptions(nodeEnv) {
  return {
    httpOnly: true,
    secure: nodeEnv === 'production',
    sameSite: 'lax',
    path: '/courses',
    maxAge: GRANT_LIFETIME_SECONDS,
  };
}

export function getSeaCourseCookieClearOptions(nodeEnv) {
  return {
    ...getSeaCourseCookieOptions(nodeEnv),
    maxAge: 0,
    expires: new Date(0),
  };
}

function getLegacySeaCourseCookieClearOptions(nodeEnv) {
  return {
    httpOnly: true,
    secure: nodeEnv === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
    expires: new Date(0),
  };
}

function appendLegacySeaCourseCookieDeletion(response, nodeEnv) {
  const options = getLegacySeaCourseCookieClearOptions(nodeEnv);
  const attributes = [
    `${SEA_COURSE_COOKIE_NAME}=`,
    `Path=${options.path}`,
    `Expires=${options.expires.toUTCString()}`,
    `Max-Age=${options.maxAge}`,
    options.secure && 'Secure',
    options.httpOnly && 'HttpOnly',
    `SameSite=${options.sameSite}`,
  ].filter(Boolean);

  response.headers.append(
    'Set-Cookie',
    attributes.join('; ')
  );
}

export function setSeaCourseGrantCookies(response, grant, nodeEnv) {
  response.cookies.set(
    SEA_COURSE_COOKIE_NAME,
    grant,
    getSeaCourseCookieOptions(nodeEnv)
  );
  appendLegacySeaCourseCookieDeletion(response, nodeEnv);
}

export function clearSeaCourseGrantCookies(response, nodeEnv) {
  response.cookies.set(
    SEA_COURSE_COOKIE_NAME,
    '',
    getSeaCourseCookieClearOptions(nodeEnv)
  );
  appendLegacySeaCourseCookieDeletion(response, nodeEnv);
}
