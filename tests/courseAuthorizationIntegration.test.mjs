import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  SEA_COURSE_COOKIE_NAME,
  getSeaCourseCookieClearOptions,
  getSeaCourseCookieOptions,
} from '../lib/server/seaCourseGrant.mjs';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));

function readSource(relativePath) {
  return readFile(path.join(projectRoot, relativePath), 'utf8');
}

function exportedFunctionSource(source, name, nextName) {
  const startMarker = `export async function ${name}`;
  const start = source.indexOf(startMarker);
  assert.notEqual(start, -1, `missing ${startMarker}`);

  const end = nextName
    ? source.indexOf(
        `export async function ${nextName}`,
        start + startMarker.length
      )
    : source.length;
  assert.notEqual(end, -1, `missing export async function ${nextName}`);
  return source.slice(start, end);
}

function assertAppearsInOrder(source, expectations) {
  let cursor = 0;
  for (const [label, pattern] of expectations) {
    const match = pattern.exec(source.slice(cursor));
    assert.ok(match, `missing ${label}`);
    cursor += match.index + match[0].length;
  }
}

test('NextAuth session identity comes only from the JWT token id', async () => {
  const source = await readSource('app/api/auth/[...nextauth]/route.js');
  const callback = source.slice(source.indexOf('async session'));
  const assignments = [
    ...callback.matchAll(/session\.user\.id\s*=\s*([^;]+);/g),
  ].map((match) => match[1].trim());

  assert.deepEqual(assignments, ['token.id']);
});

test('course password issuance authenticates before request and password access', async () => {
  const source = await readSource('app/api/coursePassword/route.js');
  const post = exportedFunctionSource(source, 'POST');

  assertAppearsInOrder(post, [
    ['authentication-only guard', /await\s+requireAuthenticatedUser\s*\(\s*\)/],
    ['request JSON parsing', /await\s+request\.json\s*\(\s*\)/],
    [
      'users collection access',
      /await\s+getCollection\s*\(\s*['"]users['"]\s*\)/,
    ],
    ['password verification', /await\s+bcrypt\.compare\s*\(/],
    ['user-bound grant signing', /signSeaCourseGrant\s*\(\s*userId\s*,/],
  ]);
  assert.doesNotMatch(post, /\brequireCourseAccess\s*\(/);
  assert.match(post, /error\s+instanceof\s+AuthenticationRequiredError/);
  assert.match(post, /status:\s*401/);
  assert.match(
    post,
    /response\.cookies\.set\s*\(\s*SEA_COURSE_COOKIE_NAME\s*,\s*grant\s*,\s*getSeaCourseCookieOptions\s*\(\s*process\.env\.NODE_ENV\s*\)/s
  );
});

test('both question actions authorize before deriving or opening a collection', async () => {
  const source = await readSource('app/courses/[type]/actions.js');
  const rangeAction = exportedFunctionSource(
    source,
    'fetchQuestionsByRange',
    'fetchQuestionsCount'
  );
  const countAction = exportedFunctionSource(source, 'fetchQuestionsCount');

  for (const action of [rangeAction, countAction]) {
    assertAppearsInOrder(action, [
      ['full course guard', /await\s+requireCourseAccess\s*\(/],
      [
        'canonical collection derivation',
        /getQuestionCollectionName\s*\(\s*validatedType\s*\)/,
      ],
      ['collection access', /await\s+getCollection\s*\(\s*collectionName\s*\)/],
    ]);
    assert.doesNotMatch(action, /`\$\{type\}questions`/);
  }
});

test('course landing, questions, and exam pages invoke full server access', async () => {
  const landing = await readSource('app/courses/[type]/page.js');
  const questions = await readSource('app/courses/[type]/questions/page.js');
  const exam = await readSource('app/courses/[type]/exam/page.js');

  assert.match(
    landing,
    /await\s+requireCourseAccess\s*\(\s*type\s*,\s*['"]\/courses\/['"]\s*\+\s*type\s*\)/s
  );
  assertAppearsInOrder(questions.slice(questions.indexOf('export default')), [
    ['full course guard', /await\s+requireCourseAccess\s*\(/],
    ['question range loader', /fetchQuestionsByRange\s*\(\s*validatedType\s*,/],
    ['question count loader', /fetchQuestionsCount\s*\(\s*validatedType\s*\)/],
  ]);
  assert.match(
    questions,
    /['"]\/courses\/['"]\s*\+\s*type\s*\+\s*['"]\/questions['"]/
  );
  assert.match(exam, /['"]\/courses\/['"]\s*\+\s*type\s*\+\s*['"]\/exam['"]/);
});

test('exam authorization precedes canonical collection construction and access', async () => {
  const source = await readSource('app/courses/[type]/exam/page.js');
  const page = source.slice(source.indexOf('export default'));

  assertAppearsInOrder(page, [
    ['full course guard', /await\s+requireCourseAccess\s*\(/],
    ['total-size computation', /totalSize\s*=/],
    [
      'canonical collection derivation',
      /getQuestionCollectionName\s*\(\s*validatedType\s*\)/,
    ],
    [
      'main collection access',
      /await\s+getCollection\s*\(\s*collectionName\s*\)/,
    ],
    [
      'fixed car collection access',
      /await\s+getCollection\s*\(\s*['"]carquestions['"]\s*\)/,
    ],
  ]);
  assert.doesNotMatch(page, /`\$\{type\}questions`/);
});

test('server adapter maps typed failures without database access or raw redirects', async () => {
  const source = await readSource('lib/server/courseAccess.js');

  assert.match(source, /createCourseAccessGuard\s*\(/);
  assert.match(source, /getServerSession\s*\(\s*authOptions\s*\)/);
  assert.match(source, /\.get\s*\(\s*SEA_COURSE_COOKIE_NAME\s*\)[^;]*\.value/s);
  assert.match(
    source,
    /verifySeaCourseGrant\s*\([^)]*process\.env\.NEXTAUTH_SECRET/s
  );
  assert.match(source, /error\s+instanceof\s+AuthenticationRequiredError/);
  assert.match(source, /error\s+instanceof\s+InvalidCourseTypeError/);
  assert.match(source, /error\s+instanceof\s+SeaCourseGrantRequiredError/);
  assert.match(source, /notFound\s*\(\s*\)/);
  assert.match(source, /\/courses\/access\/clear\?type=/);
  assert.doesNotMatch(source, /\bgetCollection\b/);

  const access = exportedFunctionSource(source, 'requireCourseAccess');
  assertAppearsInOrder(access, [
    [
      'policy access attempt',
      /await\s+courseAccessGuard\.requireCourseAccess\s*\(/,
    ],
    ['post-failure canonical type check', /isCourseType\s*\(\s*type\s*\)/],
  ]);
});

test('sea cookie issuance and clearing share the exact scoped contract', async () => {
  const issuance = getSeaCourseCookieOptions('production');
  const clearing = getSeaCourseCookieClearOptions('production');
  const route = await readSource('app/courses/access/clear/route.js');

  assert.equal(SEA_COURSE_COOKIE_NAME, 'sea_course_access');
  assert.equal(issuance.path, '/courses');
  assert.equal(clearing.path, issuance.path);
  assert.equal(clearing.httpOnly, issuance.httpOnly);
  assert.equal(clearing.secure, issuance.secure);
  assert.equal(clearing.sameSite, issuance.sameSite);
  assert.equal(clearing.maxAge, 0);
  assert.equal(clearing.expires.getTime(), 0);
  assert.match(
    route,
    /type\s*!==\s*['"]jetski['"]\s*&&\s*type\s*!==\s*['"]boat['"]/
  );
  assert.match(route, /status:\s*404/);
  assert.match(route, /status:\s*303/);
  assert.match(route, /Location:\s*['"]\/\?courseAccess=['"]\s*\+\s*type/);
  assert.match(
    route,
    /cookies\.set\s*\(\s*SEA_COURSE_COOKIE_NAME\s*,\s*['"]['"]\s*,\s*getSeaCourseCookieClearOptions/s
  );
});

test('login server sanitizes the sole callback prop and client uses only that prop', async () => {
  const page = await readSource('app/(auth)/login/page.js');
  const client = await readSource('app/(auth)/login/LoginClient.js');

  assertAppearsInOrder(page, [
    ['trusted application origin', /getTrustedApplicationOrigin\s*\(\s*\)/],
    [
      'callback sanitization',
      /sanitizeCallbackUrl\s*\(\s*rawCallbackUrl\s*,\s*trustedOrigin\s*,\s*['"]\/['"]\s*\)/,
    ],
    ['existing-session redirect', /redirect\s*\(\s*callbackUrl\s*\)/],
    [
      'sanitized client prop',
      /<LoginClient\s+callbackUrl=\{callbackUrl\}\s*\/>/,
    ],
  ]);
  assert.match(
    client,
    /function\s+LoginClient\s*\(\s*\{\s*callbackUrl\s*\}\s*\)/
  );
  assert.doesNotMatch(
    client,
    /searchParams\.get\s*\(\s*['"]callbackUrl['"]\s*\)/
  );
  assert.doesNotMatch(client, /\bres\.url\b/);
  assert.match(client, /signIn\s*\([\s\S]*?callbackUrl\s*,/);
  assert.match(client, /router\.push\s*\(\s*callbackUrl\s*\)/);
});
