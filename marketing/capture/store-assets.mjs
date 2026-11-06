// Store artwork: actual extension UI, live Google results, self-authored notebook notes.
import { chromium } from 'playwright';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
const root = process.cwd(), out = path.join(root, 'store-assets');
await mkdir(out, { recursive: true });
const profile = await mkdtemp(path.join(os.tmpdir(), 'kwl-store-'));
const context = await chromium.launchPersistentContext(profile, {
  channel:'chromium', headless:true, locale:'en-US', viewport:{width:800,height:430},deviceScaleFactor:2,
  ignoreDefaultArgs:['--disable-extensions'],args:[`--disable-extensions-except=${root}`,`--load-extension=${root}`]
});
const evidence={sourceCommit:process.env.GITHUB_SHA,provider:'Live Google Translate; no response mocking',captures:[]};
try {
  const worker=context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
  const id=new URL(worker.url()).host;
  async function readyReading(page) {
    await page.bringToFront();
    await page.locator('.kr-tooltip').waitFor({state:'attached'});
    const cdp=await context.newCDPSession(page), worlds=[];
    cdp.on('Runtime.executionContextCreated',event=>worlds.push(event.context));
    await cdp.send('Runtime.enable');
    let ready=false;
    for (const world of worlds) {
      const identity=await cdp.send('Runtime.evaluate',{contextId:world.id,expression:"typeof chrome === 'object' ? chrome.runtime?.id : ''",returnByValue:true});
      if(identity.result.value!==id) continue;
      const state=await cdp.send('Runtime.evaluate',{contextId:world.id,expression:"new Promise(resolve=>{const start=Date.now();const timer=setInterval(()=>{if(isInitialized && !sitePaused){clearInterval(timer);resolve(true);}else if(Date.now()-start>10000){clearInterval(timer);resolve({isInitialized,sitePaused,isEnabled,hidden:document.hidden});}},50);})",awaitPromise:true,returnByValue:true});
      if(state.result.value!==true) throw new Error('Reading startup not ready: '+JSON.stringify(state.result.value));
      ready=true;
    }
    await cdp.detach();
    if(!ready) throw new Error('Extension content world missing');
  }
  await worker.evaluate(()=>chrome.storage.sync.set({selectedApi:'google',targetLanguage:'en',selectionTranslationEnabled:true,triggerMode:'hover'}));
  await context.route('http://127.0.0.1/reading',route=>route.fulfill({contentType:'text/html',body:`<!doctype html><meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;background:#fff;color:#193b37;font-family:'Noto Sans CJK KR',sans-serif;padding:35px 48px}nav{font:11px Arial;letter-spacing:2px;color:#607c73;border-bottom:1px solid #dfe8e2;padding-bottom:15px}h1{font-size:30px;margin:22px 0 18px}p{font-size:23px;line-height:1.9;margin:10px 0}#word{background:#fff0b3;border-radius:4px}::selection{background:#c2e5dc;color:#153b31}</style><nav>READING NOTES</nav><h1>나의 작은 일상</h1><p>오늘은 <span id="word">도서관</span>에 갑니다.</p><p id="sentence">좋은 책을 읽고 싶어요.</p>`}));
  const page=await context.newPage();await page.goto('http://127.0.0.1/reading');
  await readyReading(page);await page.locator('#word').hover();
  await page.waitForFunction(()=>/library/i.test(document.querySelector('.kr-tooltip__body')?.textContent||''));
  await page.locator('.kr-tooltip').getByRole('button',{name:'Pin',exact:true}).click();
  await page.mouse.move(760,30);await page.waitForTimeout(250);
  evidence.captures.push({kind:'hover',language:'en',text:await page.locator('.kr-tooltip').innerText()});
  const hover=await page.screenshot({path:path.join(out,'raw-hover.png')});
  const tooltip=await page.locator('.kr-tooltip').screenshot({path:path.join(out,'raw-hover-tooltip.png')});
  await page.locator('.kr-tooltip').getByRole('button',{name:'Close',exact:true}).click();
  await worker.evaluate(()=>chrome.storage.sync.set({targetLanguage:'vi'}));
  // Reload ensures the actual content script consumes the stored target language.
  await page.reload();await readyReading(page);
  await page.locator('#sentence').evaluate(el=>{const r=document.createRange();r.selectNodeContents(el);const s=window.getSelection();s.removeAllRanges();s.addRange(r);document.dispatchEvent(new KeyboardEvent('keyup',{key:'Shift'}));});
  await page.waitForFunction(()=>{const el=document.querySelector('.kr-tooltip');return el?.textContent.includes('좋은 책을 읽고 싶어요.')&&/sách/i.test(el.textContent)&&!el.classList.contains('kr-tooltip--loading');});
  await page.waitForTimeout(250);
  evidence.captures.push({kind:'selection',language:'vi',text:await page.locator('.kr-tooltip').innerText()});
  const selection=await page.screenshot({path:path.join(out,'raw-selection-vi.png')});
  const notebook=await context.newPage();await notebook.setViewportSize({width:1000,height:520});
  await notebook.goto(`chrome-extension://${id}/notebook.html`);
  await notebook.locator('#new-term').fill('도서관');await notebook.locator('#add-form button').click();
  await notebook.locator('.edit-form [name=meaning]').fill('A place to borrow books');
  await notebook.locator('.edit-form [name=note]').fill('Illustrative user note');
  await notebook.locator('.edit-form button[type=submit]').click();
  await notebook.locator('.edit-form').waitFor({state:'detached'});
  await notebook.locator('.entry').filter({hasText:'A place to borrow books'}).waitFor();
  await notebook.locator('.toolbar').evaluate(el=>el.scrollIntoView({block:'start'}));
  await notebook.evaluate(()=>window.scrollBy(0,-20));
  const notebookShot=await notebook.screenshot({path:path.join(out,'raw-notebook.png')});
  evidence.captures.push({kind:'notebook',authorship:'Self-authored illustrative meaning and note, typed through the UI. No provider output saved.',text:await notebook.locator('.entry').innerText()});
  const design=await context.newPage();const img=b=>`data:image/png;base64,${b.toString('base64')}`;
  async function frame(file,title,shot){
    await design.setViewportSize({width:1280,height:800});
    await design.setContent(`<!doctype html><meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;background:#eff5ed;color:#183d35;font-family:Arial,sans-serif}h1{font-size:46px;letter-spacing:-1.7px;margin:37px 72px 26px;line-height:1.15}.capture{margin:0 90px;background:white;border:1px solid #d0ded3;border-radius:19px;overflow:hidden;box-shadow:0 18px 44px #244a3320}.capture img{display:block;width:100%}.brand{position:absolute;bottom:20px;left:72px;font-size:14px;font-weight:700;color:#607c73}</style><h1>${title}</h1><div class="capture"><img src="${img(shot)}"></div><div class="brand">Korean Word Lookup</div>`);
    await design.screenshot({path:path.join(out,file),scale:'css'});
  }
  await frame('01-hover.png','Keep your place.',hover);
  await frame('02-selection-vi.png','한국어 → Tiếng Việt',selection);
  await frame('03-notebook.png','Make words your own.',notebookShot);
  await design.setViewportSize({width:440,height:280});
  await design.setContent(`<!doctype html><meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;background:#eff5ed;color:#183d35;font-family:Arial,sans-serif;padding:20px 25px}.brand{font-size:13px;font-weight:700}h1{font-size:30px;letter-spacing:-1px;line-height:1.05;margin:14px 0 15px}img{display:block;width:260px;max-height:132px;object-fit:contain;object-position:left top;border-radius:9px}</style><div class="brand">Korean Word Lookup</div><h1>Read Korean.<br>Keep going.</h1><img src="${img(tooltip)}">`);
  await design.screenshot({path:path.join(out,'04-small-promo.png'),scale:'css'});
  await design.setViewportSize({width:1400,height:560});
  await design.setContent(`<!doctype html><meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;background:#eff5ed;color:#183d35;font-family:Arial,sans-serif;overflow:hidden}.brand{position:absolute;left:64px;top:55px;font-size:21px;font-weight:700}h1{position:absolute;left:64px;top:163px;font-size:68px;letter-spacing:-2.8px;line-height:1.04;margin:0}.capture{position:absolute;left:660px;top:80px;width:675px;border:1px solid #d0ded3;border-radius:18px;overflow:hidden;box-shadow:0 22px 48px #244a3325}.capture img{display:block;width:100%}</style><div class="brand">Korean Word Lookup</div><h1>Read Korean.<br>Keep going.</h1><div class="capture"><img src="${img(hover)}"></div>`);
  await design.screenshot({path:path.join(out,'05-marquee.png'),scale:'css'});
  await writeFile(path.join(out,'capture-evidence.json'),JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence));
} catch(error) { console.error('CAPTURE FAILURE',String(error)); for(const tab of context.pages()) console.error('TAB',tab.url(),await tab.evaluate(()=>({hidden:document.hidden,panel:document.querySelector('.kr-tooltip')?.innerText})).catch(()=>null)); throw error; } finally {await context.close();await rm(profile,{recursive:true,force:true});}
