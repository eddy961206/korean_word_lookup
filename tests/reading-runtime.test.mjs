import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';

const source = await readFile(new URL('../background.js', import.meta.url), 'utf8');
const vocabularySource = await readFile(new URL('../vocabulary-store.js', import.meta.url), 'utf8');
const extensionId = 'test-extension';
const popup = { id: extensionId, url: `chrome-extension://${extensionId}/popup.html` };
const content = { id: extensionId, url: 'https://example.test/', tab: { id: 1 } };

// 가짜 저장소와 공급자를 사용해 실제 키/사용자 텍스트를 외부로 전송하지 않는다.
async function loadBackground({ sync = {}, local = {}, session = {}, failRestriction = false, failMigration = false, delayMs = 0, fetchImpl } = {}) {
  let listener;
  const requests = [];
  const calls = [];
  const chrome = {
    runtime: {
      id: extensionId, lastError: null,
      getURL: path => `chrome-extension://${extensionId}/${path}`,
      getManifest: () => ({ version: '2.5.3' }),
      onInstalled: { addListener() {} },
      onMessage: { addListener(callback) { listener = callback; } },
      setUninstallURL() {}
    },
    i18n: { getUILanguage: () => 'en' },
    action: { setBadgeText() {}, setBadgeBackgroundColor() {}, setTitle() {} },
    commands: { onCommand: { addListener() {} } },
    tabs: { create: async () => ({ id: 1 }), query: (_query, callback) => callback([]), sendMessage() {} }
  };
  function storage(values, name) {
    return {
      async setAccessLevel(options) {
        calls.push([name, 'setAccessLevel', options]);
        if (failRestriction) throw new Error('not supported');
        if (delayMs) await new Promise(resolve => setTimeout(resolve, delayMs));
      },
      get(keys, callback) {
        const result = keys === null ? { ...values }
          : Object.fromEntries((Array.isArray(keys) ? keys : [keys]).filter(key => key in values).map(key => [key, values[key]]));
        callback(vm.runInContext(`JSON.parse(${JSON.stringify(JSON.stringify(result))})`, context));
      },
      set(next, callback) {
        calls.push([name, 'set', next]);
        if (failMigration && Object.hasOwn(next, 'krdictApiKey')) {
          chrome.runtime.lastError = { message: 'disk failure' };
          callback?.();
          chrome.runtime.lastError = null;
          return;
        }
        Object.assign(values, next); callback?.();
      },
      remove(keys, callback) {
        calls.push([name, 'remove', keys]);
        for (const key of Array.isArray(keys) ? keys : [keys]) delete values[key];
        callback?.();
      }
    };
  }
  chrome.storage = { session: storage(session, 'session'), sync: storage(sync, 'sync'), local: storage(local, 'local'), onChanged: { addListener() {} } };
  const context = vm.createContext({ chrome, URL, URLSearchParams, AbortController, setTimeout, clearTimeout, crypto: webcrypto, TextEncoder,
    importScripts: path => { assert.equal(path, 'vocabulary-store.js'); vm.runInContext(vocabularySource, context); },
    fetch: async (url, options) => {
      requests.push({ url, options });
      return fetchImpl ? fetchImpl(url, options) : { ok: true, text: async () => '[[["Hello. ","안녕하세요. "],["Nice to meet you.","만나서 반갑습니다."]]]' };
    }
  });
  vm.runInContext(source, context);
  const send = (message, sender = content) => new Promise(resolve => listener(vm.runInContext(`JSON.parse(${JSON.stringify(JSON.stringify(message))})`, context), sender, resolve));
  await send({ action: 'readUsageState' });
  return { send, local, sync, session, requests, calls, context, chrome }; 
}

test('Google sends Vietnamese tl, rejects stale language, and KRDICT maps vi to official 7', async () => {
  const state = await loadBackground({ sync: { targetLanguage: 'vi' }, session: { krdictApiKey: 'fake-key' } });
  await state.send({ action: 'translateText', text: '한국어', targetLanguage: 'vi' });
  assert.equal(new URL(state.requests[0].url).searchParams.get('tl'), 'vi');
  assert.equal((await state.send({ action: 'translateText', text: '한국어', targetLanguage: 'en' })).error, 'settings_changed');
  await state.send({ action: 'lookupDictionary', text: '한국어', targetLanguage: 'vi' });
  assert.equal(new URL(state.requests[1].url).searchParams.get('trans_lang'), '7');
});

test('site pause saves hostname locally, blocks providers, and restricts management to popup', async () => {
  const state = await loadBackground();
  state.chrome.tabs.query = (_query, callback) => callback([{ id: 1 }]);
  state.chrome.tabs.sendMessage = (_id, request, options, callback) => {
    if (request.action === 'getCurrentSiteContext') { assert.equal(options.frameId, 0); callback({ supported: true, hostname: 'example.test' }); }
    else { assert.equal(request.paused, undefined); options?.(); }
  };
  assert.equal((await state.send({ action: 'setSitePaused', paused: true })).error, 'unauthorized');
  const result = await state.send({ action: 'setSitePaused', paused: true }, popup);
  assert.equal(result.supported, true); assert.equal(result.paused, true);
  assert.deepEqual(Array.from(state.local.pausedHostnames), ['example.test']);
  assert.equal(state.sync.pausedHostnames, undefined);
  assert.equal((await state.send({ action: 'translateText', text: '한국어' })).error, 'site_paused');
  assert.equal((await state.send({ action: 'lookupDictionary', text: '한국어' })).error, 'site_paused');
  assert.equal(state.requests.length, 0);
  await state.send({ action: 'clearPausedSites' }, popup);
  assert.equal((await state.send({ action: 'getSiteState' })).paused, false);
});

test('notebook operations enforce trusted contexts and strip provider fields from content save', async () => {
  const state = await loadBackground();
  let request;
  state.context.KWLVocabulary = { handle: async value => { request = value; return { ok: true, item: { meaning: 'private meaning', context: 'private context' } }; } };
  for (const action of ['vocabularyList', 'vocabularyUpdate', 'vocabularyDelete', 'vocabularyImport', 'vocabularyUndoDelete']) {
    assert.equal((await state.send({ action })).error, 'unauthorized');
  }
  assert.equal((await state.send({ action: 'vocabularySave', term: '한국어', meaning: 'provider definition' })).ok, true);
  assert.deepEqual(Object.keys(request).sort(), ['action', 'term']);
  const saved = await state.send({ action: 'vocabularySave', term: '한국어' });
  assert.deepEqual(Object.keys(saved), ['ok']);
  assert.equal((await state.send({ action: 'openNotebook' })).ok, true);
  assert.equal((await state.send({ action: 'openNotebook' }, { id: extensionId, url: content.url })).error, 'unauthorized');
  assert.equal((await state.send({ action: 'vocabularySave', term: '한'.repeat(101) })).error, 'invalid_term');
  assert.equal((await state.send({ action: 'vocabularyList' }, popup)).ok, true);
  assert.equal((await state.send({ action: 'vocabularyList' }, { ...popup, url: 'chrome-extension://test-extension/notebook.html' })).ok, true);
});

test('real vocabulary module shares background mutation queue and never exposes saved private meaning to content', async () => {
  const state = await loadBackground();
  assert.deepEqual(JSON.parse(JSON.stringify(await state.send({ action: 'vocabularySave', term: '한국어' }))), { ok: true });
  const list = await state.send({ action: 'vocabularyList' }, popup);
  assert.equal(list.items.length, 1);
  const item = list.items[0];
  assert.equal((await state.send({ action: 'vocabularyUpdate', id: item.id,
    fields: { term: '한국어', meaning: 'My private meaning', note: '', context: 'Private note' } }, popup)).ok, true);
  const duplicate = await state.send({ action: 'vocabularySave', term: '한국어' });
  assert.deepEqual(Object.keys(duplicate), ['ok']);
  assert.equal(duplicate.ok, true);
});

test('site management fails closed when content is absent or returns an unbounded URL instead of hostname', async () => {
  const state = await loadBackground();
  state.chrome.tabs.query = (_query, callback) => callback([{ id: 1 }]);
  for (const response of [undefined, { supported: false }, { supported: true, hostname: 'example.test/private?q=secret' }, { supported: true, hostname: 'a'.repeat(254) }]) {
    state.chrome.tabs.sendMessage = (_id, _request, _options, callback) => callback(response);
    assert.equal((await state.send({ action: 'getSiteState' }, popup)).supported, false);
    assert.equal((await state.send({ action: 'setSitePaused', paused: true }, popup)).error, 'unsupported_site');
  }
  assert.equal(state.local.pausedHostnames, undefined);
});

test('exact own popup tab is trusted but external, mismatched, and content senders are denied', async () => {
  const state = await loadBackground();
  const popupTab = { ...popup, tab: { id: 7, url: popup.url } };
  assert.equal((await state.send({ action: 'getDictionaryKeyStatus' }, popup)).hasKey, false);
  assert.equal((await state.send({ action: 'getDictionaryKeyStatus' }, popupTab)).hasKey, false);
  assert.equal((await state.send({ action: 'setDictionaryKey', key: 'test-key' }, popupTab)).ok, true);
  for (const sender of [content, { ...popupTab, id: 'another-extension' },
    { ...popupTab, url: 'https://example.test/popup.html' },
    { ...popupTab, tab: { id: 7, url: 'https://example.test/' } },
    { ...popupTab, tab: { id: 7 } },
    { ...popupTab, url: popup.url + '?forged=1' }]) {
    assert.equal((await state.send({ action: 'getDictionaryKeyStatus' }, sender)).error, 'unauthorized');
    assert.equal((await state.send({ action: 'setDictionaryKey', key: 'should-not-save' }, sender)).error, 'unauthorized');
  }
  assert.equal(state.session.krdictApiKey, 'test-key');
});
