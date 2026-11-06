# Privacy and product analytics plan

Status: release-planning document for prospective 2.5.3. Not a published privacy policy, legal review, consent implementation, or deployed analytics service. Verify the final packaged build against this document before publication.

## Release decision

Ship 2.5.3 without remote product analytics. Remove the direct GA4 sender and its host permission; do not ship a misleading consent switch for a nonexistent collection service. Local counters can support local UI behavior, but cannot provide a maintainer dashboard. No collector, GA4 property, credentials, or external deployment is created by this plan.

Keep store acquisition reporting separate from any future opt-in product reporting. `GA4_MEASUREMENT_PROTOCOL_SETUP.md` documents retirement of the old sender. Do not follow older revisions' DevTools credential setup recipes. Product measurement sketches in marketing dashboards are not instructions to enable telemetry in 2.5.3.

## Data flows to disclose and verify for 2.5.3

| Data | Destination and purpose | Storage / release requirement |
| --- | --- | --- |
| Hovered Korean word | Google translation endpoint or KRDICT, to return a result. If enabled, source fallback can contact the other provider. | Temporary in-memory result cache. Do not log words or returned definitions in diagnostics. |
| Selected text | Google translation endpoint, to return English translation when selection translation is enabled. | Temporary in-memory result cache. Do not claim this uses KRDICT just because dictionary mode is selected. |
| User's KRDICT API key | KRDICT only, to authorize dictionary requests. | Migrate legacy local/sync keys to trusted, memory-only session storage; never return them to a content script. Verify persistent-copy cleanup only after successful transfer and key reentry after browser restart. |
| UI settings | Chrome storage; sync settings can be synchronized by Chrome when enabled. | Explain sync/local distinction rather than “all data stays on device.” |
| Local feature counts and event metadata | Extension-local storage for local UX and diagnostics. Not sent to the maintainer or GA4. | Rolling event history: no more than 200 entries and 30 days. Daily event buckets: maximum 30 days. Old diagnostic history is pruned on the next recorded event; this is not a timer-based deletion guarantee while idle. |
| Lifecycle flags and aggregate usage counters | Local UX, including first-use state or prompt eligibility. | These may remain for the installation lifetime. Do not describe every local value as deleted after 30 days. |
| Provider request metadata | Google/KRDICT receive the request and network metadata such as source IP. | Provider-side retention is outside the extension's control. Do not invent provider deletion guarantees. |
| User-initiated feedback | GitHub, if the user opens and submits an issue. | Warn users not to post private text, keys, or private URLs. No automatic issue submission. |

Lookup requests should originate in the service worker, use HTTPS, omit credentials and referrer, have timeouts, and validate input and responses. Editable/password fields must be skipped. This does not make arbitrary page text non-sensitive: hovered/selected material may still be private. Broad page access is for detecting text under the pointer or selection and rendering the tooltip, not permission to upload whole pages.

Do not advertise guaranteed offline or on-device operation. Any browser Translator fallback is conditional and does not undo the initial network request. Browser availability, model availability, and actual behavior require separate verification.

## Why the historical GA4 path is not a production consent system

At review start, telemetry required local `ga4TelemetryEnabled === true` plus credentials, but there was no user-facing consent flow. A manually set flag is not evidence of informed product-wide consent. Historical code also allowed arbitrary event names, truncated free-form strings such as `message`, retained daily count buckets without a time limit, created a persistent client ID, and reused a session ID indefinitely. Truncating a string does not remove personal information. A shared Measurement Protocol secret must not be embedded in a public extension, even when injected at build time.

The release decision removes remote collection rather than claiming these issues are solved by a switch. Service-worker initialization removes old `ga4MeasurementId`, `ga4ApiSecret`, `ga4TelemetryEnabled`, `analyticsClientId`, and `analyticsSessionId` keys. Verify this on upgrade; removing local keys does not delete records previously sent to a service. Never reuse historical local events as a backfill into a later collector.

## Future opt-in design, not implemented

Only consider this after a concrete product question cannot be answered from store reports, support, or voluntary testing. Approve the operating owner, recipient, policy URL, cost, retention, deletion mechanism, and consent text before building or deploying a collector.

### Consent states

- `unset`: no remote requests, identifiers, event queue, or retries. Optional local counters must be disclosed separately.
- `declined`: identical remote behavior to unset. No repeated prompts or feature restrictions.
- `granted`: save policy version, consent version, and local consent timestamp; create a new random installation identifier only now, if needed for the approved question.
- `withdrawn`: immediately stop collection and pending sends, delete local telemetry identifiers/queues, and provide deletion of previous server-side records without requiring an account. Turning collection back on creates a new identifier.

Give equal prominence to “Allow optional analytics” and “No thanks.” Never preselect consent, bundle it with translation, or infer it from installation, popup use, an update, or continuing to browse. An existing setting must not silently opt users into a materially changed recipient or data scope. Remote consent must remain local to this browser profile rather than syncing to another device.

### Proposed minimum event contract

This is a future design, not a claim that these events are currently collected remotely.

| Event | Trigger | Allowed event-specific fields |
| --- | --- | --- |
| `consent_started` | First successful opt-in, once per consent epoch | `consent_version` |
| `first_success` | First real result after opt-in, once per consent epoch | `kind`: `word` / `selection`; `provider`: `google` / `krdict` / `browser` |
| `lookup_outcome` | A lookup finishes, after a documented volume cap | `kind`; `provider`; `outcome`: `success` / `not_found` / `missing_key` / `timeout` / `network_error` / `provider_error` |
| `feature_setting_changed` | User changes a relevant feature setting | `feature`: `translation` / `selection`; `enabled`: boolean |

Shared fields: schema version, extension version, random consent-epoch identifier only if cohort analysis is approved, and day-level timestamp. Use exact enum validation and reject unknown keys and overlarge bodies both in extension and collector. Count errors with fixed codes, never exception text or raw provider responses. Do not add locale/platform unless needed for an explicit question.

Never collect text, URLs, domains, page titles, referrers, browsing history, clipboard contents, dictionary results, API keys, emails, advertising identifiers, device fingerprints, or arbitrary strings. Avoid a session identifier unless there is a validated need. Do not collect install/update/welcome events before consent or replay them afterward. Disable collection in incognito if support is added; do not send an “incognito” flag.

### Architecture and retention targets

These are acceptance targets, not current guarantees:

- Extension sends to an approved HTTPS collector. Keep any downstream credentials on the server. The collector strictly validates schema, limits rates and body size, and drops unknown fields.
- Do not create a collector or credentials until explicitly approved. Changing third-party access or account terms is a separate step.
- Avoid request/access logs with IPs, query strings, bodies, or identifiers. If security logs are necessary, minimize fields and delete within 7 days. Audit CDN/hosting/provider logs too.
- Raw product events: delete after 30 days; unlinked aggregate daily counts: after 90 days. Set and test automated deletion. Do not promise these periods until every processor and backup policy can meet them.
- Disable advertising personalization, cross-product identifiers, user-ID joining, and unnecessary downstream integrations. GA4 is optional; use it only if its actual settings and retention capabilities satisfy the chosen policy. Do not claim a 30-day raw-data guarantee merely by changing a GA4 UI setting.
- Withdrawal stops future collection immediately. Supply a deletion receipt/token for previously collected data without collecting an email. State backup expiration and any genuine exceptions plainly.
- A capped, short-lived memory queue is preferable to persistent retries. Drop data rather than harming lookup performance or uploading a backlog after consent changes.

### Consent copy draft

Do not ship these words until the bracketed facts are resolved and the behavior exists.

**Title:** Help improve Korean Word Lookup?

**Body:** Optional analytics can help us understand which features work and which fail. If you allow it, we send feature-use counts, fixed error categories, extension version, and a random identifier to [named operator and service]. We do not send the words you look up, selected text, page addresses, or your API key as analytics. The service receives network information such as your IP address. Raw events are retained for [verified period]. Translation requests still go to Google or KRDICT to provide results, whether you allow analytics or not. You can turn analytics off and request deletion in Settings. [Public privacy policy link]

**Buttons:** Allow optional analytics / No thanks

**Settings label:** Share optional usage analytics (off by default)

**Withdrawal confirmation:** Optional analytics is off. New events will not be sent. [Separate explanation and action for deleting previously collected events.]

Localize only after the final English contract is reviewed; translators must preserve recipients, optionality, retention, and withdrawal meaning.

## Measurement without misleading conclusions

- Store listing views, installs, and uninstalls: use actual available Chrome Web Store reports. Record date range and report definitions. Do not assume a metric exists just because an older dashboard mentions it.
- Product activation after opt-in: first successful result / opted-in installations in a defined cohort. This is not the activation rate of all installers.
- Lookup failure rate: failed `lookup_outcome` events / all recorded lookup outcomes, within a stated consented sample and cap. This is not a user-level failure rate.
- D7 repeat use needs an explicitly defined returning-use event/cohort and identifier policy. Current local counters cannot establish maintainer-visible D7 retention.
- Do not compare historical welcome demo clicks to real translation successes. Do not infer uninstall counts from the absence of events or store return visits.
- Historical numbers and target thresholds in older marketing documents are not verified current baselines. Use no fabricated uplift, sample size, attribution, or experiment result.

## Release verification checklist

1. Inspect final runtime and built ZIP: no GA4 host permission, MP URL, sender, embedded secrets, or remote analytics script.
2. Test clean install, upgrade with legacy GA4 keys, popup, welcome page, translation success/error, source switches, and browser restart while capturing network requests. Verify no analytics request in any case.
3. Inspect storage retention at 29/30/31-day boundaries, old/future/malformed timestamps, empty storage, and more than 200 events. Verify strict enum validation rejects text/URL payloads.
4. Test dictionary-key migration and deletion, trusted-context storage restrictions, no key in content messages, correct provider-only transmission, and package secret scan.
5. Test hover and selection on input, textarea, password, contenteditable, and normal page text; verify provider recipient and fallback behavior with network tools.
6. Match the public policy and store data disclosures to the final build. Translation still transmits website text, even when analytics is absent. Do not answer “no data transmitted” solely because the developer has no backend.
7. Confirm current store policy terminology and required declarations in the developer dashboard before submission. This document does not certify store acceptance or legal compliance.

Verification limit: this plan was prepared from repository source and the coordinated 2.5.3 implementation direction. It does not attest to a browser network test, a deployed policy URL, live store dashboard, provider retention configuration, or public release.
