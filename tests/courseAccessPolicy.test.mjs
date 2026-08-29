import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AuthenticationRequiredError,
  SeaCourseGrantRequiredError,
  createCourseAccessGuard,
} from '../lib/courseAccessPolicy.mjs';
import {
  InvalidCourseTypeError,
  assertCourseType,
} from '../lib/courseTypes.mjs';

function createGuard({
  session = { user: { id: 'user-123' } },
  cookie,
  grantValid = false,
  calls = [],
} = {}) {
  return createCourseAccessGuard({
    async getSession() {
      calls.push('session');
      return session;
    },
    assertType(value) {
      calls.push('type');
      return assertCourseType(value);
    },
    async readSeaCourseCookie() {
      calls.push('grant');
      return cookie;
    },
    async verifyGrant(token, userId) {
      calls.push('verify');
      return grantValid && token === 'signed-grant' && userId === 'user-123';
    },
  });
}

test('authentication-only access succeeds without reading a sea grant', async () => {
  const calls = [];
  const guard = createGuard({ calls });
  assert.deepEqual(await guard.requireAuthenticatedUser(), {
    session: { user: { id: 'user-123' } },
    userId: 'user-123',
  });
  assert.deepEqual(calls, ['session']);
});

test('all course modes authenticate before type validation', async () => {
  for (const method of [
    'requireAuthenticatedCourseType',
    'requireCourseAccess',
  ]) {
    const unauthenticatedCalls = [];
    const unauthenticated = createGuard({
      session: null,
      calls: unauthenticatedCalls,
    });
    await assert.rejects(
      () => unauthenticated[method]('unknown'),
      AuthenticationRequiredError
    );
    assert.deepEqual(unauthenticatedCalls, ['session']);

    const authenticatedCalls = [];
    const authenticated = createGuard({ calls: authenticatedCalls });
    await assert.rejects(
      () => authenticated[method]('unknown'),
      InvalidCourseTypeError
    );
    assert.deepEqual(authenticatedCalls, ['session', 'type']);
  }
});

test('non-sea full access succeeds without consulting a grant', async () => {
  const calls = [];
  const guard = createGuard({ calls });
  assert.deepEqual(await guard.requireCourseAccess('car'), {
    session: { user: { id: 'user-123' } },
    userId: 'user-123',
    type: 'car',
  });
  assert.deepEqual(calls, ['session', 'type']);
});

test('sea access distinguishes a missing grant from an invalid grant', async () => {
  const missing = createGuard();
  await assert.rejects(
    () => missing.requireCourseAccess('jetski'),
    (error) =>
      error instanceof SeaCourseGrantRequiredError && error.reason === 'missing'
  );

  const invalid = createGuard({ cookie: 'forged-grant' });
  await assert.rejects(
    () => invalid.requireCourseAccess('boat'),
    (error) =>
      error instanceof SeaCourseGrantRequiredError && error.reason === 'invalid'
  );

  const malformed = createGuard({ cookie: true });
  await assert.rejects(
    () => malformed.requireCourseAccess('boat'),
    (error) =>
      error instanceof SeaCourseGrantRequiredError && error.reason === 'invalid'
  );
});

test('one valid user-bound grant admits both sea types in session, type, grant order', async () => {
  for (const type of ['jetski', 'boat']) {
    const calls = [];
    const guard = createGuard({
      cookie: 'signed-grant',
      grantValid: true,
      calls,
    });
    assert.equal((await guard.requireCourseAccess(type)).type, type);
    assert.deepEqual(calls, ['session', 'type', 'grant', 'verify']);
  }
});

test('empty user identifiers are unauthenticated', async () => {
  for (const id of [undefined, null, '', '   ']) {
    const guard = createGuard({ session: { user: { id } } });
    await assert.rejects(
      () => guard.requireAuthenticatedUser(),
      AuthenticationRequiredError
    );
  }
});
