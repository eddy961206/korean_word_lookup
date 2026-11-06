# Korean Word Lookup privacy information

Applies to version 2.5.3. Older installed versions may behave differently until updated.

## Translation and dictionary requests

When translation is enabled, hovering over a Korean word sends that word to the
selected provider: Google Translate (`translate.googleapis.com`) or the National
Institute of Korean Language's KRDICT (`krdict.korean.go.kr`). If automatic source
fallback is enabled and the first lookup fails, the word may also be sent to the
other provider. KRDICT needs your own API key.

Selection translation is off by default. When enabled, selecting Korean text
(up to 500 characters) sends the selection to Google for English translation,
including when KRDICT is selected for word lookups. No whole-page upload occurs.

Input/password fields, textareas, editable regions, and selections crossing
editable content are skipped. Other page text can still be private. Turn the
extension off before reading material you do not want a translation provider to
receive. The optional browser on-device fallback, when supported, is attempted
only after the Google request fails; it is not a guarantee of offline operation.

Provider requests use HTTPS, omit browser cookies and the page referrer, and are
sent from the extension service worker. Providers receive request text and normal
network metadata such as IP address, and KRDICT receives the API key. Their
policies and availability are outside this extension's control. We do not promise
provider-side deletion or retention periods.

## API key and settings

Your KRDICT key is saved in extension-local Chrome storage accessible only to
trusted extension contexts. It is not encrypted and is not a password vault. It
is used only for KRDICT requests, never sent to Google, and never returned to
web-page content scripts. The popup shows whether a key exists, not the stored
key itself. Use Save key to replace it or Clear key to remove it.

On upgrade, a legacy Chrome-sync key is copied locally if no local key exists;
the old sync value is removed after the local write succeeds. Because keys no
longer sync, another browser/device may need its own key entered. Old versions
on other devices can retain their previous behavior until updated.

Ordinary settings, such as translation/source selection and tooltip preferences,
use Chrome sync storage. Chrome may synchronize them if browser sync is enabled.

## Local usage information

This release has no remote product-analytics sender. It does not upload usage
events, analytics identifiers, looked-up text, or browsing history as analytics.
Translation requests described above are separate from analytics.

Local counters and dates support onboarding and review prompts: installation
and first-success state, word/selection usage counts, and prompt preferences.
These can remain for the installation lifetime. Recent diagnostics contain only
fixed event names, enum categories, and bounded counters, not words, page URLs,
keys, free-form error messages, or provider results. The event trail is capped at
200 entries. Events and daily buckets older than 30 days are removed on the next
recorded event; there is no timed deletion while the extension is idle.

Translation results are cached temporarily in the content script's memory, up to
200 entries with a 24-hour expiration on lookup. Reloading/closing a page clears
that page's cache. They are not written to persistent extension storage.

The upgrade removes legacy GA4 settings, credentials, and client/session
identifiers. It does not delete records that a previous version may already have
sent to an independently configured service.

## Controls and feedback

- Turn translation off in the popup or with its configured keyboard shortcut.
- Enable/disable selection translation and source fallback independently.
- Save/clear the dictionary key in the popup.
- Removing the extension removes its local extension data through Chrome.
- Opening feedback takes you to a GitHub issue form; nothing is submitted
  automatically. Do not post keys, private text, private URLs, or personal data.

For questions about this project, see the maintainer and reporting guidance in
[README](README.md) and [SECURITY](SECURITY.md). Do not include a secret in a public
issue. Future remote analytics would need a separate, explicit consent flow and
updated disclosures before activation.
