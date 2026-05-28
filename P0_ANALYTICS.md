# P0 Analytics & Retention Spec

## Added events
- `install`
- `update`
- `welcome_view`
- `onboarding_demo_success`
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
- `onboardingDemoSuccessAt`

## P0 funnel to track
1. install
2. welcome_view
3. onboarding_demo_success
4. onboarding_start
5. first_success
6. feature_use (repeat)
7. disable_extension / uninstall feedback URL open (proxy)

## Mac churn mitigation in P0
- macOS shortcut defaults changed to:
  - Toggle: `Option+Shift+T`
  - Google: `Option+Shift+G`
  - Dictionary: `Option+Shift+K`
  - Selection: `Option+Shift+S`
- Popup now shows a Mac-specific shortcut conflict tip.
- Uninstall feedback URL is set to GitHub issue template for churn reason collection.
