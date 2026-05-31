# Security Policy

Korean Word Lookup is a Chrome extension that handles user-selected text for translation and dictionary lookup.

## Supported version

Security fixes are applied to the latest version published from the `main` branch.

## Reporting a vulnerability

Please report security or privacy issues through GitHub Issues if the report does not contain sensitive details. If sensitive details are involved, contact the maintainer privately before sharing reproduction steps publicly.

Useful report details:

- Chrome version and operating system
- Extension version
- Steps to reproduce
- Expected and actual behavior
- Whether the issue involves permissions, text handling, storage, or external requests

## Security and privacy expectations

- Avoid adding new permissions unless they are required for a specific feature.
- Avoid collecting translated text beyond what is needed to call the selected translation or dictionary provider.
- Keep settings in Chrome storage and avoid storing unnecessary user content.
- Review content-script changes carefully because they run on user pages.

