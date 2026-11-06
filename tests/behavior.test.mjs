import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const contentSource = await readFile(new URL('../content.js', import.meta.url), 'utf8');
const backgroundSource = await readFile(new URL('../background.js', import.meta.url), 'utf8');

function createElement() {
  return {
    style: {},
    classList: { toggle() {} },
    appendChild() {},
    removeChild() {},
    firstChild: null,
    textContent: ''
  };
}

function createChrome(syncValues = {}) {
  const localValues = {};
  const messages = [];
  const listeners = {};
  const storageArea = (values) => ({
    get(keys, callback) {
      callback(Object.fromEntries(keys.filter((key) => key in values).map((key) => [key, values[key]])));
    },
    set(valuesToSet, callback) {
      Object.assign(values, valuesToSet);
      callback?.();
    }
  });
  const chrome = {
    storage: {
      sync: storageArea(syncValues),
      local: storageArea(localValues),
      onChanged: { addListener() {} }
    },
    runtime: {
      getURL: (path) => `chrome-extension://test/${path}`,
      onInstalled: { addListener() {} },
      onMessage: { addListener() {} },
      setUninstallURL() {},
      sendMessage(message, callback) {
        messages.push(message);
        callback?.();
        return Promise.resolve({ apiKey: '' });
      }
    },
    action: { setBadgeText() {}, setBadgeBackgroundColor() {}, setTitle() {} },
    commands: { onCommand: { addListener(callback) { listeners.command = callback; } } },
    tabs: { query(query, callback) { callback([]); } },
    i18n: { getMessage: (key) => key }
  };
  return { chrome, syncValues, localValues, messages, listeners };
}

async function loadContent({ syncValues, fetch: fetchImpl } = {}) {
  const state = createChrome(syncValues);
  const context = vm.createContext({
    chrome: state.chrome,
    document: { createElement, body: { appendChild() {} }, addEventListener() {} },
    console: { error() {}, warn() {} },
    self: {},
    URLSearchParams,
    setTimeout,
    clearTimeout,
    fetch: fetchImpl ?? (async () => ({ ok: false }))
  });
  // Capture the existing startup promise so tests wait for the real settings load.
  const instrumentedSource = contentSource.replace(
    'initializeExtension().catch(error => {',
    'globalThis.initialization = initializeExtension().catch(error => {'
  );
  vm.runInContext(instrumentedSource, context);
  await context.initialization;
  return { ...state, context };
}

test('content translation uses background messages, not page-origin fetch', async () => {
  const { context, chrome, messages } = await loadContent({ fetch: () => { throw new Error('content must not fetch'); } });
  chrome.runtime.sendMessage = async message => {
    messages.push(message);
    return { translation: 'Hello. Nice to meet you.' };
  };
  assert.equal(await context.translateText('안녕하세요. 만나서 반갑습니다.'), 'Hello. Nice to meet you.');
  assert.equal(messages.at(-1).action, 'translateText');
});

test('disabled automatic fallback stays disabled when a page initializes', async () => {
  const { context, messages } = await loadContent({ syncValues: { autoFallbackEnabled: false } });
  const result = await context.lookupWord('한국어');
  assert.equal(result.type, 'error');
  assert.equal(messages.some((message) => message.action === 'lookupDictionary'), false);
});

for (const compactTooltip of [false, true]) {
  test(`dictionary success records usage and activation in ${compactTooltip ? 'compact' : 'expanded'} mode`, async () => {
    const { context, messages, localValues } = await loadContent({ syncValues: { compactTooltip } });
    context.renderDictionaryResult({
      word: '한국어',
      primaryTranslation: 'Korean',
      pos: 'n.',
      englishDefs: ['Korean language'],
      koreanDefs: ['한국어']
    });
    // 최초 성공 저장/중복 제거는 백그라운드에 위임한다.
    await new Promise(setImmediate);
    assert.equal(messages.filter((message) => message.action === 'trackUsage' && message.kind === 'word').length, 1);
    assert.equal(messages.filter((message) => message.eventName === 'feature_use' && message.payload.source === 'krdict').length, 1);
    assert.equal(messages.filter((message) => message.action === 'markFirstSuccess' && message.kind === 'word_dict').length, 1);
    assert.equal(messages.filter((message) => message.eventName === 'first_success').length, 0);
    assert.equal(localValues.firstSuccessAt, undefined);
  });
}

test('first translation shortcut disables the default enabled state', () => {
  const { chrome, listeners, syncValues } = createChrome();
  vm.runInNewContext(backgroundSource, { chrome, URLSearchParams });
  listeners.command('toggle-translation');
  assert.equal(syncValues.translationEnabled, false);
  listeners.command('toggle-translation');
  assert.equal(syncValues.translationEnabled, true);
});
