import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const source = await readFile(new URL('../background.js', import.meta.url), 'utf8');
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
        callback(result);
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
  const context = vm.createContext({ chrome, URLSearchParams, AbortController, setTimeout, clearTimeout,
    fetch: async (url, options) => {
      requests.push({ url, options });
      return fetchImpl ? fetchImpl(url, options) : { ok: true, text: async () => '[[["Hello. ","안녕하세요. "],["Nice to meet you.","만나서 반갑습니다."]]]' };
    }
  });
  vm.runInContext(source, context);
  const send = (message, sender = content) => new Promise(resolve => listener(message, sender, resolve));
  await send({ action: 'readUsageState' });
  return { send, local, sync, session, requests, calls, context };
}

test('key migration restricts session storage before writing and removes persistent keys', async () => {
  const state = await loadBackground({ sync: { krdictApiKey: 'legacy-test-key' } });
  assert.equal(state.session.krdictApiKey, 'legacy-test-key');
  assert.equal(state.sync.krdictApiKey, undefined);
  assert.equal(state.local.krdictApiKey, undefined);
  assert.equal(state.calls[1][0], 'session');
  assert.equal(state.calls[1][2].accessLevel, 'TRUSTED_CONTEXTS');
  assert.equal(state.calls[0][1], 'setAccessLevel');
  assert.equal(state.calls[0][2].accessLevel, 'TRUSTED_CONTEXTS');
  assert.equal((await state.send({ action: 'getApiKey' })).error, 'unsupported_action');
  assert.equal((await state.send({ action: 'getDictionaryKeyStatus' })).error, 'unauthorized');
  assert.equal((await state.send({ action: 'getDictionaryKeyStatus' }, popup)).hasKey, true);
});

test('a newer local key or an intentional clear wins over a stale synced key', async () => {
  for (const key of ['new-local-key', '']) {
    const state = await loadBackground({ local: { krdictApiKey: key }, sync: { krdictApiKey: 'old-key' } });
    assert.equal(state.session.krdictApiKey, key);
    assert.equal(state.sync.krdictApiKey, undefined);
  }
});

test('migration failures preserve the old key and fail closed', async () => {
  for (const failure of [{ failRestriction: true }, { failMigration: true }]) {
    const state = await loadBackground({ sync: { krdictApiKey: 'keep-me' }, ...failure });
    assert.equal(state.sync.krdictApiKey, 'keep-me');
    assert.equal((await state.send({ action: 'lookupDictionary', text: '한국어' })).error, 'unavailable');
    assert.equal(state.requests.length, 0);
  }
});

test('only the extension popup can save/clear a key and the raw key is never returned', async () => {
  const state = await loadBackground();
  const request = { action: 'setDictionaryKey', key: 'test-key-123' };
  assert.equal((await state.send(request)).error, 'unauthorized');
  assert.equal((await state.send(request, { ...popup, id: 'different-extension' })).error, 'unauthorized');
  const result = await state.send(request, popup);
  assert.equal(result.ok, true);
  assert.equal(JSON.stringify(result).includes('test-key-123'), false);
  assert.equal(state.session.krdictApiKey, 'test-key-123');
  assert.equal((await state.send({ action: 'setDictionaryKey', key: '' }, popup)).hasKey, false);
  assert.equal(state.session.krdictApiKey, '');
});

test('service-worker translation includes all sentences and omits credentials/referrer', async () => {
  const state = await loadBackground();
  const result = await state.send({ action: 'translateText', text: '안녕하세요. 만나서 반갑습니다.' });
  assert.equal(result.translation, 'Hello. Nice to meet you.');
  const { url, options } = state.requests[0];
  assert.equal(new URL(url).hostname, 'translate.googleapis.com');
  assert.equal(options.credentials, 'omit');
  assert.equal(options.referrerPolicy, 'no-referrer');
  assert.equal(options.redirect, 'error');
  assert.equal(options.cache, 'no-store');
  assert.equal(JSON.stringify(state.local).includes('안녕하세요'), false);
});

test('dictionary requests encode the key and never disclose a reflected key', async () => {
  const key = 'test-key&x=1';
  const state = await loadBackground({ local: { krdictApiKey: key }, fetchImpl: async () => ({ ok: true, text: async () => `<error>${key}</error>` }) });
  const result = await state.send({ action: 'lookupDictionary', text: '한국어' });
  assert.equal(new URL(state.requests[0].url).searchParams.get('key'), key);
  assert.equal(new URL(state.requests[0].url).searchParams.has('x'), false);
  assert.equal(result.error, 'provider_error');
  assert.equal(JSON.stringify(result).includes(key), false);
});

test('missing dictionary key, invalid messages and disabled translation make no network calls', async () => {
  const state = await loadBackground();
  assert.equal((await state.send({ action: 'lookupDictionary', text: '한국어' })).error, 'missing_key');
  for (const text of ['', null, {}, '가'.repeat(501)]) {
    assert.equal((await state.send({ action: 'translateText', text })).error, 'invalid_text');
  }
  state.sync.translationEnabled = false;
  assert.equal((await state.send({ action: 'translateText', text: '한국어' })).error, 'disabled');
  assert.equal(state.requests.length, 0);
});

test('provider timeout and invalid responses fail without throwing', async () => {
  for (const fetchImpl of [
    async () => ({ ok: false }),
    async () => ({ ok: true, text: async () => 'not json' }),
    async () => { throw new Error('offline'); }
  ]) {
    const state = await loadBackground({ fetchImpl });
    assert.equal((await state.send({ action: 'translateText', text: '한국어' })).translation, null);
  }
  const state = await loadBackground({ fetchImpl: (_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(new Error('timeout')));
  }) });
  // 실제 8초 대기 없이 타이머와 AbortController 연결을 확인한다.
  state.context.setTimeout = callback => { queueMicrotask(callback); return 1; };
  state.context.clearTimeout = () => {};
  assert.equal((await state.send({ action: 'translateText', text: '한국어' })).translation, null);
});

test('first success and usage updates are serialized across tabs', async () => {
  const state = await loadBackground();
  await Promise.all(Array.from({ length: 20 }, () => state.send({ action: 'markFirstSuccess', kind: 'word_google' })));
  assert.equal(state.local.analyticsEventTrail.filter(event => event.eventName === 'first_success').length, 1);
  await Promise.all(Array.from({ length: 20 }, () => state.send({ action: 'trackUsage', kind: 'word' })));
  assert.equal(state.local.wordLookupCount, 20);
});

test('analytics stay local, remove old credentials, and reject text/URL/unknown events', async () => {
  const state = await loadBackground({ local: {
    ga4TelemetryEnabled: true, ga4ApiSecret: 'old-test-secret', analyticsClientId: 'old-client',
    'analyticsEventCounts:2000-01-01': { feature_use: 5 },
    analyticsEventTrail: [{ eventName: 'feature_use', ts: 1, payload: { message: 'private text' } }]
  } });
  await state.send({ action: 'trackEvent', eventName: 'private text', payload: { message: 'private text' } });
  await state.send({ action: 'trackEvent', eventName: 'lookup_error', payload: {
    source: 'google', message: 'private text', reason: 'https://private.test', url: 'https://private.test', kind: '한국어'
  } });
  assert.equal(state.requests.length, 0);
  assert.equal(state.local.ga4ApiSecret, undefined);
  assert.equal(state.local.analyticsClientId, undefined);
  assert.equal(state.local['analyticsEventCounts:2000-01-01'], undefined);
  assert.equal(state.local.analyticsEventTrail.length, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(state.local.analyticsEventTrail[0].payload)), { source: 'google' });
  assert.equal(JSON.stringify(state.local).includes('private'), false);
});

test('selection sends are rejected if the user turned selection mode off', async () => {
  const state = await loadBackground();
  assert.equal((await state.send({ action: 'translateText', text: '한국어', kind: 'selection' })).error, 'disabled');
  assert.equal(state.requests.length, 0);
  state.sync.selectionTranslationEnabled = true;
  assert.equal((await state.send({ action: 'translateText', text: '한국어', kind: 'selection' })).translation, 'Hello. Nice to meet you.');
});

test('local history enforces the 200-entry cap and removes expired or malformed entries', async () => {
  const now = Date.now();
  const state = await loadBackground({ local: {
    'analyticsEventCounts:2999-01-01': { feature_use: 1 },
    'analyticsEventCounts:not-a-date': { feature_use: 1 },
    analyticsEventTrail: [
      null,
      { eventName: 'feature_use', ts: now - 31 * 24 * 60 * 60 * 1000 },
      { eventName: 'feature_use', ts: now + 24 * 60 * 60 * 1000 },
      ...Array.from({ length: 205 }, () => ({ eventName: 'feature_use', ts: now, payload: { source: 'google', message: 'discard me' } }))
    ]
  } });
  await state.send({ action: 'trackEvent', eventName: 'popup_open' });
  assert.equal(state.local.analyticsEventTrail.length, 200);
  assert.equal(state.local['analyticsEventCounts:2999-01-01'], undefined);
  assert.equal(state.local['analyticsEventCounts:not-a-date'], undefined);
  assert.ok(state.local.analyticsEventTrail.every(event => event.ts >= now && event.ts <= Date.now()));
  assert.equal(JSON.stringify(state.local).includes('discard me'), false);
});

test('page scripts contain no key retrieval, local-storage, or direct provider-fetch path', async () => {
  const contentSource = await readFile(new URL('../content.js', import.meta.url), 'utf8');
  assert.doesNotMatch(contentSource, /getApiKey|krdictApiKey|chrome\.storage\.local|\bfetch\(/u);
});


test('service-worker restart retains the session key without persistent writes', async () => {
  const session = {};
  const first = await loadBackground({ session });
  await first.send({ action: 'setDictionaryKey', key: 'memory-test-key' }, popup);
  const restarted = await loadBackground({ session, local: first.local, sync: first.sync });
  assert.equal((await restarted.send({ action: 'getDictionaryKeyStatus' }, popup)).hasKey, true);
  assert.equal(restarted.session.krdictApiKey, 'memory-test-key');
  for (const [area, method, value] of [...first.calls, ...restarted.calls]) {
    if (area !== 'session' && method === 'set') assert.equal(Object.hasOwn(value, 'krdictApiKey'), false);
  }
  const browserRestart = await loadBackground({ local: first.local, sync: first.sync });
  assert.equal((await browserRestart.send({ action: 'getDictionaryKeyStatus' }, popup)).hasKey, false);
});

test('session value including a clear wins over both legacy copies', async () => {
  for (const key of ['session-key', '']) {
    const state = await loadBackground({ session: { krdictApiKey: key }, local: { krdictApiKey: 'local-key' }, sync: { krdictApiKey: 'sync-key' } });
    assert.equal(state.session.krdictApiKey, key);
    assert.equal(state.local.krdictApiKey, undefined);
    assert.equal(state.sync.krdictApiKey, undefined);
  }
});

test('failed session transfer preserves both legacy copies', async () => {
  const state = await loadBackground({ local: { krdictApiKey: 'local-key' }, sync: { krdictApiKey: 'sync-key' }, failMigration: true });
  assert.equal(state.local.krdictApiKey, 'local-key');
  assert.equal(state.sync.krdictApiKey, 'sync-key');
  assert.equal(state.session.krdictApiKey, undefined);
  assert.equal((await state.send({ action: 'setDictionaryKey', key: '' }, popup)).error, 'unavailable');
});

test('messages wait for asynchronous session initialization and migration', async () => {
  const state = await loadBackground({ sync: { krdictApiKey: 'legacy-key' }, delayMs: 5 });
  assert.equal((await state.send({ action: 'getDictionaryKeyStatus' }, popup)).hasKey, true);
  assert.equal(state.session.krdictApiKey, 'legacy-key');
  assert.equal(state.sync.krdictApiKey, undefined);
});
