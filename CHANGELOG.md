# Changelog

## 2.5.3 - Unreleased

### Privacy and API keys
- Skip hover/selection lookups inside inputs, password fields, editable areas,
  shadow/slot ancestors, and selections crossing editable content.
- Recheck delayed requests and suppress stale results after focus, navigation context,
  selection, settings, and source changes.
- Migrate KRDICT keys from sync to trusted extension-local storage and remove the
  legacy sync key only after a successful local write. Local storage is not encrypted.
- Never return stored keys to content scripts or repopulate them in the popup.
  Add explicit Save/Clear controls and localized key/privacy notices.
- Move provider requests to the service worker, validate text, omit cookies/referrers,
  reject redirects, and apply an eight-second request/body timeout.
- Remove the GA4 sender and host permission. Clean up old telemetry credentials and
  identifiers; keep strict, local-only diagnostic enums with bounded recent history.

### First-use reliability
- Do not cache transient lookup errors; retry failed on-device initialization.
- Invalidate fallback caches when a key changes, including pending older requests.
- Preserve settings changed during startup, and enforce selection enablement in the worker.
- Avoid repeated usage counting while moving within the same translated word and
  serialize first-success/usage writes across tabs.

### Release preparation
- Add privacy/security regression tests, multilingual store copy, privacy disclosures,
  and a consent-based analytics assessment without deploying a collector.
- Chrome 102 or newer is required for trusted-context storage access control.
- Store upload, live-browser/provider QA, final screenshots and publication remain separate gates.

## 2.5.2 - 2026-10-02

### Translation and settings
- Preserve all translated segments when selecting multiple Korean sentences.
- Restore the saved Auto-Fallback preference on every new page.
- Make the first toggle shortcut switch the default enabled state off.
- Count successful dictionary lookups consistently in compact and expanded modes.

### Getting started
- Localize the quick-start flow, help text, and sentence-translation tips in English,
  Korean, and Vietnamese, with a permanent guide button in the popup.
- Distinguish the saved tooltip example from a real translation; the example no
  longer records an onboarding-success event.
- Explain supported pages, refreshing existing tabs, and the personal KRDICT key
  requirement. Use neutral review wording.
- Refresh the three store-description drafts to match actual functionality.

### Release verification
- Add behavioral regression coverage and a deterministic allowlist ZIP builder
  that always generates an empty config.json and never reads local credentials.
- Preserve 2.5.1's opt-in telemetry and existing permissions.

## 2.5.1 - 2026-09-16

### Security
- Removed the committed GA4 Measurement Protocol secret and all built-in telemetry
  credentials. Product telemetry now requires explicit opt-in plus locally supplied
  credentials.
- Added automated checks that reject built-in GA4 secrets and validate extension
  permissions, locales, manifest references, and JavaScript syntax.

### Project maintenance
- Relicensed the project source under MIT while preserving external-provider
  attribution in `NOTICE`.
- Added dependency-free Node.js tests and GitHub Actions CI.
- Documented current Chrome Web Store adoption and maintainer status.
- Completed missing localization keys used by runtime error and fallback paths.

## 2.5.0

### Added
- **On-device translation fallback** (Chrome 138+): when the Google Translate endpoint
  is unreachable, word lookups and selection translation fall back to the built-in
  `chrome.translator` API instead of failing.
- Added optional GA4 Measurement Protocol configuration for product-event testing.

### Changed
- Popup status message is now fully localized via `statusHover` / `statusDisabled` /
  `shortcutsHint` i18n keys (previously hardcoded English).
- SEO-oriented English app name and description:
  "Korean Word Lookup — Korean to English Translator & Dictionary".
  ⚠️ Takes effect on the next package upload (store listing title/summary are
  package-derived). The store description was already updated via the dev console
  on 2026-08-21 and is pending review.

### Security notes
- No API key is bundled: `config.json` ships empty and is git-ignored.
- KRDICT key should be rotated if the previously distributed zips contained one.

## 2.4.5
- Store/analytics growth update: GA4 MP telemetry framework (opt-in, storage-based),
  UTM governance, marketing screenshot set, weekly KPI dashboard template,
  contribution/security policies.

## 2.4.0
- Vietnamese locale support, P2 review funnel optimization, feedback diversion.

## 2.3.x
- P0/P1 retention hardening, analytics instrumentation, onboarding nudge experiments.

## 2.1.0
- Auto-fallback between translation sources, selection translate toggle, review prompt.
