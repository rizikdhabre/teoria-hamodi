# Task 7: theme lint and dark fallback

## Scope

Changed only the theme provider, root layout, and a focused root-layout theme
contract test. Existing TTS, speech, and package changes were deliberately not
touched or staged.

## Root cause

`npm run lint -- --quiet` consistently failed with
`react-hooks/set-state-in-effect` at `app/context/ThemeContext.js:24` because
the mount effect called `setTheme(restored)` synchronously. The provider already
used `dark` as its state fallback, so the required restoration can occur after
mount rather than in the effect body.

The layout had a related initial-render gap: SSR emitted no `dark` class and its
bootstrap script added the class only when storage held `dark`. Missing,
unavailable, throwing, and invalid storage values therefore painted light,
contrary to the deterministic dark fallback.

## TDD and mutation evidence

- RED: the original fresh focused lint command reported the synchronous
  `setTheme` error at line 24.
- RED: `tests/themeRenderContract.test.mjs` was added before the layout change
  and failed because the SSR `<html>` element did not carry `className="dark"`.
- Mutation RED: removing the SSR dark class made that contract test fail at the
  markup assertion.
- Mutation RED: changing the bootstrap back to dark-only handling made the
  same contract test fail at the guarded light-only opt-out assertion.
- GREEN: the focused theme tests passed (5/5), and focused ESLint reported no
  output or errors.

## Implementation

`ThemeProvider` starts at `DEFAULT_THEME` (`dark`) for deterministic
server/client hydration. Its effect records guarded storage access, then queues
restoration in a microtask. The cleanup cancellation flag prevents the callback
from setting state after unmount. The callback updates the document class and
only then restores valid `light`/`dark` state through React; invalid or failing
storage continues to resolve to `dark` through `readStoredTheme`.

The persistence effect waits until restoration has completed. Subsequent
in-memory toggles still update the HTML class and invoke the failure-safe
`writeStoredTheme`; a storage error cannot prevent the state or DOM update.

The root layout now server-renders `<html className="dark">`. The guarded
pre-paint script removes the class only for the exact stored `light` value and
otherwise retains/adds `dark`, including storage errors. Existing language,
direction, hydration suppression, and JSON-LD behavior remain unchanged.

## Verification

- `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test
  tests/themeRenderContract.test.mjs tests/themeStorage.test.mjs`: 5 passed,
  0 failed.
- `npx eslint app/context/ThemeContext.js app/layout.js
  tests/themeRenderContract.test.mjs`: exit 0, no output.
- `npm test`: 78 passed, 0 failed.
- `npm run lint`: exit 0. It reports 11 pre-existing unrelated warnings in
  translation, course image, header, heart animation, and Tailwind files; this
  task did not change them.
- `git diff --check`: exit 0. Git only emitted existing CRLF-conversion notices.

## Remaining concern

The repository's Node test setup has no DOM/JSX renderer, so the root-layout
test validates the server markup and bootstrap contract directly. Theme storage
helper tests cover unavailable/throwing storage and failed persistence; the
focused ESLint check covers the original React lifecycle violation.
