# Production Stability and Course Security Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Remove the confirmed client crash paths and enforce authenticated, signed course access while preserving the existing AI translation service, question translations, and all TTS work.

**Architecture:** Pure, directly testable helpers own storage safety, language metadata, translation request coordination, course validation, callback normalization, access policy, and signed grant verification. Thin React and Next.js adapters consume those helpers: React owns all translated UI state, while server pages, Route Handlers, and Server Actions enforce authorization before course-specific database access.

**Tech Stack:** Next.js 14 App Router, React 18, NextAuth 4 JWT sessions, Node crypto, the already-installed jsonwebtoken package, MongoDB, Node's built-in test runner, and ESLint.

**Spec:** docs/superpowers/specs/2026-08-29-production-stability-security-design.md

## Global Constraints

- Preserve app/api/translate/route.js byte-for-byte: endpoint contract, OpenAI model, prompt, and Mongo cache behavior do not change.
- Preserve question/exam document translation selection and preserve app/api/tts/route.js, lib/useQuestionSpeech.js, lib/ttsEnvironment.mjs, and all pre-existing TTS tests byte-for-byte.
- Do not add an Error Boundary, telemetry, monitoring, Sentry, analytics, production bypasses, new dependencies, broad upgrades, or unrelated UI changes.
- The canonical course types are exactly motorcycle, car, truck, cTruck, bus, tractor, jetski, and boat; only jetski and boat are sea courses.
- Every protected operation orders checks as session, stable user ID, valid type, sea grant when required, and only then course-specific collection construction/access.
- The sea grant uses purpose sea-course-access, version 1, the database user ID as subject, fixed issuer/audience, HS256, a domain-separated key derived from NEXTAUTH_SECRET, and exp minus iat exactly 900 seconds.
- The sea cookie remains sea_course_access with httpOnly true, secure only in production, sameSite lax, path /courses, and maxAge 900; deletion uses the same name and path.
- Language switching never refreshes or navigates. HE and AR are RTL; EN is LTR. Hebrew performs no translation request and is the pending/failure fallback.
- Dashboard retains window.location.assign after successful HttpOnly-cookie issuance.
- Callback validation trusts only validated NEXTAUTH_URL configuration, never Host, X-Forwarded-Host, Origin, or request URL headers.
- Existing dirty TTS/package files stay unstaged. Every git add command names only the intended new or modified files.

---

### Task 1: Safe theme persistence

**Files:**
- Create: lib/themeStorage.mjs
- Modify: app/context/ThemeContext.js
- Test: tests/themeStorage.test.mjs

**Interfaces:**
- Produces: DEFAULT_THEME, getSafeLocalStorage(browser), readStoredTheme(storage), writeStoredTheme(storage, theme), removeStoredTheme(storage), and toggleThemeValue(theme).
- Consumes: no earlier task.

- [ ] **Step 1: Write the failing storage tests**

Create tests/themeStorage.test.mjs with table-driven real storage objects. The expected values are literals, not values derived from the helper:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getSafeLocalStorage,
  readStoredTheme,
  writeStoredTheme,
  removeStoredTheme,
  toggleThemeValue,
} from '../lib/themeStorage.mjs';

test('uses dark when browser storage is unavailable', () => {
  assert.equal(getSafeLocalStorage(undefined), null);
  assert.equal(readStoredTheme(null), 'dark');
});

test('contains a throwing localStorage property getter', () => {
  const browser = {};
  Object.defineProperty(browser, 'localStorage', {
    get() {
      throw new DOMException('blocked', 'SecurityError');
    },
  });
  assert.equal(getSafeLocalStorage(browser), null);
});

test('contains throwing and missing storage methods', () => {
  assert.equal(readStoredTheme({}), 'dark');
  assert.equal(
    readStoredTheme({ getItem() { throw new DOMException('blocked', 'SecurityError'); } }),
    'dark',
  );
  assert.equal(
    writeStoredTheme({ setItem() { throw new DOMException('full', 'QuotaExceededError'); } }, 'light'),
    false,
  );
  assert.equal(removeStoredTheme({ removeItem() { throw new Error('blocked'); } }), false);
});

test('preserves valid values and in-memory toggling after persistence failure', () => {
  assert.equal(readStoredTheme({ getItem: () => 'light' }), 'light');
  assert.equal(readStoredTheme({ getItem: () => 'unexpected' }), 'dark');
  const storage = { setItem() { throw new Error('full'); } };
  let theme = toggleThemeValue('dark');
  assert.equal(theme, 'light');
  assert.equal(writeStoredTheme(storage, theme), false);
  theme = toggleThemeValue(theme);
  assert.equal(theme, 'dark');
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: node --test tests/themeStorage.test.mjs

Expected: FAIL with ERR_MODULE_NOT_FOUND for lib/themeStorage.mjs.

- [ ] **Step 3: Implement the guarded storage helper**

Create lib/themeStorage.mjs with every property/method access inside try/catch:

```js
export const DEFAULT_THEME = 'dark';
const VALID_THEMES = new Set(['dark', 'light']);

export function getSafeLocalStorage(browser) {
  if (!browser) return null;
  try {
    return browser.localStorage || null;
  } catch {
    return null;
  }
}

export function readStoredTheme(storage) {
  try {
    if (typeof storage?.getItem !== 'function') return DEFAULT_THEME;
    const value = storage.getItem('theme');
    return VALID_THEMES.has(value) ? value : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

export function writeStoredTheme(storage, theme) {
  try {
    if (typeof storage?.setItem !== 'function') return false;
    storage.setItem('theme', VALID_THEMES.has(theme) ? theme : DEFAULT_THEME);
    return true;
  } catch {
    return false;
  }
}

export function removeStoredTheme(storage) {
  try {
    if (typeof storage?.removeItem !== 'function') return false;
    storage.removeItem('theme');
    return true;
  } catch {
    return false;
  }
}

export function toggleThemeValue(theme) {
  return theme === 'dark' ? 'light' : 'dark';
}
```

- [ ] **Step 4: Integrate deterministic React theme state**

Modify ThemeContext so server render and first client render both use DEFAULT_THEME. Obtain storage only inside the mount effect, keep it in a ref, apply the restored value to document.documentElement, and skip persistence on the initial effect pass so a saved light value cannot be overwritten by the initial dark state. Subsequent theme changes always update React state and the class before attempting the guarded write:

```js
const [theme, setTheme] = useState(DEFAULT_THEME);
const storageRef = useRef(null);
const skippedInitialPersistence = useRef(false);

useEffect(() => {
  const storage = getSafeLocalStorage(
    typeof window === 'undefined' ? undefined : window,
  );
  storageRef.current = storage;
  const restored = readStoredTheme(storage);
  setTheme(restored);
  document.documentElement.classList.toggle('dark', restored === 'dark');
}, []);

useEffect(() => {
  if (!skippedInitialPersistence.current) {
    skippedInitialPersistence.current = true;
    return;
  }
  document.documentElement.classList.toggle('dark', theme === 'dark');
  writeStoredTheme(storageRef.current, theme);
}, [theme]);
```

Remove the null-theme render gate. toggleTheme must call setTheme with toggleThemeValue and must not depend on the storage result.

- [ ] **Step 5: Verify GREEN and regression coverage**

Run: node --test tests/themeStorage.test.mjs

Expected: all theme tests pass.

Run: npm test

Expected: the new theme tests and all 5 existing TTS tests pass.

- [ ] **Step 6: Commit only the theme task**

Run:

```powershell
git add -- lib/themeStorage.mjs app/context/ThemeContext.js tests/themeStorage.test.mjs
git diff --cached --check
git commit -m "fix: make theme persistence failure-safe"
```

---

### Task 2: React-owned AI translation engine

**Files:**
- Create: lib/language.mjs
- Create: lib/translationState.mjs
- Create: app/context/TranslationContext.js
- Modify: app/context/LanguageContext.js
- Modify: app/Providers/ClientProviders.js
- Modify: app/layout.js
- Delete: components/TranslationManager.js
- Test: tests/translationState.test.mjs
- Test: tests/translationIntegration.test.mjs

**Interfaces:**
- Produces: normalizeLanguage(code), getLanguageMeta(code), createTranslationState(), TranslationProvider, and useTranslationStrings(hebrewSources).
- Consumes: the unchanged POST /api/translate body pageId, targetLang, texts and aligned translatedTexts response.

- [ ] **Step 1: Write failing language, registration, mapping, and race tests**

Create tests/translationState.test.mjs. Use a deferred-promise helper in the test file and exercise the real state object:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { getLanguageMeta } from '../lib/language.mjs';
import { createTranslationState } from '../lib/translationState.mjs';

test('deduplicates the union and cleans up registrations', () => {
  const state = createTranslationState();
  state.register('header', ['בית', 'צור קשר']);
  state.register('page', ['בית', 'אודות']);
  assert.deepEqual(state.getActiveSources(), ['בית', 'צור קשר', 'אודות']);
  state.unregister('header');
  assert.deepEqual(state.getActiveSources(), ['בית', 'אודות']);
});

test('maps a captured source snapshot rather than current registration order', () => {
  const state = createTranslationState();
  state.setScope('/about', 'EN');
  state.register('page', ['בית', 'אודות']);
  const request = state.createRequest();
  state.unregister('page');
  state.register('page', ['אודות', 'בית', 'חדש']);
  assert.equal(state.applyResponse(request, ['Home', 'About']), true);
  assert.equal(state.translate('בית', '/about', 'EN'), 'Home');
  assert.equal(state.translate('אודות', '/about', 'EN'), 'About');
  assert.equal(state.translate('חדש', '/about', 'EN'), 'חדש');
});

test('rejects stale language and pathname responses', () => {
  const state = createTranslationState();
  state.register('page', ['בית']);
  state.setScope('/', 'EN');
  const oldLanguage = state.createRequest();
  state.setScope('/', 'AR');
  assert.equal(state.applyResponse(oldLanguage, ['Home']), false);
  const oldPath = state.createRequest();
  state.setScope('/about', 'AR');
  assert.equal(state.applyResponse(oldPath, ['الرئيسية']), false);
});

test('Hebrew skips requests and pending or failed translations fall back to Hebrew', () => {
  const state = createTranslationState();
  state.register('page', ['בית']);
  state.setScope('/', 'HE');
  assert.equal(state.createRequest(), null);
  assert.equal(state.translate('בית', '/', 'HE'), 'בית');
  state.setScope('/', 'EN');
  assert.equal(state.translate('בית', '/', 'EN'), 'בית');
  state.markFailed(state.createRequest());
  assert.equal(state.createRequest(), null);
  assert.equal(state.translate('בית', '/', 'EN'), 'בית');
});

test('language metadata is RTL for HE/AR and LTR for EN', () => {
  assert.deepEqual(getLanguageMeta('HE'), { code: 'HE', htmlLang: 'he', dir: 'rtl', targetLang: 'Hebrew' });
  assert.equal(getLanguageMeta('AR').dir, 'rtl');
  assert.equal(getLanguageMeta('EN').dir, 'ltr');
});
```

The state implementation must also be tested for: additional registration after a successful batch creates a request containing only the new source; non-array or wrong-length responses are rejected; a newer request ID makes an older response stale; and exact source strings remain distinct even if registration order changes.

- [ ] **Step 2: Verify the focused tests fail for missing modules**

Run: node --test tests/translationState.test.mjs

Expected: FAIL with ERR_MODULE_NOT_FOUND for lib/language.mjs or lib/translationState.mjs.

- [ ] **Step 3: Implement language metadata and translation state**

lib/language.mjs must accept only HE, AR, and EN and fall back to HE:

```js
const LANGUAGE_META = Object.freeze({
  HE: Object.freeze({ code: 'HE', htmlLang: 'he', dir: 'rtl', targetLang: 'Hebrew' }),
  AR: Object.freeze({ code: 'AR', htmlLang: 'ar', dir: 'rtl', targetLang: 'Arabic' }),
  EN: Object.freeze({ code: 'EN', htmlLang: 'en', dir: 'ltr', targetLang: 'English' }),
});

export function normalizeLanguage(code) {
  return typeof code === 'string' && LANGUAGE_META[code] ? code : 'HE';
}

export function getLanguageMeta(code) {
  return LANGUAGE_META[normalizeLanguage(code)];
}
```

lib/translationState.mjs must keep registrations in Map<id, Set<exact source>>, translations in a nested map keyed by JSON.stringify([pathname, lang]), and failed sources per scope. createRequest captures an immutable sources array, pageId, language, targetLang, generation, and request ID. applyResponse accepts only the current generation/request and exactly aligned nonempty strings, pairing results with the captured sources array rather than the live registrations.

- [ ] **Step 4: Implement TranslationProvider and its effect-only registration hook**

TranslationProvider uses usePathname and useLanguage, stores the pure state object in a ref, and rerenders consumers with a version counter. The hook computes a stable deduplicated source snapshot during render but registers only in useEffect:

```js
export function useTranslationStrings(hebrewSources) {
  const context = useContext(TranslationContext);
  const registrationId = useId();
  const signature = JSON.stringify(dedupeExactSources(hebrewSources));

  useEffect(() => {
    return context.register(registrationId, JSON.parse(signature));
  }, [context.register, registrationId, signature]);

  return context.translate;
}
```

The provider's request effect waits one short batch interval, calls only /api/translate with Content-Type application/json and the existing body keys, validates response.ok and exact array alignment, and applies through the captured request. Each new request owns an AbortController. Scope/registration changes clear the timer, abort the old controller, and invalidate its generation. Abort and ordinary failures leave source text visible; ordinary failures call markFailed so the same render state cannot retry-loop. New source registrations clear failure only for the new source and schedule a later missing-source request.

- [ ] **Step 5: Replace the active DOM integration**

Modify LanguageContext to remove useRouter/router.refresh. changeLang normalizes the code, writes the existing lang cookie, updates state, and never navigates. A guarded effect updates document.documentElement.lang and dir from getLanguageMeta. The context value exposes { lang, dir, changeLang }, with dir derived from getLanguageMeta(lang), so Dashboard never needs a DOM snapshot.

Modify ClientProviders to mount TranslationProvider inside LanguageProvider and remove TranslationManager.

Delete components/TranslationManager.js.

Remove only the non-Hebrew visibility script from app/layout.js. Keep the guarded theme pre-paint script and JSON-LD script.

- [ ] **Step 6: Add active-system regression tests and verify GREEN**

Create tests/translationIntegration.test.mjs to exercise provider helper behavior and assert that the active provider tree no longer imports the deleted manager. It may read only the small integration files and must pair source assertions with the behavior tests above. Assert no active createTreeWalker, MutationObserver, nodeValue assignment, router.refresh, or page-visibility translation script remains.

Run: node --test tests/translationState.test.mjs tests/translationIntegration.test.mjs

Expected: all translation core/integration tests pass.

Run: npm test

Expected: all current tests pass.

- [ ] **Step 7: Commit only the translation engine**

Run:

```powershell
git add -- lib/language.mjs lib/translationState.mjs app/context/TranslationContext.js app/context/LanguageContext.js app/Providers/ClientProviders.js app/layout.js components/TranslationManager.js tests/translationState.test.mjs tests/translationIntegration.test.mjs
git diff --cached --check
git commit -m "fix: move AI translation updates into React"
```

---

### Task 3: Course, callback, cookie, and signed-token primitives

**Files:**
- Create: lib/courseTypes.mjs
- Create: lib/callbackUrl.mjs
- Create: lib/courseAccessPolicy.mjs
- Create: lib/server/trustedOrigin.mjs
- Create: lib/server/seaCourseGrant.mjs
- Test: tests/courseTypes.test.mjs
- Test: tests/callbackUrl.test.mjs
- Test: tests/courseAccessPolicy.test.mjs
- Test: tests/seaCourseGrant.test.mjs

**Interfaces:**
- Produces: COURSE_TYPES, SEA_COURSE_TYPES, assertCourseType, isSeaCourse, getQuestionCollectionName, sanitizeCallbackUrl, getTrustedApplicationOrigin, createCourseAccessGuard, signSeaCourseGrant, verifySeaCourseGrant, cookie constants/options.
- Consumes: jsonwebtoken and node:crypto already present; NEXTAUTH_URL and NEXTAUTH_SECRET only through server modules.

- [ ] **Step 1: Write failing canonical type and callback tests**

The type test uses literal expected values and proves validation happens before a supplied database accessor:

```js
const expected = ['motorcycle', 'car', 'truck', 'cTruck', 'bus', 'tractor', 'jetski', 'boat'];
assert.deepEqual(COURSE_TYPES, expected);
for (const type of expected) {
  assert.equal(assertCourseType(type), type);
  assert.equal(getQuestionCollectionName(type), type + 'questions');
}
assert.throws(() => getQuestionCollectionName('../users'), InvalidCourseTypeError);
let dbCalls = 0;
assert.throws(() => {
  const type = assertCourseType('unknown');
  dbCalls += 1;
  return type;
});
assert.equal(dbCalls, 0);
```

tests/callbackUrl.test.mjs must cover a valid path, a same-origin absolute URL normalized to path/search/hash, foreign HTTP and HTTPS, javascript:, data:, //evil, slash-backslash forms, percent-encoded and repeatedly encoded backslashes/protocol-relative forms, malformed percent encoding, controls, credentials, overlength input, invalid trusted origin, and a literal / fallback. Pass a fixed trusted origin such as https://theory-hamodi.com; never derive it from test headers.

- [ ] **Step 2: Run type/callback tests and verify RED**

Run: node --test tests/courseTypes.test.mjs tests/callbackUrl.test.mjs

Expected: FAIL because the helper modules do not exist.

- [ ] **Step 3: Implement canonical validation and callback normalization**

courseTypes.mjs exports frozen arrays and validates before interpolation:

```js
export const COURSE_TYPES = Object.freeze([
  'motorcycle', 'car', 'truck', 'cTruck',
  'bus', 'tractor', 'jetski', 'boat',
]);
export const SEA_COURSE_TYPES = Object.freeze(['jetski', 'boat']);
const COURSE_SET = new Set(COURSE_TYPES);

export class InvalidCourseTypeError extends Error {}
export function isCourseType(value) {
  return typeof value === 'string' && COURSE_SET.has(value);
}
export function assertCourseType(value) {
  if (!isCourseType(value)) throw new InvalidCourseTypeError('Invalid course type');
  return value;
}
export function isSeaCourse(value) {
  return SEA_COURSE_TYPES.includes(assertCourseType(value));
}
export function getQuestionCollectionName(value) {
  return assertCourseType(value) + 'questions';
}
```

callbackUrl.mjs bounds input at 2048 characters, validates trustedOrigin as credential-free HTTP(S), repeatedly decodes only for validation with a small fixed pass limit, rejects controls/backslashes/protocol-relative decoded forms, resolves with URL, requires exact origin equality, and returns pathname + search + hash. Every exception returns the fixed fallback and never the candidate.

trustedOrigin.mjs reads only process.env.NEXTAUTH_URL, returns its validated origin or null, and never accepts request or forwarded headers. Missing/invalid production configuration therefore makes absolute candidate validation fall back safely.

- [ ] **Step 4: Write failing grant, cookie, and guard-policy tests**

tests/seaCourseGrant.test.mjs uses a test-only literal secret passed as an argument and a fixed epoch. Decode a valid token only to create deliberately modified test fixtures; never read environment values. Cover valid, exactly 900-second lifetime, expired, future iat beyond 5 seconds, wrong lifetime, payload modification, signature modification, truncation, malformed token, legacy true, wrong purpose/version/user/issuer/audience, missing secret, and empty secret.

Assert cookie issuance options literally:

```js
assert.deepEqual(getSeaCourseCookieOptions('production'), {
  httpOnly: true,
  secure: true,
  sameSite: 'lax',
  path: '/courses',
  maxAge: 900,
});
assert.equal(getSeaCourseCookieOptions('development').secure, false);
assert.equal(getSeaCourseCookieClearOptions('production').path, '/courses');
assert.equal(getSeaCourseCookieClearOptions('production').maxAge, 0);
```

tests/courseAccessPolicy.test.mjs injects getSession, readSeaCourseCookie, and verifyGrant into createCourseAccessGuard. Assert auth-only succeeds without a grant, all course modes authenticate before validating type, non-sea full access succeeds without a grant, sea access fails without/invalid grant, and one valid user-bound grant admits both jetski and boat. Record call order and assert it is session, type, grant.

- [ ] **Step 5: Run grant/policy tests and verify RED**

Run: node --test tests/seaCourseGrant.test.mjs tests/courseAccessPolicy.test.mjs

Expected: FAIL because the grant and policy modules do not exist.

- [ ] **Step 6: Implement the domain-separated grant and injectable policy**

seaCourseGrant.mjs lives under lib/server, imports node:crypto and jsonwebtoken, and is never imported by a client component. Derive the key with HMAC-SHA-256 using NEXTAUTH_SECRET as key and theory-hamodi:sea-course-access:v1 as the domain label. Signing payload and options are fixed:

```js
const payload = {
  purpose: 'sea-course-access',
  version: 1,
  sub: userId,
  iat: nowSeconds,
  exp: nowSeconds + 900,
  iss: 'theory-hamodi',
  aud: 'sea-course-access',
};
return jwt.sign(payload, deriveKey(secret), { algorithm: 'HS256' });
```

Verification uses algorithms: ['HS256'], fixed issuer/audience, subject userId, and clockTimestamp. After signature verification, require exact purpose/version, integer positive iat/exp, exp - iat === 900, iat no more than 5 seconds in the future, and exp strictly after the supplied current time. Missing/empty secrets fail closed: signing throws a configuration error and verification returns false. No hardcoded fallback or random secret exists.

courseAccessPolicy.mjs defines AuthenticationRequiredError and SeaCourseGrantRequiredError and returns three methods: requireAuthenticatedUser(), requireAuthenticatedCourseType(type), and requireCourseAccess(type). The first requires nonempty session.user.id. The second calls the first before assertCourseType. The third calls the second and consults the cookie/verifier only for a validated sea type.

- [ ] **Step 7: Verify GREEN and commit primitives**

Run: node --test tests/courseTypes.test.mjs tests/callbackUrl.test.mjs tests/courseAccessPolicy.test.mjs tests/seaCourseGrant.test.mjs

Expected: all primitive tests pass.

Run: npm test

Expected: all tests pass.

Run:

```powershell
git add -- lib/courseTypes.mjs lib/callbackUrl.mjs lib/courseAccessPolicy.mjs lib/server/trustedOrigin.mjs lib/server/seaCourseGrant.mjs tests/courseTypes.test.mjs tests/callbackUrl.test.mjs tests/courseAccessPolicy.test.mjs tests/seaCourseGrant.test.mjs
git diff --cached --check
git commit -m "feat: add secure course access primitives"
```

---

### Task 4: Apply server authorization and safe login redirects

**Files:**
- Create: lib/server/courseAccess.js
- Create: app/courses/access/clear/route.js
- Modify: app/api/auth/[...nextauth]/route.js
- Modify: app/api/coursePassword/route.js
- Modify: app/courses/[type]/page.js
- Modify: app/courses/[type]/questions/page.js
- Modify: app/courses/[type]/exam/page.js
- Modify: app/courses/[type]/actions.js
- Modify: app/(auth)/login/page.js
- Modify: app/(auth)/login/LoginClient.js
- Test: tests/courseAuthorizationIntegration.test.mjs

**Interfaces:**
- Consumes: Task 3 policy, type, callback, trusted-origin, and grant helpers.
- Produces: production NextAuth/cookies adapter and protected route/action wiring.

- [ ] **Step 1: Write failing integration-contract tests**

Create tests/courseAuthorizationIntegration.test.mjs with controlled imports of pure adapters where possible and narrowly scoped source-contract checks for Next-only files. It must prove:

- session callback copies token.id to session.user.id;
- password POST calls authentication-only behavior before reading/verifying the course password and does not call full sea access;
- both exported question actions call the shared full guard before getQuestionCollectionName/getCollection;
- landing, questions, and exam pages call the shared full guard;
- exam and actions use getQuestionCollectionName rather than caller interpolation;
- clear-cookie options share sea_course_access and /courses;
- login page passes only a sanitized callback prop and LoginClient never uses a raw callback fallback.

Use behavior tests from courseAccessPolicy for ordering; source checks only cover unavoidable Next wiring.

- [ ] **Step 2: Run the integration test and verify RED**

Run: node --test tests/courseAuthorizationIntegration.test.mjs

Expected: FAIL because production adapter/clear route and required wiring are absent.

- [ ] **Step 3: Implement the server adapter and redirect mapping**

lib/server/courseAccess.js constructs the production policy with getServerSession(authOptions), cookies().get(SEA_COURSE_COOKIE_NAME), and verifySeaCourseGrant using process.env.NEXTAUTH_SECRET. It exposes:

```js
export async function requireAuthenticatedUser()
export async function requireAuthenticatedCourseType(type)
export async function requireCourseAccess(type, requestedPath)
```

requireCourseAccess catches typed policy errors only at the Next adapter boundary:

- AuthenticationRequiredError redirects to /login with an encoded, already-safe callback. A validated sea type uses /?courseAccess=type; a validated non-sea route uses requestedPath; an unvalidated value uses /.
- InvalidCourseTypeError calls notFound().
- SeaCourseGrantRequiredError with a missing cookie redirects directly to /?courseAccess=type.
- SeaCourseGrantRequiredError with a malformed/expired cookie redirects to /courses/access/clear?type=type.

All destinations are built from validated types and internal literals. The adapter does not read database collections.

- [ ] **Step 4: Harden NextAuth session identity and password issuance**

In the NextAuth session callback, set session.user.id = token.id only from the verified JWT callback value.

In /api/coursePassword:

1. Call requireAuthenticatedUser and return JSON 401 for AuthenticationRequiredError without requiring an existing grant.
2. Parse request JSON safely and require password to be a string from 1 through 256 characters.
3. Preserve the current users collection lookup, password expiry, and bcrypt.compare behavior.
4. Sign one grant for the authenticated database user ID.
5. Set sea_course_access with getSeaCourseCookieOptions(process.env.NODE_ENV).
6. Never log the password, token, or secret and never accept a client course scope.

- [ ] **Step 5: Protect every page and direct server operation**

At the top of each page, await requireCourseAccess before any loader:

```js
const { type: validatedType } = await requireCourseAccess(
  params.type,
  '/courses/' + params.type + '/questions',
);
```

Use the matching /courses/type, /questions, or /exam requested path. In both actions, call the same guard internally before getQuestionCollectionName and getCollection. In exam, validate/authorize before computing total size or obtaining the main collection; the fixed car collection remains fixed but is reached only after authorization.

Unknown authenticated route types reach notFound and never a collection. Logged-out access reaches login before type/database processing, as required.

- [ ] **Step 6: Implement supported invalid-cookie clearing**

app/courses/access/clear/route.js validates that type is exactly jetski or boat, otherwise returns a safe 404 response. It creates a 303 response with relative Location /?courseAccess=validatedType, deletes the cookie using the same name, httpOnly, environment secure flag, sameSite lax, path /courses, maxAge 0, and an epoch expiry. It does not require the grant being deleted and never writes cookies during Server Component rendering.

- [ ] **Step 7: Apply trusted callback normalization**

The login Server Component obtains getTrustedApplicationOrigin(), calls sanitizeCallbackUrl(rawValue, trustedOrigin, '/'), redirects an existing session only to that value, and passes it to LoginClient as callbackUrl.

LoginClient removes raw callbackUrl extraction from useSearchParams. It passes the safe prop to signIn and, after success, calls router.push(callbackUrl). It does not use res.url or the original query as a fallback. mode may continue to come from useSearchParams.

- [ ] **Step 8: Verify GREEN, full tests, and commit**

Run: node --test tests/courseAuthorizationIntegration.test.mjs tests/courseAccessPolicy.test.mjs tests/seaCourseGrant.test.mjs tests/callbackUrl.test.mjs

Expected: all authorization tests pass.

Run: npm test

Expected: all tests pass.

Run:

```powershell
git add -- lib/server/courseAccess.js app/courses/access/clear/route.js app/api/auth/[...nextauth]/route.js app/api/coursePassword/route.js app/courses/[type]/page.js app/courses/[type]/questions/page.js app/courses/[type]/exam/page.js app/courses/[type]/actions.js app/(auth)/login/page.js app/(auth)/login/LoginClient.js tests/courseAuthorizationIntegration.test.mjs
git diff --cached --check
git commit -m "fix: enforce signed server-side course access"
```

---

### Task 5: Migrate global, dashboard, marketing, login, and contact UI

**Files:**
- Modify: components/layout/Header.js
- Modify: components/layout/Footer.js
- Modify: components/Dashboard.js
- Modify: app/about/page.js
- Modify: app/contactUs/page.js
- Modify: app/(auth)/login/LoginClient.js
- Test: tests/globalTranslationConsumers.test.mjs
- Test: tests/contactLinks.test.mjs

**Interfaces:**
- Consumes: Task 2 useTranslationStrings and LanguageContext direction; Task 4 safe callback prop.
- Produces: React-owned translations for all non-course static UI and two root-relative contact links.

- [ ] **Step 1: Write failing consumer and contact tests**

Create focused migration tests that verify actual exported source arrays through the pure registration/state helper where exported, and narrowly verify the component wiring:

- Header registers greeting, logout, about, home, contact, and login labels while leaving HE/AR/EN selector labels literal.
- Both Header links resolve to /contactUs from https://theory-hamodi.com/ and https://theory-hamodi.com/courses/car.
- Footer, Dashboard, About, Contact, and Login declare and register their exact current Hebrew source strings.
- Dashboard obtains dir from useLanguage and retains window.location.assign after success.
- No consumer calls DOM text mutation methods.

Run: node --test tests/globalTranslationConsumers.test.mjs tests/contactLinks.test.mjs

Expected: FAIL because source registration and root-relative links are not yet present.

- [ ] **Step 2: Migrate Header and Footer**

Header uses useTranslationStrings for visible Hebrew greeting/logout/nav text in both desktop and mobile render paths. Set both contact Link href values to /contactUs. Remove obsolete data-no-translate markers; do not add translate=no.

Footer becomes a client component, computes the same year, registers the exact Hebrew copyright suffix, and renders it through t without changing layout.

- [ ] **Step 3: Migrate Dashboard without changing cookie navigation**

Create one stable top-level Hebrew source array containing every visible group title, course name, advantage, hero/CTA label, password modal/recovery label, and local fallback error already present in Dashboard. Call useTranslationStrings once and render each literal through t. For arrays, retain IDs, links, images, and icons and translate only title/name/text fields at render.

Replace the one-time document.documentElement.dir effect/state with:

```js
const { dir } = useLanguage();
```

Keep window.location.assign(nextLink) after successful POST. Remove the console logging of server error messages; visible error state remains.

- [ ] **Step 4: Migrate About, Contact, and Login**

Each already-client page declares a stable exact-Hebrew source array outside the component, calls useTranslationStrings once, and replaces visible Hebrew literals, labels, and relevant Hebrew alt text with t calls. Current Hebrew API/auth error state is added to the registered source list when present so late server messages remain React-translated; non-Hebrew errors remain unchanged. Numeric values, phone numbers, URLs, usernames, returned passwords, and database question text are never registered.

LoginClient preserves Task 4's callbackUrl prop behavior while translating its static labels/headings/buttons/welcome text. It does not translate or store password values.

- [ ] **Step 5: Verify GREEN and commit**

Run: node --test tests/globalTranslationConsumers.test.mjs tests/contactLinks.test.mjs tests/translationState.test.mjs

Expected: all consumer/contact tests pass.

Run: npm test

Expected: all tests pass.

Run:

```powershell
git add -- components/layout/Header.js components/layout/Footer.js components/Dashboard.js app/about/page.js app/contactUs/page.js app/(auth)/login/LoginClient.js tests/globalTranslationConsumers.test.mjs tests/contactLinks.test.mjs
git diff --cached --check
git commit -m "feat: render global AI translations through React"
```

---

### Task 6: Migrate protected course UI while preserving question data translations

**Files:**
- Create: app/courses/[type]/CourseLandingClient.js
- Modify: app/courses/[type]/page.js
- Modify: app/courses/[type]/loading.js
- Modify: app/courses/[type]/questions/QuestionsClient.js
- Modify: app/courses/[type]/exam/ExamClient.js
- Test: tests/courseTranslationConsumers.test.mjs

**Interfaces:**
- Consumes: Task 2 useTranslationStrings and Task 4 validated server page props.
- Produces: translated course shell UI; question.translations and audio/TTS paths remain unchanged.

- [ ] **Step 1: Write failing course consumer tests**

Create tests/courseTranslationConsumers.test.mjs. Assert:

- the server course page still calls requireCourseAccess and delegates only presentation to CourseLandingClient;
- CourseLandingClient registers the existing table headers, descriptions, external-link labels, learning prompt, question-bank button, and exam button;
- loading registers טוען שאלות...;
- QuestionsClient registers only static map/navigation/loading shell labels;
- ExamClient registers only static headings, rules, result labels, timer/submit/navigation shell labels;
- resolveQuestion and question.translations[lang.toLowerCase()] remain present and question/option values are not registered with the page translation provider;
- useQuestionSpeech import and calls remain unchanged; and
- no data-no-translate marker is needed by an active DOM translation system.

Run: node --test tests/courseTranslationConsumers.test.mjs

Expected: FAIL because CourseLandingClient and course shell registrations do not exist.

- [ ] **Step 2: Extract translated course presentation**

Keep app/courses/[type]/page.js as a Server Component. It awaits requireCourseAccess, receives validatedType, and renders:

```jsx
<CourseLandingClient
  type={validatedType}
  isSeaCourse={isSeaCourse(validatedType)}
/>
```

Move the existing markup, external links, and styles unchanged into the client component. Register and render its exact Hebrew static strings through t. No session, cookie, secret, signing, or database logic enters the client file.

- [ ] **Step 3: Migrate loading and QuestionsClient shell**

Make loading.js a client component and translate only its existing loading text.

QuestionsClient registers its static map and navigation labels and uses t for those labels. Keep resolveQuestion, question.translations lookup, answer option text, audio maps, selected state, range behavior, and useQuestionSpeech untouched. Remove data-no-translate only because the DOM manager no longer exists.

- [ ] **Step 4: Migrate ExamClient shell**

Register static exam shell, navigation, timer, rule, submission, and result-table labels and render those through t. Keep resolveQuestion, translation and audio resolution, question/option content, scoring, selection, timer behavior, and useQuestionSpeech unchanged. Dynamic document-derived strings never go to /api/translate.

- [ ] **Step 5: Verify GREEN, regression suite, and commit**

Run: node --test tests/courseTranslationConsumers.test.mjs tests/translationState.test.mjs tests/courseAuthorizationIntegration.test.mjs

Expected: all course translation and authorization tests pass.

Run: npm test

Expected: all new tests and all existing TTS tests pass.

Run:

```powershell
git add -- app/courses/[type]/CourseLandingClient.js app/courses/[type]/page.js app/courses/[type]/loading.js app/courses/[type]/questions/QuestionsClient.js app/courses/[type]/exam/ExamClient.js tests/courseTranslationConsumers.test.mjs
git diff --cached --check
git commit -m "feat: migrate course UI to React translations"
```

---

### Task 7: Whole-branch integration, security audit, and runtime verification

**Files:**
- Modify only if a failing check demonstrates a defect in an intended task file.
- Test: all tests created in Tasks 1 through 6 plus the preserved TTS tests.

**Interfaces:**
- Consumes: all previous tasks.
- Produces: verified implementation commit history and evidence for the final report.

- [ ] **Step 1: Confirm immutable/out-of-scope files**

Compare SHA-256 hashes recorded before implementation for app/api/tts/route.js, lib/useQuestionSpeech.js, package.json, lib/ttsEnvironment.mjs, and the three existing TTS test files. Confirm app/api/translate/route.js matches its pre-implementation git blob. Any mismatch caused by this work must be corrected without discarding the user's original dirty content.

- [ ] **Step 2: Run migration and secret-leak scans**

Run targeted searches for MutationObserver, createTreeWalker, nodeValue, innerText, textContent, router.refresh, relative href="contactUs", caller interpolation before course collection access, console logging of passwords/tokens, Error Boundary, Sentry, analytics, and telemetry. Inspect every result in context; structured-data dangerouslySetInnerHTML is permitted and translation replacement is not.

- [ ] **Step 3: Run lint and fix task-caused failures**

Run: npm run lint

Expected: exit 0. Fix only errors introduced or exposed in files within this implementation scope, then rerun until exit 0.

- [ ] **Step 4: Run the complete test suite**

Run: npm test

Expected: exit 0 with all existing TTS tests and all new tests passing. Diagnose and correct implementation defects, then rerun affected focused tests and the full suite.

- [ ] **Step 5: Run the production build**

Run: npm run build

Expected: exit 0 with no hydration, client/server boundary, Next.js, or compile error. Preserve environment secrecy in output. Fix implementation-caused failures and rerun.

- [ ] **Step 6: Start a local production server and perform browser checks**

Choose an unused localhost port, start npm run start -- -p PORT with the successful build, and verify:

- logged-out /courses/car, /questions, /exam and sea equivalents follow safe login/password flows;
- logged-in non-sea routes work;
- sea routes reject missing, malformed, and legacy true grants;
- a real authenticated password flow sets the HttpOnly cookie and one valid grant opens both sea types without a loop;
- unknown authenticated types return the normal 404 before a course collection error;
- HE to AR to EN to HE changes visible React text without URL navigation/refresh, with RTL/RTL/LTR/RTL and no Hebrew API request;
- quick language changes and a forced translation failure retain Hebrew without a crash;
- theme remains usable with unavailable/throwing storage;
- desktop and mobile contact links resolve to /contactUs from root and a nested course route; and
- browser console has no React text-reconciliation or translation observer error.

Do not invoke real production TTS and do not create a test bypass.

- [ ] **Step 7: Final diff, security, and regression review**

Review git diff from b854d79 through HEAD and the working tree. Confirm every Server Action guards internally, all database ordering is correct, token checks fail closed, cookie scope is exact, callback origin is configuration-derived, signing code is server-only, translation endpoint/question/TTS behavior is preserved, and no out-of-scope system was added.

- [ ] **Step 8: Commit any review fixes and leave only preserved dirty work**

If verification required fixes, first add a failing regression test, verify RED, implement the fix, verify GREEN, and commit only the named intended files with a clear fix message. Do not stage the preserved TTS/package files. Final git status may show only the byte-identical pre-existing TTS/package changes.
