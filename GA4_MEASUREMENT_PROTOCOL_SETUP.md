# GA4 product telemetry: retired in 2.5.3

The extension no longer sends GA4 product events, accepts telemetry credentials,
or requests access to google-analytics.com. Old local GA4 settings and identifiers
are removed when the service worker starts. The helper in
`scripts/set_ga4_telemetry.js` only removes legacy configuration.

Do not embed a Measurement Protocol secret in a public extension or copy historical
DevTools enablement recipes. A config flag is not informed user consent.

The extension still uses local feature counters for local UI behavior. These do not
provide a maintainer dashboard. Chrome Web Store acquisition reporting is separate
and is not changed by this code release.

See [the privacy and analytics plan](docs/PRIVACY_ANALYTICS_PLAN.md) for a future
consent-based design and its explicit deployment, retention, and verification gates.
No collector, credentials, account settings, or analytics deployment were created.
