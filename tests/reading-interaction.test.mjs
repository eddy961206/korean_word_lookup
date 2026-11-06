import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const source = await readFile(new URL('../content.js', import.meta.url), 'utf8');
const element = (tagName = 'DIV', attributes = {}, parentNode = null) => ({
  nodeType: 1, tagName, parentNode,
  getAttribute: key => attributes[key] ?? null,
  setAttribute: (key, value) => { attributes[key] = value; },
  handlers: {}, addEventListener(name, callback) { this.handlers[name] = callback; },
  style: {}, classList: { toggle() {} }, appendChild() {}, removeChild() {}
});
const textNode = parentNode => ({ nodeType: 3, textContent: '한국어', parentNode });

// 실제 콘텐츠 스크립트를 실행하고 타이머/DOM만 제어하여 전송 전 검사를 검증한다.
async function setup({ duringStartup, siteState = { ok: true, supported: true, paused: false }, rejectSiteState = false } = {}) {
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
    window: { getSelection: () => selection, location: { protocol: 'https:', hostname: 'example.test' } }, self: {}, URLSearchParams,
    console: { error() {}, warn() {} },
    setTimeout: callback => { timers.set(++id, callback); return id; },
    clearTimeout: id => timers.delete(id),
    chrome: {
      storage: { sync: { get: (_keys, callback) => callback({ selectionTranslationEnabled: true }) }, onChanged: { addListener(callback) { listeners.storage = callback; } } },
      runtime: { sendMessage: async message => { messages.push(message); if (message.action === 'getSiteState') { if (rejectSiteState) throw new Error('unavailable'); return siteState; } if (message.action === 'readUsageState') await duringStartup?.(listeners); return {}; }, onMessage: { addListener(callback) { listeners.message = callback; } } },
      i18n: { getMessage: key => key }
    }
  });
  vm.runInContext(source.replace('initializeExtension().catch(error => {', 'globalThis.ready = initializeExtension().catch(error => {'), context);
  await context.ready;
  vm.runInContext(`globalThis.originalRenderLookupResult = renderLookupResult; globalThis.originalLookupWord = lookupWord; globalThis.originalLookupSelection = lookupSelection; globalThis.requests = []; lookupSelection = async text => { requests.push(text); return {type:'selection',translation:'Korean'}; }; lookupWord = async text => { requests.push(text); return {type:'google',translation:'Korean'}; }; renderSelectionLoading = renderSelectionResult = renderLoadingState = renderLookupResult = () => {};`, context);
  return { context, document, listeners, timers, normal, text, selection, messages, setSelection: value => { selection = value; } };
}

test('modifier hover requires Alt and never runs while typing in another editor', async () => {
  const { context, listeners, normal, document, timers } = await setup();
  listeners.storage({ triggerMode: { newValue: 'modifier' } }, 'sync');
  context.scheduleLookup({ target: normal, clientX: 1, clientY: 1, altKey: false });
  assert.equal(timers.size, 0);
  context.scheduleLookup({ target: normal, clientX: 1, clientY: 1, altKey: true });
  assert.equal(timers.size, 1);
  document.activeElement = element('INPUT');
  context.scheduleLookup({ target: normal, clientX: 1, clientY: 1, altKey: true });
  assert.equal(timers.size, 0);
});

test('paused site and changed target cancel queued requests and cache generation', async () => {
  const { context, listeners, normal, timers } = await setup();
  context.scheduleLookup({ target: normal, clientX: 1, clientY: 1 });
  context.chrome.runtime.sendMessage = async () => ({ paused: true });
  listeners.message({ action: 'siteStateChanged' }, {}, () => {});
  await new Promise(setImmediate);
  assert.equal(timers.size, 0);
  context.scheduleLookup({ target: normal, clientX: 1, clientY: 1 });
  assert.equal(timers.size, 0);
  listeners.storage({ targetLanguage: { newValue: 'vi' } }, 'sync');
  assert.equal(vm.runInContext('targetLanguage', context), 'vi');
  assert.equal(vm.runInContext('translationCache.size', context), 0);
});

test('panel owns pointer interactions, pins in place, and Escape closes it', async () => {
  const { context, listeners, normal, timers } = await setup();
  const panel = vm.runInContext('tooltipElements.tooltip', context);
  context.showTooltip();
  listeners.mousedown({ target: panel });
  assert.equal(panel.style.display, 'block');
  vm.runInContext('tooltipPinned = true', context);
  context.scheduleLookup({ target: normal, clientX: 1, clientY: 1 });
  assert.equal(timers.size, 0);
  listeners.keydown({ key: 'Escape' });
  assert.equal(panel.style.display, 'none');
  assert.equal(vm.runInContext('tooltipPinned', context), false);
});

test('real panel controls pin, retry edited source, and save only term', async () => {
  const { context, messages } = await setup();
  context.renderGoogleResult('한국어', 'Korean');
  const panel = vm.runInContext('tooltipElements', context);
  assert.equal(panel.tooltip.getAttribute('role'), 'dialog');
  panel.pin.handlers.click();
  assert.equal(vm.runInContext('tooltipPinned', context), true);
  await panel.save.handlers.click();
  const saved = messages.find(message => message.action === 'vocabularySave');
  assert.equal(saved.term, '한국어');
  assert.deepEqual(Object.keys(saved).sort(), ['action', 'term']);
  panel.retryInput.value = '한국';
  await panel.retryForm.handlers.submit({ preventDefault() {} });
  assert.deepEqual(Array.from(context.requests), ['한국']);
});

test('pinned result survives outside pointer, focus, scroll, document exit and collapsed selection until forced closed', async () => {
  const { context, listeners, normal, selection } = await setup();
  context.renderGoogleResult('한국어', 'Korean');
  const panel = vm.runInContext('tooltipElements', context);
  panel.pin.handlers.click();
  for (const name of ['mousedown', 'focusin', 'scroll', 'mouseleave', 'visibilitychange']) {
    listeners[name]({ target: normal });
    assert.equal(panel.tooltip.style.display, 'block', name);
    assert.equal(panel.body.textContent, 'Korean');
  }
  selection.isCollapsed = true;
  context.handleSelectionChange();
  assert.equal(panel.tooltip.style.display, 'block');
  listeners.storage({ targetLanguage: { newValue: 'vi' } }, 'sync');
  assert.equal(panel.tooltip.style.display, 'none');
});

test('fallback label and machine translation remain visible', async () => {
  const { context } = await setup();
  context.renderGoogleResult('한국어', 'Korean', '(Auto) ');
  const panel = vm.runInContext('tooltipElements', context);
  assert.match(panel.meta.textContent, /^\(Auto\) Google Translate/);
  assert.match(panel.meta.textContent, /tipMachineTranslation/);
});

test('Alt Enter intentionally focuses selected text result and Close restores focus without hover focus stealing', async () => {
  const { context, normal, document, selection } = await setup();
  let focused = 0;
  normal.isConnected = true;
  normal.focus = () => { document.activeElement = normal; focused++; };
  const panel = vm.runInContext('tooltipElements', context);
  panel.tooltip.focus = () => { document.activeElement = panel.tooltip; };
  context.renderGoogleResult('한국어', 'Korean');
  assert.equal(document.activeElement, normal);
  // Exercise real selection rendering while preserving the mock provider.
  vm.runInContext('renderSelectionResult = (text, result) => renderSelectionSuccess(text, result.translation)', context);
  let prevented = false;
  await context.lookupSelectionFromKeyboard({ target: normal, preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(document.activeElement, panel.tooltip);
  assert.equal(vm.runInContext('tooltipPinned', context), true);
  context.cancelPendingLookups(true);
  assert.equal(document.activeElement, normal);
  assert.equal(focused, 1);
  selection.focusNode = textNode(element('INPUT'));
  prevented = false;
  await context.lookupSelectionFromKeyboard({ target: normal, preventDefault() { prevented = true; } });
  assert.equal(prevented, false);
});

test('modifier keyboard selection survives Enter and Alt release before delayed provider response', async () => {
  const { context, listeners, normal, document } = await setup();
  listeners.storage({ triggerMode: { newValue: 'modifier' } }, 'sync');
  const panel = vm.runInContext('tooltipElements', context);
  panel.tooltip.focus = () => { document.activeElement = panel.tooltip; };
  vm.runInContext(`
    lookupSelection = () => new Promise(resolve => { globalThis.finishKeyboardLookup = resolve; });
    renderSelectionResult = (text, result) => renderSelectionSuccess(text, result.translation);
  `, context);
  const pending = context.lookupSelectionFromKeyboard({ target: normal, preventDefault() {} });
  const requestId = vm.runInContext('selectionRequestId', context);
  listeners.keyup({ key: 'Enter', target: normal });
  listeners.keyup({ key: 'Alt', target: normal });
  context.scheduleLookup({ target: normal, clientX: 1, clientY: 1, altKey: false });
  assert.equal(vm.runInContext('selectionRequestId', context), requestId);
  context.finishKeyboardLookup({ type: 'selection', translation: 'Delayed Korean' });
  await pending;
  assert.equal(panel.body.textContent, 'Delayed Korean');
  assert.equal(panel.tooltip.style.display, 'block');
  assert.equal(document.activeElement, panel.tooltip);
  assert.equal(vm.runInContext('tooltipPinned', context), true);
  assert.equal(vm.runInContext('keyboardSelectionRequestId', context), null);
});

for (const state of [undefined, {}, { error: 'unavailable' }, { ok: true, supported: false, paused: false }, { ok: true, supported: true, paused: true }]) {
  test(`site-state failure stays blocked during startup: ${JSON.stringify(state)}`, async () => {
    const { context, normal, timers } = await setup({ siteState: state === undefined ? null : state });
    context.scheduleLookup({ target: normal, clientX: 1, clientY: 1 });
    assert.equal(timers.size, 0);
    assert.equal(vm.runInContext('sitePaused', context), true);
  });
}
test('rejected startup site-state read stays blocked', async () => {
  const { context } = await setup({ rejectSiteState: true });
  assert.equal(vm.runInContext('sitePaused', context), true);
});

for (const rejects of [false, true]) {
  test(`site-state refresh blocks immediately, clears cached results and rejects stale render (${rejects ? 'reject' : 'error response'})`, async () => {
    const { context, listeners, normal } = await setup();
    vm.runInContext(`
      lookupWord = () => new Promise(resolve => { globalThis.finishOldLookup = resolve; });
      globalThis.renderCount = 0;
      renderLookupResult = () => { renderCount++; };
      setCacheEntry('google:en:한국어:true', { type: 'google', translation: 'Cached' }, 100000);
    `, context);
    const pendingLookup = context.handleHover({ target: normal, clientX: 1, clientY: 1 });
    let finishRefresh;
    context.chrome.runtime.sendMessage = () => new Promise((resolve, reject) => { finishRefresh = rejects ? reject : resolve; });
    listeners.message({ action: 'siteStateChanged' }, {}, () => {});
    assert.equal(vm.runInContext('sitePaused', context), true);
    assert.equal(vm.runInContext('translationCache.size', context), 0);
    assert.equal((await context.originalLookupWord('한국어')).type, 'error');
    assert.equal(await context.onDeviceTranslate('한국어'), null);
    context.originalRenderLookupResult('한국어', { type: 'google', translation: 'Late result' });
    assert.notEqual(vm.runInContext('tooltipElements.tooltip.style.display', context), 'block');
    context.finishOldLookup({ type: 'google', translation: 'Old response' });
    await pendingLookup;
    assert.equal(context.renderCount, 0);
    finishRefresh(rejects ? new Error('unavailable') : { error: 'unavailable' });
    await new Promise(setImmediate);
    assert.equal(vm.runInContext('sitePaused', context), true);
  });
}

test('selectionchange from tooltip retry input does not invalidate the in-flight hover', async () => {
  const { context, listeners, normal } = await setup();
  const panel = vm.runInContext('tooltipElements', context);
  // Fake DOM appendChild does not attach parents; model the real retry field ancestry.
  panel.retryInput.parentNode = panel.tooltip;
  vm.runInContext(`
    lookupWord = () => new Promise(resolve => { globalThis.finishHover = resolve; });
    renderLookupResult = originalRenderLookupResult;
  `, context);
  const pending = context.handleHover({ target: normal, clientX: 1, clientY: 1 });
  const requestId = vm.runInContext('activeRequestId', context);
  listeners.selectionchange({ target: panel.retryInput });
  assert.equal(vm.runInContext('activeRequestId', context), requestId);
  context.finishHover({ type: 'google', translation: 'Korean' });
  await pending;
  assert.equal(panel.body.textContent, 'Korean');
  assert.equal(panel.tooltip.style.display, 'block');
  // Genuine page selections still invalidate the previous hover request.
  listeners.selectionchange({ target: normal });
  assert.ok(vm.runInContext('activeRequestId', context) > requestId);
});

function installNativeTranslator(context, api) {
  context.self.Translator = api;
  context.Translator = api;
  context.AbortController = AbortController;
}
for (const phase of ['availability', 'create', 'translate']) {
  test(`native fallback ends within one deadline when ${phase} never settles`, async () => {
    const { context, timers } = await setup();
    let destroyed = 0;
    const never = () => new Promise(() => {});
    installNativeTranslator(context, {
      availability: phase === 'availability' ? never : async () => 'available',
      create: phase === 'create' ? never : async () => ({ translate: never, destroy() { destroyed++; } })
    });
    const pending = context.onDeviceTranslate('한국어');
    await new Promise(setImmediate);
    assert.equal(vm.runInContext('ON_DEVICE_TIMEOUT_MS', context), 2500);
    assert.equal(timers.size, 1);
    for (const callback of [...timers.values()]) callback();
    assert.equal(await pending, null);
    assert.equal(timers.size, 0);
    if (phase === 'translate') assert.equal(destroyed, 1);
  });
}
test('late native creation is destroyed and never reused after timeout', async () => {
  const { context, timers } = await setup();
  let finishCreate;
  let destroyed = 0;
  let translated = 0;
  installNativeTranslator(context, { availability: async () => 'available', create: () => new Promise(resolve => { finishCreate = resolve; }) });
  const pending = context.onDeviceTranslate('한국어');
  await new Promise(setImmediate);
  for (const callback of [...timers.values()]) callback();
  assert.equal(await pending, null);
  finishCreate({ translate() { translated++; }, destroy() { destroyed++; } });
  await new Promise(setImmediate);
  assert.equal(destroyed, 1);
  assert.equal(translated, 0);
});
test('native result after language change is discarded and instance destroyed', async () => {
  const { context, listeners } = await setup();
  let finishTranslate;
  let destroyed = 0;
  installNativeTranslator(context, { availability: async () => 'available', create: async () => ({ translate: () => new Promise(resolve => { finishTranslate = resolve; }), destroy() { destroyed++; } }) });
  const pending = context.onDeviceTranslate('한국어');
  await new Promise(setImmediate);
  listeners.storage({ targetLanguage: { newValue: 'vi' } }, 'sync');
  finishTranslate('stale English');
  assert.equal(await pending, null);
  assert.equal(destroyed, 1);
});
test('native fallback never initiates a model download', async () => {
  const { context } = await setup();
  let created = 0;
  installNativeTranslator(context, { availability: async () => 'downloadable', create() { created++; } });
  assert.equal(await context.onDeviceTranslate('한국어'), null);
  assert.equal(created, 0);
});
