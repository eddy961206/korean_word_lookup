# Korean Word Lookup privacy information

Applies to version 2.6.0. Older installed versions may behave differently until updated.

## Translation and dictionary requests

When translation is enabled and the current site is not paused, hovering over a Korean word sends that word to the
selected provider: Google Translate (`translate.googleapis.com`) or the National
Institute of Korean Language's KRDICT (`krdict.korean.go.kr`). If automatic source
fallback is enabled and the first lookup fails, the word may also be sent to the
other provider. KRDICT needs your own API key. In Alt / Option + hover mode, the modifier key must be held for a hover lookup. Changing a setting stops pending UI work but does not undo a request already sent.

Selection translation is off by default. When enabled, selecting Korean text
(up to 500 characters) sends the selection to Google for English or Vietnamese translation in your selected result language,
including when KRDICT is selected for word lookups. With selection translation enabled,
Alt / Option + Enter looks up the current Korean selection, pins the result, and moves focus to it.
The shortcut does not work when selection translation is off. Both selection paths require
the extension to be enabled and the site not to be paused. No whole-page upload occurs.

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

Your KRDICT key is held only in memory in Chrome's `storage.session`, restricted
to trusted extension contexts. This version does not write the key to persistent
local or sync storage. Enter it again after restarting Chrome or reloading,
disabling, or updating the extension. Service-worker suspension alone does not
clear it. It is sent only to KRDICT, never to Google or web-page content scripts.
The popup shows whether a key exists, never the stored key. Save key replaces it;
Clear key removes the usable key from the session.

On upgrade, a legacy local or sync key is transferred to session storage before
its persistent copies are removed. An existing session value takes precedence,
then a local value, then a sync value. Failed transfers preserve the old copies
and block key use until initialization succeeds. Old versions on other devices
can retain their previous behavior until updated. This is not an encrypted
vault and does not protect against a compromised browser or device.

Ordinary settings, such as translation/source selection and tooltip preferences,
use Chrome sync storage. Chrome may synchronize them if browser sync is enabled.

## Your vocabulary notebook and site controls

The notebook stores only words you explicitly save and meanings, notes, and
context you write yourself. Saving from a lookup passes only the source word;
Google or KRDICT results are not automatically copied into the notebook. No page
URL, title, surrounding paragraph, or automatic lookup history is added.
Notebook data is stored in this Chrome profile's local extension storage, not
Chrome sync or a remote server. It is not encrypted and is not a private vault.
Do not put secrets in notes. Removing the extension removes its local data.

The notebook holds up to 2,000 entries within a 2 MB data limit. Deleting an entry
keeps a local recovery copy among the last 20 deletions so Undo can restore it.
Older recovery copies are removed as more entries are deleted. Exported files
are separate copies that you control; clearing extension data does not remove
those files. CSV/TSV exports and JSON backups contain all saved entries and your
notes, including entries hidden by the current search. Import validates a JSON
backup up to 2 MB, shows a confirmation, and adds new entries without replacing
existing entries with the same term or identifier.

The current-site pause control reads the active page address transiently to
identify its hostname. Only the hostname you choose to pause is stored locally;
paths, query strings, page titles, visit times, and browsing-history logs are not
stored. The list is limited to 500 hostnames. Resume a site or use Resume all
paused sites to remove these preferences. The extension checks this pause state
before new provider requests. Previously sent requests cannot be retracted.

Copy writes the displayed result to your clipboard only after you click Copy.
The source is included. KRDICT text is attributed to the National Institute of
Korean Language and identified as CC BY-SA 2.0 Korea; the extension's own code
license does not replace that data license.

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
