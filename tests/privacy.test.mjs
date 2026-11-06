import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const source = await readFile(new URL('../content.js', import.meta.url), 'utf8');
const element = (tagName = 'DIV', attributes = {}, parentNode = null) => ({
  nodeType: 1, tagName, parentNode,
  getAttribute: key => attributes[key] ?? null,
  style: {}, classList: { toggle() {} }, appendChild() {}, removeChild() {}
});
const textNode = parentNode => ({ nodeType: 3, textContent: '한국어', parentNode });

// 실제 콘텐츠 스크립트를 실행하고 타이머/DOM만 제어하여 전송 전 검사를 검증한다.
async function setup({ duringStartup } = {}) {
  const timers = new Map();
  const listeners = {};
  const messages = [];
  let id = 0;
  const normal = element();
  const text = textNode(normal);
  const document = {
    body: element(), activeElement: normal, hidden: false,
    createElement: () => element(),
    addEventListener: (name, callback) => { listeners[name] = callback; },
    elementFromPoint: () => normal,
    caretRangeFromPoint: () => ({ startContainer: text, startOffset: 0 })
  };
  let selection = {
    anchorNode: text, focusNode: text, isCollapsed: false, rangeCount: 1,
    toString: () => '한국어',
    getRangeAt: () => ({ commonAncestorContainer: normal, getBoundingClientRect: () => ({}), getClientRects: () => [] })
  };
  const context = vm.createContext({
    Node: { ELEMENT_NODE: 1, TEXT_NODE: 3 }, document,
    window: { getSelection: () => selection }, self: {}, URLSearchParams,
    console: { error() {}, warn() {} },
    setTimeout: callback => { timers.set(++id, callback); return id; },
    clearTimeout: id => timers.delete(id),
    chrome: {
      storage: { sync: { get: (_keys, callback) => callback({ selectionTranslationEnabled: true }) }, onChanged: { addListener(callback) { listeners.storage = callback; } } },
      runtime: { sendMessage: async message => { messages.push(message); if (message.action === 'readUsageState') await duringStartup?.(listeners); return {}; }, onMessage: { addListener(callback) { listeners.message = callback; } } },
      i18n: { getMessage: key => key }
    }
  });
  vm.runInContext(source.replace('initializeExtension().catch(error => {', 'globalThis.ready = initializeExtension().catch(error => {'), context);
  await context.ready;
  vm.runInContext(`globalThis.originalLookupWord = lookupWord; globalThis.originalLookupSelection = lookupSelection; globalThis.requests = []; lookupSelection = async text => { requests.push(text); return {type:'selection',translation:'Korean'}; }; lookupWord = async text => { requests.push(text); return {type:'google',translation:'Korean'}; }; renderSelectionLoading = renderSelectionResult = renderLoadingState = renderLookupResult = () => {};`, context);
  return { context, document, listeners, timers, normal, text, selection, messages, setSelection: value => { selection = value; } };
}

for (const value of ['', 'true', 'plaintext-only', 'TRUE']) {
  test(`hover excludes inherited contenteditable=${JSON.stringify(value)}`, async () => {
    const { context, document } = await setup();
    const privateText = textNode(element('SPAN', {}, element('DIV', { contenteditable: value })));
    document.caretRangeFromPoint = () => ({ startContainer: privateText, startOffset: 0 });
    assert.equal(context.getKoreanWordAtPoint(1, 1), null);
  });
}

test('privacy guard traverses shadow roots and slot ancestors', async () => {
  const { context } = await setup();
  const host = element('DIV', { contenteditable: '' });
  assert.equal(context.isPrivateNode(textNode({ nodeType: 11, getRootNode: () => ({ host }) })), true);
  assert.equal(context.isPrivateNode({ ...element(), assignedSlot: element('TEXTAREA') }), true);
  assert.equal(context.isPrivateNode(element('INPUT', { type: 'password' })), true);
  assert.equal(context.isPrivateNode(element('DIV', { role: 'textbox' })), true);
});

test('selection rejects private focus endpoint and embedded editable ranges', async () => {
  const { context, selection, normal } = await setup();
  selection.focusNode = textNode(element('TEXTAREA'));
  assert.equal(context.isEditableSelection(selection), true);
  selection.focusNode = selection.anchorNode;
  normal.querySelectorAll = () => [element('DIV', { contenteditable: 'plaintext-only' })];
  selection.getRangeAt = () => ({ commonAncestorContainer: normal, intersectsNode: () => true });
  assert.equal(context.isEditableSelection(selection), true);
});

test('queued selection rechecks editability before sending', async () => {
  const { context, selection, timers } = await setup();
  context.handleSelectionChange();
  selection.focusNode = textNode(element('INPUT'));
  for (const callback of timers.values()) await callback();
  assert.equal(context.requests.length, 0);
});

test('same-text selection change does not cancel the first lookup timer', async () => {
  const { context, timers } = await setup();
  context.handleSelectionChange();
  context.handleSelectionChange();
  assert.equal(timers.size, 1);
});

for (const event of ['focusin', 'scroll', 'visibilitychange', 'mouseleave']) {
  test(`${event} cancels a queued hover`, async () => {
    const { context, listeners, timers, normal } = await setup();
    context.scheduleLookup({ target: normal, clientX: 1, clientY: 1 });
    assert.equal(timers.size, 1);
    listeners[event]();
    assert.equal(timers.size, 0);
    assert.equal(context.requests.length, 0);
  });
}

test('disabled or newly editable hover contexts never send', async () => {
  const { context, normal, timers } = await setup();
  context.scheduleLookup({ target: normal, clientX: 1, clientY: 1 });
  normal.isContentEditable = true;
  for (const callback of timers.values()) await callback();
  assert.equal(context.requests.length, 0);
  normal.isContentEditable = false;
  vm.runInContext('isEnabled = false', context);
  await context.handleHover({ target: normal, clientX: 1, clientY: 1 });
  assert.equal(context.requests.length, 0);
});

test('transient errors are not cached but successes are', async () => {
  const { context } = await setup();
  context.cacheResult('failed', { type: 'error' });
  assert.equal(context.getCacheEntry('failed'), null);
  context.cacheResult('ok', { type: 'google', translation: 'Korean' });
  assert.equal(context.getCacheEntry('ok').translation, 'Korean');
});

test('on-device initialization retries after a transient failure', async () => {
  const { context } = await setup();
  let attempts = 0;
  context.self.Translator = true;
  context.Translator = {
    availability: async () => 'available',
    create: async () => { if (++attempts === 1) throw new Error('not ready'); return { translate() {} }; }
  };
  assert.equal(await context.getOnDeviceTranslator(), null);
  assert.ok(await context.getOnDeviceTranslator());
  assert.equal(attempts, 2);
});

test('selection responses cannot render after their context becomes private', async () => {
  const { context, selection } = await setup();
  vm.runInContext(`selectionText = '한국어'; selectionRequestId = 1;
    globalThis.rendered = 0;
    lookupSelection = () => new Promise(resolve => { globalThis.complete = resolve; });
    renderSelectionResult = () => { rendered += 1; };`, context);
  const pending = context.translateSelection('한국어', 1);
  selection.focusNode = textNode(element('TEXTAREA'));
  context.complete({ type: 'selection', translation: 'Korean' });
  await pending;
  assert.equal(context.rendered, 0);
});

test('private composed event paths cancel hover even when retargeted to a safe host', async () => {
  const { context, normal, timers } = await setup();
  context.scheduleLookup({ target: normal, clientX: 1, clientY: 1,
    composedPath: () => [element('DIV', { contenteditable: '' }), normal] });
  assert.equal(timers.size, 0);
  assert.equal(context.requests.length, 0);
});

test('settings changes during usage-state startup override the older snapshot', async () => {
  const { context } = await setup({ duringStartup: async listeners => {
    listeners.storage({ selectionTranslationEnabled: { newValue: false }, translationEnabled: { newValue: false } }, 'sync');
  } });
  assert.equal(vm.runInContext('selectionTranslationEnabled', context), false);
  assert.equal(vm.runInContext('isEnabled', context), false);
});

test('toggle messages received during startup are not overwritten by defaults', async () => {
  const { context } = await setup({ duringStartup: async listeners => {
    listeners.message({ action: 'toggleTranslation', enabled: false }, {}, () => {});
  } });
  assert.equal(vm.runInContext('isEnabled', context), false);
});

test('moving within the same translated word does not record another success', async () => {
  const { context, normal, timers } = await setup();
  await context.handleHover({ target: normal, clientX: 1, clientY: 1 });
  assert.equal(context.requests.length, 1);
  context.scheduleLookup({ target: normal, clientX: 2, clientY: 1 });
  assert.equal(timers.size, 0);
  assert.equal(context.requests.length, 1);
});

test('dictionary invalidation clears results and prevents older pending responses from recaching', async () => {
  const { context, listeners } = await setup();
  context.cacheResult('cached', { type: 'google', translation: 'old' });
  vm.runInContext(`performLookup = () => new Promise(resolve => { globalThis.completeLookup = resolve; });`, context);
  const pending = context.originalLookupWord('한국어');
  listeners.message({ action: 'invalidateDictionaryCache' }, {}, () => {});
  assert.equal(context.getCacheEntry('cached'), null);
  context.completeLookup({ type: 'google', translation: 'old fallback' });
  await pending;
  assert.equal(vm.runInContext('translationCache.size', context), 0);
  assert.equal(vm.runInContext('pendingRequests.size', context), 0);
});

test('selection requests are explicitly tagged for background settings enforcement', async () => {
  const { context, messages } = await setup();
  await context.originalLookupSelection('한국어');
  assert.equal(messages.find(message => message.action === 'translateText').kind, 'selection');
  await context.translateText('단어');
  assert.equal(messages.filter(message => message.action === 'translateText').at(-1).kind, 'word');
});

test('hover recovers after release outside the document without interrupting a held drag', async () => {
  const { context, listeners, normal, timers } = await setup();
  listeners.mousedown();
  listeners.mouseleave();
  context.scheduleLookup({ target: normal, clientX: 1, clientY: 1, buttons: 1 });
  assert.equal(timers.size, 0);
  assert.equal(vm.runInContext('isSelecting', context), true);
  context.scheduleLookup({ target: normal, clientX: 1, clientY: 1, buttons: 0 });
  assert.equal(vm.runInContext('isSelecting', context), false);
  assert.equal(timers.size, 1);
  for (const callback of [...timers.values()]) await callback();
  assert.equal(context.requests.length, 1);
});

for (const kind of ['word', 'selection']) {
  for (const currentSecond of [true, false]) {
    test(`${kind} shared lookup permits fallback only with a current subscriber (${currentSecond})`, async () => {
      const { context } = await setup();
      vm.runInContext(`
        globalThis.deviceCalls = 0; globalThis.dictionaryCalls = 0;
        translateText = () => new Promise(resolve => { globalThis.finishPrimary = resolve; });
        onDeviceTranslate = async () => { deviceCalls += 1; return ${kind === 'selection' ? "'Korean'" : 'null'}; };
        getDictionaryMeaning = async () => { dictionaryCalls += 1; return { word: '한국어' }; };
      `, context);
      let firstCurrent = true;
      const lookup = kind === 'word' ? context.originalLookupWord : context.originalLookupSelection;
      const first = lookup('한국어', () => firstCurrent);
      firstCurrent = false;
      const second = lookup('한국어', () => currentSecond);
      context.finishPrimary(null);
      const [firstResult, secondResult] = await Promise.all([first, second]);
      assert.equal(firstResult.type, secondResult.type);
      assert.equal(secondResult.type, currentSecond ? (kind === 'word' ? 'dict' : 'selection') : 'error');
      assert.equal(context.deviceCalls, currentSecond ? 1 : 0);
      assert.equal(context.dictionaryCalls, currentSecond && kind === 'word' ? 1 : 0);
      assert.equal(vm.runInContext('pendingRequests.size', context), 0);
    });
  }
}

test('cache invalidation prevents shared in-flight work from starting fallback', async () => {
  const { context } = await setup();
  vm.runInContext(`
    globalThis.fallbackCalls = 0;
    translateText = () => new Promise(resolve => { globalThis.finishPrimary = resolve; });
    onDeviceTranslate = getDictionaryMeaning = async () => { fallbackCalls += 1; return null; };
  `, context);
  const first = context.originalLookupWord('한국어', () => true);
  const second = context.originalLookupWord('한국어', () => true);
  context.invalidateLookupCache();
  context.finishPrimary(null);
  await Promise.all([first, second]);
  assert.equal(context.fallbackCalls, 0);
});
