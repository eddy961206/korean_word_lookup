# Korean Word Lookup 2.6.0

Read Korean with English or Vietnamese results. Pin a lookup, save a word, and add your own meaning in a local vocabulary notebook.

## Reading workspace

- The popup separates result language from interface language and offers automatic hover or Alt/Option-hover.
- Selection translation is off by default. When enabled, selecting Korean text sends it to Google (up to 500 characters). With this setting enabled, Alt/Option+Enter looks up the current selection, pins the result, and moves focus to it.
- Pause a current site locally. Only its hostname is stored, not browsing paths or visit history.
- Results can be pinned, copied with attribution, closed, or retried with an edited Korean word. This is not a morphology engine.
- Save word stores only the source term. Notebook meanings, context and notes are user-authored; provider results are not prefilled or persisted.
- Notebook limits: 2,000 entries / 2 MB. Search, edit, Undo recent deletions, export CSV/TSV, and back up/import JSON without overwriting existing terms.
- KRDICT keys remain in trusted memory-only session storage. Reenter after Chrome restart or extension reload/update.

See [Privacy](PRIVACY.md), [release verification](docs/RELEASE_VERIFICATION.md), and [store release kit](docs/STORE_RELEASE_KIT.md).

# Korean Word Lookup (Chrome Extension)

[![CI](https://github.com/eddy961206/korean_word_lookup/actions/workflows/ci.yml/badge.svg)](https://github.com/eddy961206/korean_word_lookup/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Chrome Web Store](https://img.shields.io/badge/Chrome_Web_Store-install-blue.svg)](https://chromewebstore.google.com/detail/korean-word-lookup-hover/hhcaojjokbganindbecnhonkfjhnibji)

Read Korean web pages with English help where you are reading. Hover over a Korean word for a translation or dictionary meaning, or enable selection translation for phrases and sentences.

Chrome Web Store: https://chromewebstore.google.com/detail/korean-word-lookup-hover/hhcaojjokbganindbecnhonkfjhnibji

## Project status

- **Primary maintainer:** [@eddy961206](https://github.com/eddy961206)
- **Source version:** 2.5.3 release candidate; Chrome Web Store submission is tracked separately
- **Last verified store snapshot:** version 2.5.0 on 2026-09-16; this is not a claim about the current store version

## Features
- **Hover translate**: hover Korean words to see English translations/definitions
- **Selection translate**: select multiple words or sentences to translate (toggle with `Alt+S`)
- **Two sources**: Google Translate (fast) or KRDICT Korean Dictionary (detailed)
- **Localized UI**: English, Korean, and Vietnamese
- **Customizable tooltip**: hover delay, compact mode, max definitions
- **Keyboard shortcuts**:
  - Windows/Linux/ChromeOS: `Alt+T`, `Alt+G`, `Alt+K`, `Alt+S`
  - macOS (default): `⌥⇧T`, `⌥⇧G`, `⌥⇧K`, `⌥⇧S`

## Privacy
- Hovered words go to the selected provider; optional source fallback may contact the other provider. Selected-text translation uses Google.
- Inputs, password fields, and editable regions are skipped. This does not make other page text public: turn translation off before reading private material.
- Your KRDICT key is kept only in trusted, memory-only Chrome session storage. Re-enter it after restarting Chrome or reloading/updating the extension. It is never written to persistent storage by this version or returned to page scripts.
- No product-usage analytics are uploaded. Local counters support onboarding/review prompts; recent local diagnostics are capped and pruned.
- See [Privacy](PRIVACY.md) for the complete data flow and retention details.

## Maintainer workflows
- Chrome Extension Manifest V3 maintenance and compatibility updates
- Store listing, localization, and release packaging
- User onboarding, uninstall-risk reduction, and analytics-informed UX fixes
- Dictionary-provider behavior checks and privacy-sensitive translation handling

## Contributing and security
- Contribution guide: [CONTRIBUTING.md](CONTRIBUTING.md)
- Security policy: [SECURITY.md](SECURITY.md)

Run the dependency-free validation and regression checks before opening a pull request:

```bash
npm run check
```

Build a clean store ZIP with Python 3.9+ after the checks pass:

```bash
python tools/package_release.py /absolute/path/to/korean-word-lookup-2.5.3.zip
```

The builder includes only runtime files, declared icons, locales, and license
notices. It generates an empty `config.json`; local API keys and development files
are never copied. Google translation needs no API key. To use KRDICT definitions,
enter your own KRDICT API key in the popup.

## Credits
Dictionary data provided by National Institute of Korean Language's Basic Korean Dictionary (`https://krdict.korean.go.kr`)

## Ops docs
- Retention + event notes: `P0_ANALYTICS.md`
- Listing optimization drafts: `STORE_LISTING_P1.md`, `ACQUISITION_CHANNEL_PLAN_P1.md`
- Deep-research execution checklist: `DEEP_RESEARCH_ACTION_PLAN.md`
- Privacy and future opt-in analytics assessment: `docs/PRIVACY_ANALYTICS_PLAN.md`
- Current multilingual store copy and screenshot brief: `docs/STORE_RELEASE_KIT.md`
- Retired GA4 telemetry path: `GA4_MEASUREMENT_PROTOCOL_SETUP.md`
- UTM governance: `UTM_GOVERNANCE.md`

## License
The extension source code is licensed under the [MIT License](LICENSE).
Dictionary and translation results remain subject to their providers' terms; see [NOTICE](NOTICE).
