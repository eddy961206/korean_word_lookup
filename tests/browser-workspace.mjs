// Real Chromium/extension integration; ALL provider answers below are SYNTHETIC.
// This suite does not assess Google/KRDict availability or translation accuracy.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const { chromium } = createRequire(import.meta.url)('playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const profile = await mkdtemp(path.join(os.tmpdir(), 'kwl-workspace-'));
const launch = () => chromium.launchPersistentContext(profile, {
  executablePath: process.env.CHROMIUM_PATH || undefined,
  channel: process.env.CHROMIUM_PATH ? undefined : 'chromium', headless: true,
  locale: 'en-US', acceptDownloads: true, ignoreDefaultArgs: ['--disable-extensions'],
  args: [`--disable-extensions-except=${root}`, `--load-extension=${root}`]
});
// Do not use waitForFunction with an async predicate: explicitly await each read.
async function poll(read, accepts, label, timeout = 10000) {
  const deadline = Date.now() + timeout;
  let value;
  do {
    value = await read();
    if (accepts(value)) return value;
    await new Promise(resolve => setTimeout(resolve, 50));
  } while (Date.now() < deadline);
  throw new Error(`Timed out: ${label}; last value=${JSON.stringify(value)}`);
}
let context = await launch();
let diagnosticsCDP = null;
const diagnosticsWorlds = [];
const runtimeErrors = [];
context.on('page', page => {
  page.on('pageerror', error => runtimeErrors.push({kind:'pageerror', message:error.message}));
  page.on('console', message => {
    if (message.type() === 'error' || message.type() === 'warning') runtimeErrors.push({kind:message.type(), message:message.text()});
  });
});
try {
  const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
  const id = new URL(worker.url()).host;
  await worker.evaluate(async () => {
    await storageReady;
    await chrome.storage.sync.set({ selectedApi: 'google', targetLanguage: 'en', triggerMode: 'hover', hoverDelayMs: 100 });
    globalThis.syntheticRequests = [];
    globalThis.delayedTerm = '';
    globalThis.emptyTerm = '없음';
    globalThis.fetch = async (url, options) => {
      const parsed = new URL(String(url));
      if (parsed.hostname !== 'translate.googleapis.com') throw new Error('Unexpected network request blocked by synthetic test');
      const term = parsed.searchParams.get('q');
      syntheticRequests.push({ term, language: parsed.searchParams.get('tl'), credentials: options.credentials });
      if (term === delayedTerm) await new Promise(resolve => { globalThis.releaseSynthetic = resolve; });
      if (term === emptyTerm) return new Response('[]');
      return new Response(JSON.stringify([[[`SYNTHETIC ${parsed.searchParams.get('tl')} ${term}`, term]]]));
    };
  });
  const snapshot = () => worker.evaluate(async () => (await chrome.storage.local.get('kwlVocabularyV1')).kwlVocabularyV1 || { items: [], deleted: [] });
  const requests = () => worker.evaluate(() => syntheticRequests);
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${id}/popup.html`);
  await popup.locator('#targetLanguage').waitFor();
  const notebook = await context.newPage();
  await notebook.goto(`chrome-extension://${id}/notebook.html`);
  await notebook.locator('#empty-title').filter({ hasText: 'Your next word starts here' }).waitFor();
  assert.equal((await snapshot()).items.length, 0);

  const readingURL = 'http://127.0.0.1/workspace-reading';
  await context.route(readingURL, route => route.fulfill({ contentType: 'text/html', body: `<!doctype html><meta charset="utf-8"><style>body{font:32px sans-serif;padding:60px}p{margin:45px}</style><p><span id="word">도서관</span></p><p><span id="other">학교</span></p><p><span id="slow">바다</span></p><p><span id="empty-word">없음</span></p><p id="away">Reading fixture (synthetic provider)</p><button id="focus-origin">Reading controls</button><input id="private-input" value="비밀">` }));
  const page = await context.newPage();
  await page.goto(readingURL);
  const tip = page.locator('.kr-tooltip');
  await tip.waitFor({ state: 'attached' });
  // Tooltip DOM precedes async startup/site-state readiness; inspect, never override, the isolated world.
  await page.bringToFront();
  const startupCDP = diagnosticsCDP = await context.newCDPSession(page);
  const startupWorlds = diagnosticsWorlds;
  startupCDP.on('Runtime.exceptionThrown', event => runtimeErrors.push({kind:'isolated-exception', message:event.exceptionDetails.exception?.description || event.exceptionDetails.text}));
  startupCDP.on('Runtime.executionContextCreated', event => startupWorlds.push(event.context));
  await startupCDP.send('Runtime.enable');
  await poll(async () => {
    for (const world of startupWorlds) {
      const result = await startupCDP.send('Runtime.evaluate', {
        contextId: world.id,
        expression: `globalThis.chrome?.runtime?.id === ${JSON.stringify(id)} && typeof isInitialized !== 'undefined' && isInitialized && !sitePaused`,
        returnByValue: true
      });
      if (result.result.value === true) return true;
    }
    return false;
  }, Boolean, 'real content startup and unpaused site state');
  await page.locator('#word').hover();
  await tip.filter({ hasText: 'SYNTHETIC en 도서관' }).waitFor({ state: 'visible' });
  await tip.getByRole('button', { name: 'Pin', exact: true }).click();
  await page.locator('#away').hover();
  await page.waitForTimeout(500); // Longer than pointer-leave grace period.
  assert.equal(await tip.isVisible(), true);
  await page.locator('#focus-origin').click();
  assert.equal(await tip.isVisible(), true, 'outside click/focus must retain pinned panel');
  await page.evaluate(() => { document.body.style.minHeight = '1400px'; window.scrollBy(0, 80); });
  await page.waitForTimeout(100);
  assert.equal(await tip.isVisible(), true, 'page scroll must retain pinned panel');
  await page.evaluate(() => window.scrollTo(0, 0));
  await worker.evaluate(() => chrome.storage.sync.set({ selectionTranslationEnabled: true }));
  await page.locator('#word').evaluate(element => {
    const range = document.createRange(); range.selectNodeContents(element);
    const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range);
    selection.removeAllRanges();
  });
  await page.waitForTimeout(400);
  assert.equal(await tip.isVisible(), true, 'selection collapse must retain pinned panel');
  await worker.evaluate(() => chrome.storage.sync.set({ selectionTranslationEnabled: false }));
  assert.equal(await tip.getByRole('button', { name: 'Unpin', exact: true }).getAttribute('aria-pressed'), 'true');
  // Clipboard permission is a test-browser grant, not an extension permission change.
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: 'http://127.0.0.1' });
  await tip.getByRole('button', { name: 'Copy', exact: true }).click();
  await tip.getByRole('status').filter({ hasText: 'Copied' }).waitFor();
  assert.match(await page.evaluate(() => navigator.clipboard.readText()), /SYNTHETIC en 도서관/);
  await tip.getByRole('button', { name: 'Save word', exact: true }).click();
  await tip.getByRole('status').filter({ hasText: 'Word saved' }).waitFor();
  await tip.getByRole('button', { name: 'Save word', exact: true }).click();
  await poll(snapshot, value => value.items.length === 1, 'idempotent save');
  const saved = (await snapshot()).items[0];
  assert.equal(saved.term, '도서관');
  for (const field of ['meaning', 'note', 'context']) assert.equal(saved[field], '');
  assert.doesNotMatch(JSON.stringify(await snapshot()), /SYNTHETIC|workspace-reading|127\.0\.0\.1/);
  const openedPromise = context.waitForEvent('page');
  await tip.getByRole('button', { name: 'Open notebook', exact: true }).click();
  const opened = await openedPromise;
  await opened.waitForURL(`chrome-extension://${id}/notebook.html`);
  await opened.close();
  await page.bringToFront();
  await page.keyboard.press('Escape');
  await tip.waitFor({ state: 'hidden' });

  // Popup document controls are real UI, not a simulated Chrome toolbar popup.
  await popup.bringToFront();
  await popup.locator('#targetLanguage').selectOption('vi');
  await poll(() => worker.evaluate(async () => (await chrome.storage.sync.get('targetLanguage')).targetLanguage), value => value === 'vi', 'Vietnamese target saved');
  await page.bringToFront();
  await page.locator('#away').hover();
  await page.locator('#word').hover();
  await tip.filter({ hasText: 'SYNTHETIC vi 도서관' }).waitFor({ state: 'visible' });
  await tip.getByRole('button', { name: 'Close', exact: true }).click();
  await tip.waitFor({ state: 'hidden' });
  await popup.bringToFront();
  await popup.locator('#triggerMode').selectOption('modifier');
  await poll(() => worker.evaluate(async () => (await chrome.storage.sync.get('triggerMode')).triggerMode), value => value === 'modifier', 'modifier saved');
  await page.bringToFront();
  await page.locator('#other').hover();
  await page.waitForTimeout(500);
  assert.equal(await tip.isVisible(), false);
  await page.keyboard.down('Alt');
  await page.locator('#away').hover();
  await page.locator('#other').hover();
  await tip.filter({ hasText: 'SYNTHETIC vi 학교' }).waitFor({ state: 'visible' });
  await page.keyboard.up('Alt');
  await page.keyboard.press('Escape');
  await popup.bringToFront();
  await popup.locator('#triggerMode').selectOption('hover');
  await poll(() => worker.evaluate(async () => (await chrome.storage.sync.get('triggerMode')).triggerMode), value => value === 'hover', 'hover restored');

  // Cancellation while a real extension message awaits a synthetic provider response.
  await worker.evaluate(() => { globalThis.delayedTerm = '바다'; });
  await page.bringToFront();
  await page.locator('#slow').hover();
  await poll(requests, value => value.some(request => request.term === '바다'), 'delayed request started');
  await page.keyboard.press('Escape');
  await worker.evaluate(() => releaseSynthetic());
  await page.waitForTimeout(400);
  assert.equal(await tip.isVisible(), false, 'late provider response cannot reopen closed tooltip');

  // Empty synthetic response exposes editable retry and disables saving until success.
  await page.locator('#empty-word').hover();
  await tip.locator('.kr-tooltip__retry').waitFor({ state: 'visible' });
  assert.equal(await tip.getByRole('button', { name: 'Save word', exact: true }).isEnabled(), false);
  await tip.getByRole('textbox', { name: 'Edit Korean word to retry' }).fill('친구');
  await tip.getByRole('button', { name: 'Try this word', exact: true }).click();
  await tip.filter({ hasText: 'SYNTHETIC vi 친구' }).waitFor({ state: 'visible' });
  await page.keyboard.press('Escape');

  // Worker pause integration uses a verified extension popup sender while reading tab is active.
  // It does NOT claim automated coverage of clicking Chrome's native toolbar popup.
  const pause = paused => worker.evaluate(paused => handleRequest({ action: 'setSitePaused', paused }, { id: chrome.runtime.id, url: chrome.runtime.getURL('popup.html') }), paused);
  await page.bringToFront();
  const paused = await pause(true);
  assert.equal(paused.ok, true, `pause active reading hostname: ${JSON.stringify(paused)}`);
  assert.equal(paused.hostname, '127.0.0.1');
  assert.equal((await pause(true)).count, 1, 'repeated pause is idempotent');
  const beforePause = (await requests()).length;
  await page.locator('#away').hover();
  await page.locator('#word').hover();
  await page.waitForTimeout(500);
  assert.equal((await requests()).length, beforePause);
  assert.equal(await tip.isVisible(), false);
  assert.equal(await worker.evaluate(async () => (await chrome.storage.sync.get('pausedHostnames')).pausedHostnames), undefined);
  assert.equal((await pause(false)).paused, false);

  // Explicit keyboard selection action: actual key events, focus transfer and restoration.
  await worker.evaluate(() => chrome.storage.sync.set({ selectionTranslationEnabled: true }));
  await page.locator('#focus-origin').focus();
  await page.locator('#word').evaluate(element => {
    const range = document.createRange(); range.selectNodeContents(element);
    const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range);
  });
  await page.keyboard.press('Alt+Enter');
  await page.waitForFunction(() => document.activeElement?.classList.contains('kr-tooltip'));
  assert.equal(await tip.getByRole('button', { name: 'Unpin', exact: true }).getAttribute('aria-pressed'), 'true');
  assert.equal(await tip.getByRole('button', { name: 'Save word', exact: true }).isEnabled(), false, 'sentence mode cannot save provider output');
  await page.keyboard.press('Escape');
  await tip.waitFor({ state: 'hidden' });
  assert.equal(await page.evaluate(() => document.activeElement.id), 'focus-origin');
  await page.evaluate(() => window.getSelection().removeAllRanges());
  await page.locator('#private-input').focus();
  const beforePrivateKey = (await requests()).length;
  await page.keyboard.press('Alt+Enter');
  await page.waitForTimeout(500);
  assert.equal((await requests()).length, beforePrivateKey, 'keyboard action never reads an editor');
  assert.equal(await tip.isVisible(), false);
  await worker.evaluate(() => chrome.storage.sync.set({ selectionTranslationEnabled: false }));

  await notebook.bringToFront();
  await notebook.reload();
  await notebook.getByRole('button', { name: 'Edit: 도서관', exact: true }).click();
  await notebook.locator('[name="meaning"]').fill('=SUM(1,2)');
  await notebook.locator('[name="note"]').fill('PRIVATE_NOTE_SENTINEL');
  await notebook.locator('[name="context"]').fill('My own example');
  // Dirty edit cancellation must preserve what the learner typed.
  notebook.once('dialog', dialog => dialog.dismiss());
  await notebook.getByRole('button', { name: 'Cancel', exact: true }).click();
  assert.equal(await notebook.locator('[name="note"]').inputValue(), 'PRIVATE_NOTE_SENTINEL');
  await notebook.getByRole('button', { name: 'Save changes', exact: true }).click();
  await notebook.locator('#status').filter({ hasText: 'Saved.' }).waitFor();
  await notebook.locator('#search').fill('PRIVATE_NOTE');
  assert.equal(await notebook.locator('.entry').count(), 1);
  await notebook.locator('#search').fill('no-such-word-xyz');
  await notebook.locator('#empty-title').filter({ hasText: 'No matching words' }).waitFor();

  // Exports cover ALL entries even when the current search has zero results.
  async function download(button, suffix) {
    const event = notebook.waitForEvent('download');
    await notebook.locator(button).click();
    const file = await event;
    assert.ok(file.suggestedFilename().endsWith(suffix));
    assert.equal(await file.failure(), null);
    return readFile(await file.path(), 'utf8');
  }
  assert.match(await download('#csv', '.csv'), /"'=SUM\(1,2\)"/);
  assert.match(await download('#tsv', '.tsv'), /\t'=SUM\(1,2\)\t/);
  const backup = JSON.parse(await download('#backup', '.json'));
  assert.equal(backup.items[0].note, 'PRIVATE_NOTE_SENTINEL');
  assert.equal(backup.items[0].meaning, '=SUM(1,2)');
  await notebook.locator('#search').fill('');

  // Both the ordinary page and its content-script isolated world lack private notebook reads.
  assert.equal(await page.evaluate(() => Boolean(globalThis.chrome?.storage?.local)), false);
  const cdp = await context.newCDPSession(page);
  const worlds = [];
  cdp.on('Runtime.executionContextCreated', event => worlds.push(event.context));
  await cdp.send('Runtime.enable');
  let checked = false;
  for (const world of worlds) {
    const identity = await cdp.send('Runtime.evaluate', { contextId: world.id, expression: "globalThis.chrome?.runtime?.id", returnByValue: true });
    if (identity.result.value !== id) continue;
    const response = await cdp.send('Runtime.evaluate', { contextId: world.id, expression: `(async () => { let blocked = false; try { await chrome.storage.local.get('kwlVocabularyV1'); } catch { blocked = true; } return { blocked, list: await chrome.runtime.sendMessage({action:'vocabularyList'}), saved: await chrome.runtime.sendMessage({action:'vocabularySave',term:'도서관',note:'INJECTED_PROVIDER_OUTPUT'}) }; })()`, awaitPromise: true, returnByValue: true });
    assert.equal(response.result.value.blocked, true);
    assert.deepEqual(response.result.value.list, { error: 'unauthorized' });
    assert.deepEqual(response.result.value.saved, { ok: true }, 'content duplicate response cannot expose own notes');
    checked = true;
  }
  assert.equal(checked, true);
  await cdp.detach();
  assert.equal((await snapshot()).items[0].note, 'PRIVATE_NOTE_SENTINEL');

  const upload = data => notebook.locator('#import-file').setInputFiles({ name: 'test-backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(data)) });
  const original = await snapshot();
  await upload({ ...backup, unexpected: 'reject unknown fields' });
  await notebook.locator('#status').filter({ hasText: 'No changes were made.' }).waitFor();
  assert.deepEqual(await snapshot(), original);
  const incoming = { ...backup, items: [{ ...backup.items[0], id: 'import-fixture', term: '친구', note: 'Imported own note' }] };
  notebook.once('dialog', dialog => { assert.match(dialog.message(), /Import preview: 1 added/); return dialog.dismiss(); });
  await upload(incoming);
  await poll(() => notebook.locator('#import').isEnabled(), Boolean, 'cancelled import unlocked UI');
  assert.deepEqual(await snapshot(), original);
  notebook.once('dialog', dialog => dialog.accept());
  await upload(incoming);
  await notebook.locator('#status').filter({ hasText: 'Import complete: 1 added' }).waitFor();
  notebook.once('dialog', dialog => dialog.accept());
  await upload(incoming);
  await notebook.locator('#status').filter({ hasText: 'Import complete: 0 added, 1 already saved' }).waitFor();
  assert.equal((await snapshot()).items.length, 2);

  // Inject an actual storage write rejection, while retaining real reads and message/UI flow.
  await worker.evaluate(() => {
    globalThis.failNotebookWrite = true;
    KWLVocabulary.init({ storage: {
      get: (...args) => chrome.storage.local.get(...args),
      set: (...args) => globalThis.failNotebookWrite ? Promise.reject(new Error('synthetic disk failure')) : chrome.storage.local.set(...args)
    }, enqueueMutation });
  });
  const beforeFailure = await snapshot();
  await page.bringToFront();
  await page.locator('#away').hover();
  await page.locator('#word').hover();
  await tip.filter({ hasText: 'SYNTHETIC vi 도서관' }).waitFor({ state: 'visible' });
  // Use a new term: duplicate saves correctly need no storage write.
  await page.keyboard.press('Escape');
  await page.locator('#other').hover();
  await tip.filter({ hasText: 'SYNTHETIC vi 학교' }).waitFor({ state: 'visible' });
  await tip.getByRole('button', { name: 'Save word', exact: true }).click();
  await tip.getByRole('status').filter({ hasText: 'Could not save. Try again.' }).waitFor();
  assert.equal(await tip.getByRole('button', { name: 'Save word', exact: true }).isEnabled(), true);
  assert.deepEqual(await snapshot(), beforeFailure);
  await page.keyboard.press('Escape');
  await notebook.bringToFront();
  await notebook.locator('#new-term').fill('실패');
  await notebook.locator('#add-form button').click();
  await notebook.locator('#status').filter({ hasText: 'Could not complete this action' }).waitFor();
  assert.deepEqual(await snapshot(), beforeFailure);
  assert.equal(await notebook.locator('#new-term').inputValue(), '실패', 'failed save retains learner input');
  await worker.evaluate(() => { globalThis.failNotebookWrite = false; });
  await notebook.getByRole('button', { name: 'Delete: 도서관', exact: true }).click();
  await notebook.locator('#undo').waitFor({ state: 'visible' });
  await notebook.reload();
  await notebook.locator('#undo').waitFor({ state: 'visible' });
  assert.equal((await snapshot()).deleted[0].note, 'PRIVATE_NOTE_SENTINEL');
  // Restart with deletion pending: both notebook and Undo must survive a real browser process.
  const transport = await requests();
  assert.ok(transport.some(request => request.language === 'en'));
  assert.ok(transport.some(request => request.language === 'vi'));
  assert.ok(transport.every(request => request.credentials === 'omit'));
  const expected = await snapshot();
  await context.close();
  context = await launch();
  const restarted = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
  const restored = await context.newPage();
  await restored.goto(`chrome-extension://${id}/notebook.html`);
  await restored.locator('#undo').waitFor({ state: 'visible' });
  assert.deepEqual(await restarted.evaluate(async () => (await chrome.storage.local.get('kwlVocabularyV1')).kwlVocabularyV1), expected);
  await restored.locator('#undo').click();
  await restored.locator('#status').filter({ hasText: 'Word restored.' }).waitFor();
  await restored.getByRole('button', { name: 'Edit: 도서관', exact: true }).waitFor();
  assert.equal(await restored.getByText('PRIVATE_NOTE_SENTINEL', { exact: true }).count(), 1);
  console.log('PASS: Chromium learning workspace: synthetic EN/VI, pin/copy/close/Esc, modifier, interrupted request, hostname pause, source-only repeated saves, private notebook boundary, own edits/search, safe CSV/TSV/JSON, strict preview/import/cancel/duplicate, storage failure, persistent delete/Undo + browser restart. Native toolbar popup and live-provider quality are not claimed.');
} catch (error) {
  // Synthetic fixture only: retain the assertion failure and log no storage values or keys.
  console.error('WORKSPACE_RUNTIME_ERRORS', JSON.stringify(runtimeErrors));
  for (const diagnosticPage of context.pages()) {
    if (!diagnosticPage.url().endsWith('/workspace-reading')) continue;
    try {
      console.error('WORKSPACE_READING_STATE', JSON.stringify(await diagnosticPage.evaluate(() => ({
        hidden: document.hidden,
        panel: document.querySelector('.kr-tooltip')?.textContent,
        display: document.querySelector('.kr-tooltip')?.style.display,
        activeElement: document.activeElement?.id || document.activeElement?.tagName
      }))));
    } catch (diagnosticError) { console.error('WORKSPACE_PAGE_DIAGNOSTIC_FAILED', diagnosticError.message); }
  }
  if (diagnosticsCDP) for (const world of diagnosticsWorlds) {
    try {
      const result = await diagnosticsCDP.send('Runtime.evaluate', {
        contextId:world.id, returnByValue:true,
        expression:`typeof isInitialized === 'undefined' ? null : ({isInitialized,sitePaused,isEnabled,isSelecting,tooltipPinned,tooltipHovered,tooltipMode,targetLanguage,lastWord,activeRequestId,cacheGeneration,pendingCount:pendingRequests.size,lastPoint:lastHoverPoint?{x:lastHoverPoint.clientX,y:lastHoverPoint.clientY,target:lastHoverPoint.target?.id,pointHitsTooltip:isTooltipNode(document.elementFromPoint(lastHoverPoint.clientX,lastHoverPoint.clientY)),targetPrivate:isPrivateNode(lastHoverPoint.target),word:getKoreanWordAtPoint(lastHoverPoint.clientX,lastHoverPoint.clientY)}:null})`
      });
      if (result.result.value) console.error('WORKSPACE_ISOLATED_STATE', JSON.stringify(result.result.value));
    } catch (diagnosticError) { console.error('WORKSPACE_CONTEXT_DIAGNOSTIC_FAILED', diagnosticError.message); }
  }
  const diagnosticWorker = context.serviceWorkers()[0];
  if (diagnosticWorker) try {
    console.error('WORKSPACE_WORKER_STATE', JSON.stringify(await diagnosticWorker.evaluate(async () => {
      if (!Array.isArray(globalThis.syntheticRequests)) return {syntheticFixture:'not-installed',directProbe:'not-run'};
      const requestsBeforeProbe = [...syntheticRequests];
      const probeLanguage = (await chrome.storage.sync.get('targetLanguage')).targetLanguage === 'vi' ? 'vi' : 'en';
      const directProbe = await Promise.race([
        handleRequest({action:'translateText',text:'도서관',targetLanguage:probeLanguage}, {id:chrome.runtime.id,url:'http://127.0.0.1/workspace-reading',tab:{id:0}}),
        new Promise(resolve => setTimeout(() => resolve({error:'diagnostic_timeout'}),2000))
      ]);
      return {requestsBeforeProbe,directProbe};
    })));
  } catch (diagnosticError) { console.error('WORKSPACE_WORKER_DIAGNOSTIC_FAILED', diagnosticError.message); }
  throw error;
} finally {
  await context.close();
  await rm(profile, { recursive: true, force: true });
}
