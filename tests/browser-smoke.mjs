// 선택적 실제 Chromium 검증. npm run check의 VM 테스트와 별도이며 Playwright가 필요하다.
// 공급자 응답은 명시적으로 가짜 응답을 주입한다. 실제 공급자 상태/정확성 검증은 아니다.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const profile = await mkdtemp(path.join(os.tmpdir(), 'korean-lookup-smoke-'));
const context = await chromium.launchPersistentContext(profile, {
  executablePath: process.env.CHROMIUM_PATH || undefined,
  channel: process.env.CHROMIUM_PATH ? undefined : 'chromium',
  headless: true,
  ignoreDefaultArgs: ['--disable-extensions'],
  args: [`--disable-extensions-except=${root}`, `--load-extension=${root}`]
});
try {
  const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
  const id = new URL(worker.url()).host;
  await worker.evaluate(() => {
    globalThis.testRequests = [];
    globalThis.realFetch = globalThis.fetch;
    globalThis.fetch = async (url, options) => {
      testRequests.push({ url: String(url), credentials: options.credentials, referrerPolicy: options.referrerPolicy });
      if (String(url).startsWith('https://translate.googleapis.com/')) {
        return new Response('[[["library","도서관"]]]');
      }
      return new Response('<channel><item><word>도서관</word><pos>명사</pos><sense><definition>책을 읽는 곳</definition><translation><trans_word>library</trans_word><trans_dfn>A place for books.</trans_dfn></translation></sense></item></channel>');
    };
  });
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${id}/popup.html`);
  await popup.locator('#apiKeyStatus').filter({ hasText: /No key|저장된 키|Chưa lưu/ }).waitFor();
  await popup.locator('#krdictApiKey').fill('fake-smoke-key');
  await popup.locator('#saveApiKey').click();
  await popup.waitForFunction(() => document.getElementById('krdictApiKey').value === '');
  assert.equal(await worker.evaluate(async () => (await chrome.storage.local.get('krdictApiKey')).krdictApiKey), 'fake-smoke-key');
  assert.equal(await worker.evaluate(async () => (await chrome.storage.sync.get('krdictApiKey')).krdictApiKey), undefined);

  // CSP가 엄격한 일반 페이지에서도 콘텐츠가 아닌 서비스 워커에서 요청해야 한다.
  await context.route('http://127.0.0.1/reading', route => route.fulfill({
    contentType: 'text/html',
    headers: { 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'" },
    body: '<!doctype html><meta charset="utf-8"><style>body{font:32px sans-serif;padding:50px}div,p{margin:24px}</style><p><span id="word">도서관</span></p><div id="editable" contenteditable="plaintext-only">비밀문장</div><input id="password" type="password" value="비밀번호"><p id="sentence">오늘은 도서관에서 한국어를 공부합니다.</p>'
  }));
  const page = await context.newPage();
  await page.goto('http://127.0.0.1/reading');
  await page.locator('.kr-tooltip').waitFor({ state: 'attached' });
  // 실제 콘텐츠 스크립트 격리 컨텍스트에서도 로컬 키 접근이 차단되어야 한다.
  const cdp = await context.newCDPSession(page);
  const executionContexts = [];
  cdp.on('Runtime.executionContextCreated', event => executionContexts.push(event.context));
  await cdp.send('Runtime.enable');
  let privateStorageChecked = false;
  for (const execution of executionContexts) {
    const identity = await cdp.send('Runtime.evaluate', {
      contextId: execution.id, expression: "typeof chrome === 'object' ? chrome.runtime?.id : ''", returnByValue: true
    });
    if (identity.result.value !== id) continue;
    const access = await cdp.send('Runtime.evaluate', {
      contextId: execution.id,
      expression: "(async () => { try { await chrome.storage.local.get('krdictApiKey'); return false; } catch { return true; } })()",
      awaitPromise: true, returnByValue: true
    });
    assert.equal(access.result.value, true, 'content script must not read local key storage');
    privateStorageChecked = true;
  }
  assert.equal(privateStorageChecked, true, 'extension content execution context was inspected');
  await cdp.detach();
  await page.locator('#word').hover();
  await page.locator('.kr-tooltip').filter({ hasText: 'library' }).waitFor({ state: 'visible' });
  const count = await worker.evaluate(() => testRequests.length);
  assert.equal(count, 1);
  await page.locator('#editable').hover();
  await page.waitForTimeout(350); // 실제 hover debounce가 지나도 요청이 없어야 한다.
  await page.locator('#password').hover();
  await page.waitForTimeout(350);
  assert.equal(await worker.evaluate(() => testRequests.length), count);

  // 실제 선택 이벤트와 서비스 워커 메시지 흐름을 확인한다.
  await worker.evaluate(() => chrome.storage.sync.set({ selectionTranslationEnabled: true }));
  await page.locator('#sentence').evaluate(element => {
    const range = document.createRange();
    range.selectNodeContents(element);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    document.dispatchEvent(new KeyboardEvent('keyup', { key: 'Shift' }));
  });
  await page.locator('.kr-tooltip').filter({ hasText: 'library' }).waitFor({ state: 'visible' });
  assert.equal(await worker.evaluate(() => testRequests.length), count + 1);
  await popup.locator('#clearApiKey').click();
  await popup.locator('#apiKeyStatus').filter({ hasText: /No key|저장된 키|Chưa lưu/ }).waitFor();
  assert.equal(await worker.evaluate(async () => (await chrome.storage.local.get('krdictApiKey')).krdictApiKey), '');
  const requests = await worker.evaluate(() => testRequests);
  assert.ok(requests.every(request => request.credentials === 'omit' && request.referrerPolicy === 'no-referrer'));
  assert.ok(requests.every(request => !request.url.includes('google-analytics')));
  // 비밀값 없이 공개 예문으로만 실제 Google 경로를 확인한다. 외부 서비스 상태는 별도 보고한다.
  const liveGoogle = await worker.evaluate(async () => {
    globalThis.fetch = globalThis.realFetch;
    return translateTextRequest('도서관');
  });
  console.log('LIVE_GOOGLE_PROBE:', liveGoogle.translation ? JSON.stringify(liveGoogle.translation) : 'UNAVAILABLE (not a passed provider check)');
  console.log('PASS: real Chromium popup save/clear, local-only key, normal hover, editable/password skip, selection, worker transport. Provider responses mocked.');
} finally {
  await context.close();
  await rm(profile, { recursive: true, force: true });
}
