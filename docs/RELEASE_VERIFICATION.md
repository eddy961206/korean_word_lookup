# 2.5.3 release verification

## Automated checks run in the cloud

- `npm run check`: source syntax/manifest/locale checks and 55 Node regression tests passed.
- `git diff --check`: passed.
- The tests use fake Chrome APIs and fake provider responses. They do not establish actual provider uptime, browser permission behavior, pixel layout, or Chrome Web Store acceptance.

Coverage includes editable/selection/shadow privacy, canceled requests, startup races,
provider transport, request bounds and timeout, synced-key migration, migration failure,
trusted popup authorization, first-success deduplication, local analytics sanitization,
and absence of the remote analytics sender/permission.

## Actual Chromium verification

The initial local cloud runner could not launch Chromium because process sockets
were denied (`EPERM`), and the permitted escalation failed in the execution wrapper.
The test was therefore moved to GitHub Actions with an isolated temporary Chromium
profile, without using a personal computer or browser profile.

[CI run 42165464451](https://github.com/eddy961206/korean_word_lookup/actions/runs/42165464451)
passed both validation and actual Chromium smoke testing on commit
`58f02db3a3788edb0b3bd3a3b5dd55684d82afbf`. The browser test verified popup Save/Clear,
memory-only session key storage, normal hover, editable/password exclusions, selected-text
translation, and worker transport against synthetic provider responses.

The current smoke test also checks that the actual content-script isolated context
cannot read trusted session key storage. A separate informational `LIVE_GOOGLE_PROBE`
uses only the public test word 도서관 and reports its result explicitly; an unavailable
probe is not counted as a passed live-provider check. The final PR head must pass
CI again after any further edits.

Two additional review regressions were fixed: a drag released outside the document
could leave hover locked, and shared pending requests could suppress fallback for
a newer valid caller. Unit tests now cover both, including all-stale cancellation.

To reproduce with Playwright 1.62.1 and Chromium installed:

```sh
CHROMIUM_PATH=/path/to/chromium node tests/browser-smoke.mjs
```

With Playwright's bundled Chromium, omit `CHROMIUM_PATH`. The workflow installs
pinned test tooling independently from the dependency-free validation suite.
Synthetic provider responses do not establish KRDICT uptime, provider accuracy,
all-browser/platform behavior, or pixel-level visual acceptance.

## Manual release gates

1. Load the unpacked release candidate in a disposable Chrome test profile. Confirm
   no service-worker errors, popup overflow, missing translations, or key status errors.
2. Fresh install and upgrade: Google without a key; legacy local/sync keys move to memory-only session storage;
   existing session key wins, then local, then sync; key Save/Clear works; no raw key shown in popup or content messages.
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

Store submission, deployment, credential creation/revocation and account
security-setting changes remain outside these checks. PR review/merge status must
be verified separately in GitHub.

## Session-key regression coverage

Keys use trusted memory-only `storage.session`. Unit tests simulate legacy
local/sync migration, failed writes, delayed initialization, service-worker
restarts sharing a session, and a new browser session with no retained key.
Browser smoke checks Save/Clear, absence of persistent copies, and denied
content-script session access. Full browser restart and extension update/disable
clearing behavior must also be verified manually before release; mocks do not
prove Chrome lifecycle semantics.
