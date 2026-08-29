# Production Stability and Course Access Design

Date: 2026-08-29
Status: Approved design, pending written-spec review
Project: C:\Users\rizik\Desktop\realProjects\newApp\my-app

## 1. Purpose

This change fixes the confirmed client-side failure risks and course-access gaps without changing the working OpenAI translation service, Mongo translation cache, question/exam data translations, or TTS implementation. It also fixes the two confirmed relative contact links and closes the directly related callback redirect weakness.

The implementation must preserve all existing uncommitted TTS changes. It must not add an Error Boundary, telemetry, monitoring, Sentry, analytics, redesigns, dependency upgrades, or unrelated architectural work.

## 2. Confirmed root causes

### 2.1 Theme persistence can crash rendering

ThemeContext reads and writes localStorage without protection. Browsers may expose localStorage while throwing SecurityError or QuotaExceededError when its property or methods are used. The resulting uncaught exception can terminate the React client tree. The deterministic existing fallback theme is dark.

### 2.2 Translation mutates React-owned DOM

TranslationManager traverses document.body text nodes, stores custom properties on nodes, replaces nodeValue directly, and observes all document mutations. React can later reconcile those externally modified nodes, while delayed translation responses can write text for an obsolete language or route. The root layout also hides non-Hebrew pages until this mutation process completes. These behaviors can produce stale text, request loops, hidden content, or client-side reconciliation failures.

The AI translation endpoint itself is not the problem and must remain unchanged. It already accepts pageId, targetLang, and an array of texts, and returns an aligned translatedTexts array while retaining its OpenAI and Mongo cache behavior.

### 2.3 Course authorization is incomplete and forgeable

Only the course landing page currently checks access, and the sea-course cookie is an unsigned literal boolean. Question pages, exam pages, and question Server Actions can be invoked without the same protection. Caller-controlled course types are also used to form MongoDB collection names before a canonical whitelist is enforced.

### 2.4 Callback validation is too permissive

The current startsWith-slash check admits protocol-relative and backslash-based redirect variants. The client also retains the raw callback as a fallback.

### 2.5 Contact links are route-relative

Both desktop and mobile Header links use contactUs instead of /contactUs, so nested routes can resolve them below the current course path.

## 3. Goals

- Make theme storage failures non-fatal while preserving in-memory theme state.
- Keep the existing AI translation endpoint, prompt, model, Mongo cache, and response contract.
- Move all arbitrary page text updates into React state and rendering.
- Switch HE, AR, and EN without navigation or refresh and maintain RTL/LTR state.
- Require a valid NextAuth session for all eight courses.
- Require a signed, user-bound, 15-minute grant in addition to the session for boat and jetski.
- Protect page loads, database loaders, and every question Server Action.
- Reject unknown course types before any collection name is constructed or accessed.
- Accept callback URLs only when they resolve to the application origin.
- Fix both contact links.
- Add focused automated tests and complete lint, test, production-build, and browser verification.

## 4. Non-goals

- No Error Boundary, telemetry, monitoring, Sentry, analytics, or unrelated UI work.
- No changes to the /api/translate contract, OpenAI model, prompt, or Mongo cache format.
- No changes to the existing question/exam translated data selection.
- No changes to the TTS route, TTS hook behavior, audio generation, or existing uncommitted TTS files.
- No middleware-only authorization design.
- No new dependency or broad dependency upgrade.
- No browser-translation disabling.

## 5. Translation architecture

### 5.1 Provider and hook

A React TranslationProvider will replace the mounted DOM TranslationManager. It will be nested inside LanguageProvider and will use the current language and pathname.

Client components will call a hook with the Hebrew source strings they render. The hook will:

- normalize and deduplicate its input strings;
- register those strings in an effect, never during render;
- use a stable registration identifier;
- unregister its identifier during effect cleanup; and
- return a translation function that reads only React-managed provider state.

The provider will maintain the union of active registrations. It will deduplicate the union before requesting translations. A short scheduled batch will send one request using the endpoint's existing body:

- pageId: current pathname;
- targetLang: Hebrew, Arabic, or English using the existing mapping; and
- texts: the deduplicated Hebrew string array.

The provider will consume the existing aligned translatedTexts response and store a source-to-translation map keyed by pathname and language. The endpoint, prompt, OpenAI model, Mongo collection, and cache semantics will not be modified.

### 5.2 Request lifecycle and failure behavior

- Hebrew always returns the original Hebrew string immediately and performs no translation request.
- Arabic and English render Hebrew while their translation is unavailable or pending.
- Provider state changes cause React to render returned translations; no DOM text mutation is allowed.
- Requests use AbortController and a monotonically increasing generation or request identifier.
- A response is applied only when its language, pathname, and request generation still match current provider state.
- Language or pathname changes abort obsolete work and invalidate its generation.
- Registration changes are batched and cannot create a registration-during-render loop.
- A request failure leaves the Hebrew source visible and does not navigate, hide content, or throw into rendering.
- Cleanup clears scheduled work, aborts obsolete requests, and removes component registrations.

### 5.3 Language and direction changes

LanguageContext will validate HE, AR, and EN, update its React state, and write the existing lang cookie. It will update document.documentElement.lang and document.documentElement.dir in a guarded client effect. HE and AR use RTL; EN uses LTR.

Language changes will not call router.refresh, location navigation, or a full reload. The server-rendered initial language will continue to come from the cookie. The obsolete non-Hebrew visibility script will be removed, so a translation failure cannot leave the document hidden.

Dashboard direction-dependent controls will derive their direction reactively from language context rather than taking a one-time snapshot from document.documentElement.

### 5.4 Consumer migration

Visible static UI strings will be registered explicitly in their owning React components while preserving the existing Hebrew source text exactly where practical so existing Mongo translation cache entries continue to hit. This includes Header, Footer, ContactButtons, Dashboard, About, Contact, Login, course landing content, loading content, question controls, and exam controls.

Server pages that must retain server authorization will render small client presentation components for translated UI rather than moving secrets or authorization code into the client. Existing question and exam document translations will continue to use question.translations for the selected language and will not be sent to /api/translate.

No component may update arbitrary text through innerHTML, dangerouslySetInnerHTML translation replacement, innerText, textContent, nodeValue, createTreeWalker, or MutationObserver. Structured-data scripts that are unrelated to translation may remain.

Obsolete data-no-translate markers may be removed because no DOM translator remains. No standard browser translate=no restriction will be introduced.

## 6. Theme architecture

A small storage utility will provide guarded access to browser storage. Obtaining window.localStorage and invoking getItem, setItem, or removeItem will each be inside try/catch. The utility will tolerate:

- server rendering where window does not exist;
- missing storage;
- a throwing localStorage property getter;
- replaced or incomplete storage implementations;
- methods that are missing or throw;
- SecurityError; and
- QuotaExceededError.

ThemeProvider will initialize React state deterministically to dark on both server and first client render. This avoids a hydration mismatch. After mounting, it will safely read a valid saved dark or light value; an absent or invalid value remains dark. Theme class updates and React state do not depend on persistence succeeding. A storage write failure is swallowed, and later toggles continue to alternate the in-memory state.

The existing pre-paint theme script may remain because its storage read is already enclosed in try/catch. It must not gain unguarded storage access.

Dashboard's intentional window.location.assign after a successful password response will remain. It starts a document request only after the Route Handler has set the HttpOnly cookie and is part of the current server-guard handoff. Browser JavaScript will never set the HttpOnly grant cookie.

## 7. Canonical course types and collection safety

One shared module will define exactly these valid course types:

- motorcycle
- car
- truck
- cTruck
- bus
- tractor
- jetski
- boat

The same module will identify boat and jetski as sea courses and will expose validation and safe question-collection-name construction. No page, loader, Route Handler, or Server Action may concatenate a caller-controlled type into a collection name before validation.

Unknown route types will use notFound in page rendering. Direct loader or Server Action calls with an unknown type will reject safely before getCollection is called. There will be no fallback collection.

## 8. Shared server authorization

Server-only authorization code will expose explicit guard modes:

1. Authentication only: require a verified NextAuth session and return its stable user identifier.
2. Authentication plus valid course type: require a session and validate the requested type.
3. Authentication plus course access: require a session, validate the type, and require a valid sea grant only for boat or jetski.

The password-verification Route Handler will use authentication-only mode. It will never require the sea grant that it is responsible for issuing, preventing a redirect loop.

The course landing page, questions page, exam page, and every question-related Server Action will use full course-access mode. Non-sea courses pass after session and type validation. Sea courses additionally require the signed grant.

For unauthenticated page access, the guard will redirect through the existing /login flow with a sanitized internal callback. Sea-course callbacks preserve the validated course type through the existing courseAccess query flow. Authenticated users lacking a sea grant will return to the existing password modal flow for that validated type.

Server Actions must call the guard internally before database work, regardless of the page guard. Authorization is not delegated only to middleware, layout, or client state.

## 9. Signed sea-course grant

### 9.1 Stable identity

The NextAuth JWT callback already stores the verified database user ID. The session callback will expose that ID as session.user.id. The course grant will bind to this ID, never to a display label or user-provided name.

### 9.2 Token construction

The existing jsonwebtoken dependency and Node crypto APIs will be used. A signing key will be derived on the server from NEXTAUTH_SECRET using HMAC-SHA-256 and a fixed domain-separation label dedicated to sea-course access. No signing function, derived key, or secret will enter a client module.

The signed HS256 token will contain and verify:

- purpose: sea-course-access;
- version: 1;
- subject: the stable database user ID;
- issued-at time;
- expiration time exactly 15 minutes after issuance;
- fixed issuer; and
- fixed audience dedicated to this grant.

The grant represents access to both sea course types, preserving current behavior. It contains neither the sea password nor a password derivative.

Verification will pin HS256 and validate signature, purpose, version, issuer, audience, subject, issued-at shape, and expiration. Modified, truncated, malformed, expired, wrong-purpose, wrong-version, wrong-user, and legacy literal boolean values will all be unauthorized.

### 9.3 Cookie issuance and removal

The cookie will use the existing sea_course_access name. Its value will be only the signed token. It will be set by the authenticated /api/coursePassword Route Handler after the current database-backed bcrypt password and expiry checks succeed.

Cookie attributes are mandatory:

- httpOnly: true
- secure: process.env.NODE_ENV equals production
- sameSite: lax
- path: /courses
- maxAge: 900 seconds

The password handler will validate that password is a bounded string and will not log it. It will reject requests without a verified NextAuth session and will not trust a client-submitted course scope.

Missing grants are unauthorized. Malformed or expired grants are unauthorized even if they cannot be deleted during that render. Server Components will never write or delete cookies.

A Route Handler under /courses will clear an invalid grant using the same cookie name and path, then redirect only to the validated existing password-modal destination. It will not require the grant being cleared. Cookie writes and deletions occur only in Route Handlers.

## 10. Callback URL validation

A shared pure helper will accept a candidate callback, the application origin, and the existing safe fallback destination. It will:

- accept only a string of bounded length;
- reject control characters;
- reject malformed percent encodings;
- reject raw or decoded backslashes;
- reject raw or decoded protocol-relative forms;
- resolve the candidate with URL against the application origin;
- require the resolved origin to exactly equal the application origin; and
- return only the normalized internal pathname, search, and hash.

External schemes, foreign origins, protocol-relative URLs, encoded or literal backslash variants, malformed values, and control-character variants return the safe internal fallback. Both the login Server Component and LoginClient will use only the sanitized result for redirect, signIn callbackUrl, and router navigation. No raw unsafe fallback will remain.

## 11. Contact links

The desktop and mobile Header links will both use /contactUs. Verification will cover resolution from / and from a nested /courses/type path.

## 12. Error handling and security boundaries

- Storage and translation failures degrade to deterministic visible content.
- Invalid authorization data fails closed before database access.
- Secrets, passwords, token values, and signing material are never logged.
- No password is stored in browser storage or the signed grant.
- Server-only signing and verification modules are not imported by client components.
- The existing OpenAI translation implementation and TTS implementation remain unchanged.

## 13. Test design

Focused tests will be added without deleting or weakening current tests.

### 13.1 Theme tests

- storage unavailable;
- localStorage property access unavailable or replaced;
- getItem throwing SecurityError;
- setItem throwing QuotaExceededError;
- guarded removeItem behavior;
- deterministic dark fallback; and
- in-memory theme transitions after persistence failure.

### 13.2 Translation tests

- registration cleanup and union behavior;
- string normalization and deduplication;
- existing request body and aligned response contract;
- failed request returns Hebrew fallback;
- switching to Hebrew makes no API request;
- language-change and pathname-change races;
- stale response rejection;
- no request loop from render registration;
- no MutationObserver or DOM text traversal in the active system; and
- reactive HE/AR RTL plus EN LTR behavior without refresh or navigation.

### 13.3 Course and token tests

- all eight canonical types accepted;
- unknown types rejected before a database accessor can run;
- valid signed grant;
- expiration;
- modified payload;
- modified signature;
- truncation and malformed token;
- wrong purpose;
- wrong version;
- wrong user;
- legacy forged true cookie;
- logged-out direct access;
- logged-in sea access without a grant;
- one valid grant opens both boat and jetski;
- authenticated non-sea access;
- all question Server Actions call the shared guard; and
- invalid-cookie clearing uses the matching name and /courses path.

### 13.4 Callback and contact tests

- valid internal relative path;
- valid same-origin absolute URL normalized to an internal path;
- external HTTP and HTTPS URLs;
- javascript and data schemes;
- protocol-relative forms;
- slash-backslash and encoded variants;
- malformed percent encodings;
- control characters;
- safe fallback behavior; and
- both root-relative contact links from root and nested routes.

## 14. Verification procedure

After implementation:

1. Run npm run lint.
2. Run npm test, including all pre-existing TTS tests and new tests.
3. Run npm run build using the existing environment without exposing its values.
4. Start the production build locally on a non-conflicting port.
5. Perform direct-route browser checks for logged-out, logged-in, missing grant, forged legacy cookie, valid grant for both sea types, non-sea access, unknown type, translation switching, theme storage exceptions, and both contact paths.
6. Confirm no real TTS request is made in development and do not change or invoke production TTS as part of this work.

## 15. Delivery report

The final report will include:

1. this specification;
2. every modified file;
3. the important change in each file;
4. lint, test, build, and browser-check results; and
5. remaining issues or limitations.

The report will explicitly confirm that unrelated uncommitted TTS work was preserved.
