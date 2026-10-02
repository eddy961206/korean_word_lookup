# P0 Analytics & Retention Spec

## Added events
- `install`
- `update`
- `welcome_view`
- `onboarding_start`
- `popup_open`
- `open_shortcut_settings`
- `enable_extension`
- `disable_extension`
- `feature_use` (`word`/`selection`, source)
- `first_success`
- `lookup_error`
- `onboarding_nudge_show`
- `onboarding_nudge_accept`
- `onboarding_nudge_dismiss`
- `review_prompt_show`
- `review_prompt_rate_click`
- `review_prompt_feedback_click`
- `review_prompt_later`
- `review_prompt_dismiss`

## Local storage keys
- `analyticsEventCounts:YYYY-MM-DD` (daily counters)
- `analyticsEventTrail` (latest 200 events)
- `analyticsLastEventAt`
- `firstSuccessAt`
- `firstSuccessKind`

## P0 funnel to track
1. install
2. welcome_view
3. onboarding_start (test-page click, not proof of a successful translation)
4. first_success (a real translation shown in the content script)
5. feature_use (repeat)
6. disable_extension

Since 2.5.2 the saved welcome-page example does not emit a success event or write
`onboardingDemoSuccessAt`. Historical demo events must not be mixed with real
activation. Compact and expanded dictionary results both record real successes.
`first_success` is a local installation marker, not a cross-device user identity
or an exactly-once guarantee across concurrently open tabs. External GA4 product
telemetry requires explicit opt-in and locally configured credentials.

## Mac churn mitigation in P0
- macOS shortcut defaults changed to:
  - Toggle: `Option+Shift+T`
  - Google: `Option+Shift+G`
  - Dictionary: `Option+Shift+K`
  - Selection: `Option+Shift+S`
- Popup now shows a Mac-specific shortcut conflict tip.
- Uninstall redirects remain disabled at the maintainer's request. Use actual
  Chrome Web Store uninstall statistics; do not infer uninstall counts from a
  nonexistent feedback redirect or from store-page return visits.
