# GA4 Measurement Protocol Setup (for extension product analytics)

This extension now supports **optional** GA4 product-event sending from the background service worker.

## Why
- CWS-connected GA4 gives listing/install insight
- Product retention needs in-extension events (first value, feature use, errors)

## Safety / privacy defaults
- Disabled by default (`ga4TelemetryEnabled !== true`)
- No raw hovered/selected text is sent
- Payload is allowlisted and truncated

## Storage keys (chrome.storage.local)
Set these keys to enable telemetry:
- `ga4TelemetryEnabled` = `true`
- `ga4MeasurementId` = `G-XXXXXXXXXX`
- `ga4ApiSecret` = GA4 Measurement Protocol API secret

Optional:
- `analyticsSessionId` (auto-created if missing)
- `analyticsClientId` (auto-created if missing)

## Example (DevTools on extension page)
```js
chrome.storage.local.set({
  ga4TelemetryEnabled: true,
  ga4MeasurementId: 'G-XXXXXXXXXX',
  ga4ApiSecret: 'YOUR_SECRET'
})
```

## Events currently sent (if enabled)
- install, update
- welcome_view, onboarding_start
- popup_open
- feature_use, first_success
- lookup_error
- review_prompt_* events
- onboarding_nudge_* events
- enable_extension / disable_extension

## Recommended architecture
- Keep CWS listing GA4 property separate from product event GA4 property
- Weekly dashboard split: acquisition vs activation/retention
