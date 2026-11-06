# 2.5.3 release verification

## Automated checks run in the cloud

- `npm run check`: source syntax/manifest/locale checks and 49 Node regression tests passed.
- `git diff --check`: passed.
- The tests use fake Chrome APIs and fake provider responses. They do not establish actual provider uptime, browser permission behavior, pixel layout, or Chrome Web Store acceptance.

Coverage includes editable/selection/shadow privacy, canceled requests, startup races,
provider transport, request bounds and timeout, synced-key migration, migration failure,
trusted popup authorization, first-success deduplication, local analytics sanitization,
and absence of the remote analytics sender/permission.

## Browser checks not yet completed

An isolated Chromium launch was attempted on the cloud runner. It failed before
loading the extension because process sockets were denied (`EPERM`). The permitted
escalation also failed in the execution environment wrapper. No actual extension
browser pass or provider connectivity pass is claimed.

`tests/browser-smoke.mjs` is an optional prepared smoke test, not a passed result.
It uses an isolated temporary profile, real extension pages and messages, a local
reading fixture, and explicitly mocked provider responses. It never needs a real
API key. On a supported runner with Playwright and Chromium already available:

```sh
CHROMIUM_PATH=/path/to/chromium node tests/browser-smoke.mjs
```

If using Playwright's bundled Chromium, omit `CHROMIUM_PATH`. Do not use an existing
personal profile. The test dependency is deliberately separate from the dependency-free
CI suite. Inspect and run the test before treating it as verified.

## Manual release gates

1. Load the unpacked release candidate in a disposable Chrome test profile. Confirm
   no service-worker errors, popup overflow, missing translations, or key status errors.
2. Fresh install and upgrade: Google without a key; legacy sync key moves locally;
   existing local key wins; key Save/Clear works; no raw key shown in popup or content messages.
3. With an authorized test key, verify a real KRDICT lookup. Without one, verify
   missing-key behavior and Google fallback. Never fabricate a dictionary success.
4. Verify real Google word and multi-sentence results on a normal page and a strict
   CSP page; offline/timeout errors must permit a later retry. Browser Translator
   availability is conditional, not promised.
5. Exercise input/password/textarea, empty/true/plaintext-only contenteditable,
   nested editors, open/closed shadow components, designMode, mixed selections,
   scroll, focus, navigation, canceled selections, and settings changes during delay.
   Confirm no new provider requests for excluded contexts. Already sent requests
   cannot be unsent; stale responses must not render.
6. Test source switching, key replacement, rehover of a cached word, all shortcuts,
   selection on/off, and repeated popup open/close. Repeat on Mac for default shortcuts.
7. Capture network traffic and verify no GA4/analytics requests. Confirm requests
   only contain the intended word/selection and key only at KRDICT.
8. Capture authentic store screenshots and verify the final privacy-policy URL,
   permission explanations, localized listing, and ZIP before requesting publication.

No merge, store submission, deployment, credential creation/revocation, or account
security-setting change is part of these completed cloud checks.
