# Korean Word Lookup (Chrome Extension)

[![CI](https://github.com/eddy961206/korean_word_lookup/actions/workflows/ci.yml/badge.svg)](https://github.com/eddy961206/korean_word_lookup/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Chrome Web Store](https://img.shields.io/badge/Chrome_Web_Store-install-blue.svg)](https://chromewebstore.google.com/detail/korean-word-lookup-hover/hhcaojjokbganindbecnhonkfjhnibji)

Korean translator & dictionary for Chrome: hover Hangul (Korean) words for instant English meaning, or select sentences to translate in one shot.

Chrome Web Store: https://chromewebstore.google.com/detail/korean-word-lookup-hover/hhcaojjokbganindbecnhonkfjhnibji

## Project status

- **Primary maintainer:** [@eddy961206](https://github.com/eddy961206)
- **Adoption:** 580+ users shown by the Chrome Web Store on 2026-09-16
- **Store release:** 2.5.0, updated on 2026-09-06
- **Source version:** 2.5.2; Chrome Web Store submission is tracked separately

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
- The text you translate is sent to **Google Translate** or **KRDICT** only to fetch translations/definitions.
- Settings are stored in Chrome storage (sync/local depending on the setting).

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
python tools/package_release.py /absolute/path/to/korean-word-lookup-2.5.2.zip
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
- Optional GA4 product telemetry setup: `GA4_MEASUREMENT_PROTOCOL_SETUP.md`
- UTM governance: `UTM_GOVERNANCE.md`

## License
The extension source code is licensed under the [MIT License](LICENSE).
Dictionary and translation results remain subject to their providers' terms; see [NOTICE](NOTICE).
