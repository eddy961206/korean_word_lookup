# Changelog

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
