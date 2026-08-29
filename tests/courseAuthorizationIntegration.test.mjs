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
import {
  AuthenticationRequiredError,
  SeaCourseGrantRequiredError,
} from '../lib/courseAccessPolicy.mjs';
import { InvalidCourseTypeError } from '../lib/courseTypes.mjs';
import { getCourseAccessRoutingDecision } from '../lib/courseAccessRouting.mjs';
import {
  CoursePasswordBadRequestError,
  getCoursePasswordErrorResponse,
  readCoursePassword,
} from '../lib/coursePasswordRequest.mjs';

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
    [
      'tested password request reader',
      /await\s+readCoursePassword\s*\(\s*request\s*\)/,
    ],
    [
      'users collection access',
      /await\s+getCollection\s*\(\s*['"]users['"]\s*\)/,
    ],
    ['password verification', /await\s+bcrypt\.compare\s*\(/],
    ['user-bound grant signing', /signSeaCourseGrant\s*\(\s*userId\s*,/],
  ]);
  assert.doesNotMatch(post, /\brequireCourseAccess\s*\(/);
  assert.doesNotMatch(post, /request\.json\s*\(/);
  assert.match(post, /getCoursePasswordErrorResponse\s*\(\s*error\s*\)/);
  assert.match(
    post,
    /setSeaCourseGrantCookies\s*\(\s*response\s*,\s*grant\s*,\s*process\.env\.NODE_ENV\s*\)/s
  );
  assert.doesNotMatch(post, /response\.cookies\.set\s*\(/);
});

test('password reader rejects malformed JSON and invalid password shapes', async () => {
  const invalidRequests = [
    {
      name: 'malformed JSON',
      request: {
        async json() {
          throw new SyntaxError('malformed');
        },
      },
    },
    {
      name: 'missing password',
      request: {
        async json() {
          return {};
        },
      },
    },
    {
      name: 'non-string password',
      request: {
        async json() {
          return { password: 42 };
        },
      },
    },
    {
      name: 'empty password',
      request: {
        async json() {
          return { password: '' };
        },
      },
    },
    {
      name: '257-character password',
      request: {
        async json() {
          return { password: 'x'.repeat(257) };
        },
      },
    },
  ];

  for (const { name, request } of invalidRequests) {
    await assert.rejects(
      () => readCoursePassword(request),
      CoursePasswordBadRequestError,
      name
    );
  }
});

test('password reader accepts the inclusive 1 through 256 character bounds', async () => {
  assert.equal(
    await readCoursePassword({
      async json() {
        return { password: 'x' };
      },
    }),
    'x'
  );
  const maximum = 'x'.repeat(256);
  assert.equal(
    await readCoursePassword({
      async json() {
        return { password: maximum };
      },
    }),
    maximum
  );
});

test('password boundary maps typed and unexpected failures to safe descriptors', async () => {
  assert.deepEqual(
    getCoursePasswordErrorResponse(new AuthenticationRequiredError()),
    { status: 401, body: { message: 'Authentication required' } }
  );
  assert.deepEqual(
    getCoursePasswordErrorResponse(new CoursePasswordBadRequestError()),
    { status: 400, body: { message: 'Invalid request' } }
  );
  assert.deepEqual(
    getCoursePasswordErrorResponse(
      new Error('NEXTAUTH_SECRET and signed-token-value')
    ),
    { status: 500, body: { message: 'Internal server error' } }
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

test('unauthenticated routing preserves only canonical non-sea requested paths', async () => {
  const error = new AuthenticationRequiredError();

  assert.deepEqual(
    getCourseAccessRoutingDecision(error, 'car', '/courses/car/questions'),
    {
      action: 'redirect',
      destination: '/login?callbackUrl=%2Fcourses%2Fcar%2Fquestions',
    }
  );
  assert.deepEqual(
    getCourseAccessRoutingDecision(error, 'car', 'https://evil.example'),
    {
      action: 'redirect',
      destination: '/login?callbackUrl=%2Fcourses%2Fcar',
    }
  );
});

test('unauthenticated sea and unknown types receive distinct safe callbacks', async () => {
  const error = new AuthenticationRequiredError();

  assert.deepEqual(
    getCourseAccessRoutingDecision(error, 'boat', '/courses/boat/exam'),
    {
      action: 'redirect',
      destination: '/login?callbackUrl=%2F%3FcourseAccess%3Dboat',
    }
  );
  assert.deepEqual(
    getCourseAccessRoutingDecision(
      error,
      'unknown',
      '/courses/unknown/questions'
    ),
    {
      action: 'redirect',
      destination: '/login?callbackUrl=%2F',
    }
  );
});

test('authenticated invalid course types produce a not-found decision', async () => {
  assert.deepEqual(
    getCourseAccessRoutingDecision(
      new InvalidCourseTypeError(),
      'unknown',
      '/courses/unknown'
    ),
    { action: 'notFound' }
  );
});

test('missing and invalid grants stay distinct for each sea type', () => {
  const cases = [
    {
      type: 'jetski',
      requestedPath: '/courses/jetski',
      missingDestination: '/?courseAccess=jetski',
      invalidDestination: '/courses/access/clear?type=jetski',
    },
    {
      type: 'boat',
      requestedPath: '/courses/boat',
      missingDestination: '/?courseAccess=boat',
      invalidDestination: '/courses/access/clear?type=boat',
    },
  ];

  for (const testCase of cases) {
    const missing = getCourseAccessRoutingDecision(
      new SeaCourseGrantRequiredError('missing'),
      testCase.type,
      testCase.requestedPath
    );
    const invalid = getCourseAccessRoutingDecision(
      new SeaCourseGrantRequiredError('invalid'),
      testCase.type,
      testCase.requestedPath
    );

    assert.deepEqual(missing, {
      action: 'redirect',
      destination: testCase.missingDestination,
    });
    assert.deepEqual(invalid, {
      action: 'redirect',
      destination: testCase.invalidDestination,
    });
    assert.notEqual(missing.destination, invalid.destination);
  }
});

test('unexpected course access failures preserve error identity', () => {
  const error = new Error('unexpected');
  const decision = getCourseAccessRoutingDecision(error, 'car', '/courses/car');

  assert.equal(decision.action, 'rethrow');
  assert.equal(decision.error, error);
});

test('server adapter consumes tested routing decisions without database access', async () => {
  const source = await readSource('lib/server/courseAccess.js');

  assert.match(source, /createCourseAccessGuard\s*\(/);
  assert.match(source, /getServerSession\s*\(\s*authOptions\s*\)/);
  assert.match(source, /\.get\s*\(\s*SEA_COURSE_COOKIE_NAME\s*\)[^;]*\.value/s);
  assert.match(
    source,
    /verifySeaCourseGrant\s*\([^)]*process\.env\.NEXTAUTH_SECRET/s
  );
  assert.match(source, /getCourseAccessRoutingDecision\s*\(/);
  assert.match(source, /decision\.action\s*===\s*['"]redirect['"]/);
  assert.match(source, /redirect\s*\(\s*decision\.destination\s*\)/);
  assert.match(source, /notFound\s*\(\s*\)/);
  assert.doesNotMatch(source, /\bgetCollection\b/);

  const access = exportedFunctionSource(source, 'requireCourseAccess');
  assertAppearsInOrder(access, [
    [
      'policy access attempt',
      /await\s+courseAccessGuard\.requireCourseAccess\s*\(/,
    ],
    [
      'pure routing decision',
      /getCourseAccessRoutingDecision\s*\(\s*error\s*,\s*type\s*,\s*requestedPath\s*\)/,
    ],
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
    /clearSeaCourseGrantCookies\s*\(\s*response\s*,\s*process\.env\.NODE_ENV\s*\)/s
  );
  assert.doesNotMatch(route, /response\.cookies\.set\s*\(/);
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
