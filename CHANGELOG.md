# Changelog

## Unreleased (on top of v2.4.5)

### Added
- **On-device translation fallback** (Chrome 138+): when the Google Translate endpoint
  is unreachable, word lookups and selection translation fall back to the built-in
  `chrome.translator` API instead of failing.
- Real GA4 credentials filled into `scripts/set_ga4_telemetry.js`
  (`G-JDCGN36DHB`, validated against the Measurement Protocol debug endpoint).

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
