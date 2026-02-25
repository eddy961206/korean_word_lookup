# Weekly KPI Dashboard Template (Exec / Product / Marketing)

## 1) Exec view (weekly)
- Impressions (CWS)
- Listing views (CWS)
- Install count (CWS)
- Uninstall count (CWS)
- Uninstall / Install ratio
- Weekly users (CWS users metric)
- Overall rating count + average

### Decision thresholds
- Uninstall/Install > 22% for 2 consecutive weeks -> retention incident review
- Impressions down > 15% WoW -> listing/search visibility check

## 2) Product view (weekly)
- install
- onboarding_start
- first_success
- feature_use (word/selection)
- lookup_error
- first_success rate = first_success / install
- median TTFV (time to first value)

### Decision thresholds
- first_success rate < 60% -> onboarding simplification task
- lookup_error rate > 8% -> reliability bugfix sprint

## 3) Marketing view (weekly)
- session source / medium / campaign
- Unassigned share
- Channel-wise listing->install CVR
- Channel-wise uninstall proxy (where available)

### Decision thresholds
- Unassigned share > 15% -> UTM governance enforcement
- Channel CVR below global by >20% -> channel-specific listing message test

## 4) Suggested reporting cadence
- Monday: dashboard review + action list
- Wednesday: experiment midpoint check
- Friday: decision + next-week rollout

## 5) Data source mapping
- CWS developer console: acquisition + install/uninstall
- GA4 (listing property): source/medium/campaign + install event
- GA4 (product property via MP): activation/retention/product quality
