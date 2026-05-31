# Contributing

Thanks for your interest in Korean Word Lookup.

This project is maintained as a public Chrome extension for Korean learners. The most useful contributions are small, focused changes that improve reliability, localization, privacy, or Chrome Extension compatibility.

## Good first contributions

- Reproduce and document translation or tooltip bugs
- Improve English, Korean, or Vietnamese UI text
- Add regression checks for popup, background, or content-script behavior
- Improve onboarding or Chrome Web Store listing assets
- Review Manifest V3 compatibility and permission usage

## Pull request checklist

Before opening a pull request:

1. Keep the change focused on one behavior or documentation update.
2. Test the extension locally through `chrome://extensions` with Developer mode enabled.
3. Check popup, content-script, and keyboard-shortcut behavior when relevant.
4. Avoid adding new host permissions unless the feature clearly requires them.
5. Document user-visible behavior changes in the pull request.

## Local testing

1. Open Chrome.
2. Go to `chrome://extensions`.
3. Enable Developer mode.
4. Click Load unpacked.
5. Select this repository folder.
6. Test hover lookup and selected-text translation on Korean text.

