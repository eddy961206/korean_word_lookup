import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const read = relativePath => readFile(new URL(`../${relativePath}`, import.meta.url), 'utf8');

// 실제 페이지 스크립트를 실행하되 브라우저 저장소와 탭 열기는 외부 효과 없이 관찰한다.
async function loadPage(name, locale = 'en', platform = 'Win32') {
  const [html, source, messages] = await Promise.all([
    read(`${name}.html`), read(`${name}.js`),
    read(`_locales/${locale}/messages.json`).then(JSON.parse)
  ]);
  const nodes = [...html.matchAll(/<[a-z][^>]*>/giu)].map(([tag]) => {
    const attributes = Object.fromEntries(
      [...tag.matchAll(/([\w-]+)="([^"]*)"/gu)].map(([, key, value]) => [key, value])
    );
    const handlers = new Map();
    const classes = new Set((attributes.class || '').split(' '));
    return {
      attributes, handlers, style: {}, textContent: '', value: attributes.value || '',
      getAttribute: key => attributes[key],
      setAttribute: (key, value) => { attributes[key] = value; },
      classList: { add: value => classes.add(value), contains: value => classes.has(value) },
      addEventListener: (event, handler) => handlers.set(event, handler),
      appendChild() {},
      fire(event, detail = {}) { handlers.get(event)?.({ preventDefault() {}, ...detail }); }
    };
  });
  const findAll = selector => nodes.filter(node => selector.startsWith('.')
    ? (node.attributes.class || '').split(' ').includes(selector.slice(1))
    : Object.hasOwn(node.attributes, selector.slice(1, -1)));
  let ready;
  const document = {
    documentElement: {},
    addEventListener: (_event, handler) => { ready = handler; },
    querySelectorAll: findAll,
    querySelector: selector => findAll(selector)[0],
    getElementById: id => nodes.find(node => node.attributes.id === id),
    getElementsByName: name => nodes.filter(node => node.attributes.name === name),
    createElement: () => ({ style: {} })
  };
  const events = [];
  const writes = [];
  const tabs = [];
  const chrome = {
    i18n: {
      getUILanguage: () => locale,
      getMessage: key => messages[key]?.message || ''
    },
    runtime: {
      getURL: path => `chrome-extension://test-extension/${path}`,
      getManifest: () => ({ version: '2.5.1' }),
      sendMessage: (message, callback) => { events.push(message); callback?.(); }
    },
    tabs: { create: value => tabs.push(value) },
    storage: {
      sync: {
        get: (_keys, callback) => callback({ translationEnabled: false }),
        set: (value, callback) => { writes.push(value); callback?.(); }
      },
      local: {
        get: (_keys, callback) => callback({ reviewPromptDismissed: true }),
        set: (value, callback) => { writes.push(value); callback?.(); }
      },
      onChanged: { addListener() {} }
    }
  };
  vm.runInNewContext(source, { document, chrome, navigator: { language: locale, platform }, window: {} });
  ready();
  return { document, events, writes, tabs, messages, nodes };
}

test('welcome demo is illustrative and never counts as a real lookup or onboarding success', async () => {
  const { document, events, writes } = await loadPage('welcome');
  const demo = document.getElementById('demoWord');
  for (const event of ['mouseenter', 'focus', 'click']) demo.fire(event);
  demo.fire('keydown', { key: 'Enter' });
  assert.equal(document.getElementById('demoTooltip').classList.contains('visible'), true);
  assert.equal(demo.getAttribute('aria-expanded'), 'true');
  assert.deepEqual(events.map(event => event.eventName), ['welcome_view']);
  assert.deepEqual(writes, []);
});

test('welcome opens the real Korean test page without recording a successful translation', async () => {
  const { document, events, writes, tabs } = await loadPage('welcome');
  document.getElementById('openTestPage').fire('click');
  assert.equal(tabs.length, 1);
  assert.equal(decodeURI(tabs[0].url), 'https://ko.wikipedia.org/wiki/한국어');
  assert.deepEqual(events.map(event => event.eventName), ['welcome_view', 'onboarding_start']);
  assert.deepEqual(writes, []);
});

test('popup guide stays available with translation disabled and opens the bundled welcome page', async () => {
  const { document, events, writes, tabs } = await loadPage('popup');
  const eventCount = events.length;
  document.getElementById('openWelcomeGuide').fire('click');
  assert.equal(tabs[0].url, 'chrome-extension://test-extension/welcome.html');
  assert.equal(events.length, eventCount);
  assert.deepEqual(writes, []);
});

test('welcome and popup localize every marked label and placeholder in EN, KO and VI', async () => {
  for (const locale of ['en', 'ko', 'vi']) {
    for (const page of ['welcome', 'popup']) {
      const { document, nodes, messages } = await loadPage(page, locale);
      assert.equal(document.documentElement.lang, locale);
      for (const node of nodes) {
        for (const attribute of ['data-i18n', 'data-i18n-placeholder']) {
          const key = node.attributes[attribute];
          if (!key) continue;
          assert.ok(messages[key]?.message, `${page}/${locale} is missing ${key}`);
          if (key === 'statusHover') continue; // 저장된 비활성 상태가 초기 문구를 바꾼다.
          const actual = attribute === 'data-i18n' ? node.textContent : node.placeholder;
          assert.equal(actual, messages[key].message, `${page}/${locale}/${key}`);
        }
      }
    }
  }
});

test('welcome shows the platform-specific shortcuts on Mac', async () => {
  const { document } = await loadPage('welcome', 'ko', 'MacIntel');
  assert.deepEqual(document.querySelectorAll('[data-shortcut]').map(node => node.textContent), [
    '⌥⇧T', '⌥⇧G', '⌥⇧K', '⌥⇧S'
  ]);
});
