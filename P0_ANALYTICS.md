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

## Local storage keys
- `analyticsEventCounts:YYYY-MM-DD` (daily counters)
- `analyticsEventTrail` (latest 200 events)
- `analyticsLastEventAt`
- `firstSuccessAt`
- `firstSuccessKind`

## P0 funnel to track
1. install
2. welcome_view
3. onboarding_start
4. first_success
5. feature_use (repeat)
6. disable_extension / uninstall feedback URL open (proxy)

## Mac churn mitigation in P0
- macOS shortcut defaults changed to:
  - Toggle: `Command+Shift+T`
  - Google: `Command+Shift+G`
  - Dictionary: `Command+Shift+K`
  - Selection: `Command+Shift+S`
- Popup now shows a Mac-specific shortcut conflict tip.
- Uninstall feedback URL is set to GitHub issue template for churn reason collection.
