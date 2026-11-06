// Real extension DOM and live Google responses. No mocked provider results.
import { chromium } from 'playwright';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
const root = process.cwd();
const out = path.join(root, 'store-assets');
await mkdir(out, { recursive: true });
const profile = await mkdtemp(path.join(os.tmpdir(), 'kwl-store-'));
const context = await chromium.launchPersistentContext(profile, {
  channel: 'chromium', headless: true, locale: 'en-US', viewport: { width: 680, height: 340 }, deviceScaleFactor: 2,
  ignoreDefaultArgs: ['--disable-extensions'],
  args: [`--disable-extensions-except=${root}`, `--load-extension=${root}`]
});
const evidence = { sourceCommit: process.env.GITHUB_SHA, provider: 'Live Google Translate', captures: [] };
try {
  const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
  const id = new URL(worker.url()).host;
  await worker.evaluate(() => chrome.storage.sync.set({ selectedApi: 'google', selectionTranslationEnabled: true }));
  await context.route('http://127.0.0.1/reading', route => route.fulfill({ contentType: 'text/html', body: `<!doctype html><meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;background:#fff;color:#193b37;font-family:'Noto Sans CJK KR',sans-serif;padding:30px 42px}nav{font:11px Arial;letter-spacing:2px;color:#607c73;border-bottom:1px solid #dfe8e2;padding-bottom:15px}h1{font-size:28px;margin:18px 0 14px}p{font-size:20px;line-height:1.9;margin:8px 0}small{font:11px Arial;color:#80938b}#word{background:#fff0b3;border-radius:4px}::selection{background:#c2e5dc;color:#153b31}</style><nav>READING NOTES &nbsp; / &nbsp; A QUIET AFTERNOON</nav><h1>나의 작은 일상</h1><p>오늘은 <span id="word">도서관</span>에 갑니다.</p><p id="sentence">좋은 책을 읽고 싶어요.</p><small>Original reading example · Korean Word Lookup</small>` }));
  const page = await context.newPage();
  await page.goto('http://127.0.0.1/reading');
  await page.locator('.kr-tooltip').waitFor({state:'attached'});
  await page.locator('#word').hover();
  await page.waitForFunction(() => document.querySelector('.kr-tooltip__body')?.textContent.toLowerCase().includes('library'), { timeout: 30000 });
  await page.waitForTimeout(250);
  evidence.captures.push({kind:'hover',text:await page.locator('.kr-tooltip').innerText()});
  const hover = await page.screenshot({path:path.join(out,'raw-hover.png')});
  await page.locator('#sentence').evaluate(el => { const r=document.createRange();r.selectNodeContents(el);const s=window.getSelection();s.removeAllRanges();s.addRange(r);document.dispatchEvent(new KeyboardEvent('keyup',{key:'Shift'})); });
  await page.waitForFunction(() => { const el=document.querySelector('.kr-tooltip');return el?.textContent.includes('좋은 책을 읽고 싶어요.') && /book/i.test(el.textContent) && !el.classList.contains('kr-tooltip--loading'); }, {timeout:30000});
  await page.waitForTimeout(250);
  evidence.captures.push({kind:'selection',text:await page.locator('.kr-tooltip').innerText()});
  const selection = await page.screenshot({path:path.join(out,'raw-selection.png')});
  const popup = await context.newPage();
  await popup.setViewportSize({width:348,height:1100});
  await popup.goto(`chrome-extension://${id}/popup.html`);
  await popup.locator('#apiKeyStatus').filter({hasText:'No key'}).waitFor();
  const source = await popup.locator('.api-selection-container').screenshot({path:path.join(out,'raw-source.png')});
  const settings = await popup.locator('.tooltip-settings-container').screenshot({path:path.join(out,'raw-settings.png')});
  const key = await popup.locator('.api-key-container').screenshot({path:path.join(out,'raw-key.png')});
  await popup.screenshot({path:path.join(out,'raw-popup.png'),fullPage:true});
  evidence.captures.push({kind:'popup',keyStored:false,text:await popup.locator('#apiKeyStatus').innerText()});
  const design = await context.newPage();
  await design.setViewportSize({width:1280,height:800});
  const img=b=>`data:image/png;base64,${b.toString('base64')}`;
  const style=`*{box-sizing:border-box}body{margin:0;width:1280px;height:800px;background:#eff5ed;color:#183d35;font-family:Arial,sans-serif;overflow:hidden}.brand{font-size:17px;font-weight:700;letter-spacing:.4px}.top{padding:38px 68px 0}.label{color:#658274;float:right;font-size:14px;letter-spacing:1px}h1{font-size:51px;letter-spacing:-1.8px;line-height:1.08;margin:25px 0 13px}p{font-size:21px;line-height:1.4;color:#536e62;margin:0}.browser{margin:26px 130px 0;border:1px solid #d0ded3;border-radius:18px;overflow:hidden;box-shadow:0 18px 45px #244a3320;background:white}.bar{height:35px;background:#f6f8f5;border-bottom:1px solid #e0e8df;display:flex;align-items:center;padding:0 17px;gap:6px}.dot{width:8px;height:8px;border-radius:50%;background:#b6c7bd}.address{font-size:11px;margin-left:22px;color:#82968a}.browser img{display:block;width:100%}.foot{position:absolute;bottom:24px;left:68px;right:68px;font-size:13px;color:#708579;display:flex;justify-content:space-between}.cards{display:flex;gap:24px;margin:36px 68px 0}.card{width:365px;border:1px solid #d0ded3;border-radius:18px;background:#fff;padding:22px 16px;box-shadow:0 16px 32px #244a3310}.card img{width:100%;display:block}.card h2{font-size:22px;margin:0 0 17px}.card p{font-size:17px;margin-top:22px}.num{font-size:12px;letter-spacing:1px;color:#6d897b;margin-bottom:12px}`;
  async function frame(file,title,subtitle,body,step){
    await design.setContent(`<!doctype html><meta charset="utf-8"><style>${style}</style><div class="top"><div class="brand">Korean Word Lookup<span class="label">KOREAN → ENGLISH</span></div><h1>${title}</h1><p>${subtitle}</p></div>${body}<div class="foot"><span>Actual extension UI · Original reading example · Internet required</span><span>${step} / 03</span></div>`);
    await design.screenshot({path:path.join(out,file),scale:'css'});
  }
  const browser = b=>`<div class="browser"><div class="bar"><i class="dot"></i><i class="dot"></i><i class="dot"></i><span class="address">A quiet afternoon · Korean reading example</span></div><img src="${img(b)}"></div>`;
  await frame('01-hover.png','Meet a new word. Keep reading.','Hover over Korean text to see an English translation, right on the page.',browser(hover),'01');
  await frame('02-selection.png','Make sense of the whole sentence.','Turn on selection translate, then highlight a Korean phrase or sentence.',browser(selection),'02');
  await frame('03-controls.png','Your reading pace. Your settings.','Start with Google Translate. Add your own KRDICT key for Korean Dictionary.',`<div class="cards"><div class="card"><div class="num">01 · CHOOSE A SOURCE</div><h2>Start without an API key</h2><img src="${img(source)}"><p>Google Translate works without an API key.</p></div><div class="card"><div class="num">02 · MAKE IT COMFORTABLE</div><h2>Tune your reading flow</h2><img src="${img(settings)}"></div><div class="card"><div class="num">03 · ADD DICTIONARY ACCESS</div><h2>Bring your own key</h2><img src="${img(key)}"><p>KRDICT requires your own key. Translation sends text to your chosen provider.</p></div></div>`,'03');
  await writeFile(path.join(out,'capture-evidence.json'),JSON.stringify(evidence,null,2));
  console.log(JSON.stringify(evidence));
} finally { await context.close(); await rm(profile,{recursive:true,force:true}); }
