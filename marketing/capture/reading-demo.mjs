// Record the unmodified 2.6.0 runtime, with live provider results and real mouse gestures.
import { chromium } from 'playwright';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
const root=process.cwd(), out=path.join(root,'reading-demo');
const release='e1a08503585d449cd0c16e2a0aad6e37863efecd';
const runtime=['manifest.json','background.js','content.js','tooltip.css','popup.html','popup.js','notebook.html','notebook.js','notebook.css','vocabulary-store.js','_locales'];
execFileSync('git',['diff','--exit-code',release,'--',...runtime]);
if(JSON.parse(await readFile('manifest.json','utf8')).version!=='2.6.0') throw Error('Wrong release');
await mkdir(out,{recursive:true});
const profile=await mkdtemp(path.join(os.tmpdir(),'kwl-demo-'));
const context=await chromium.launchPersistentContext(profile,{
 channel:'chromium',headless:true,locale:'en-US',viewport:{width:960,height:600},deviceScaleFactor:1,
 recordVideo:{dir:out,size:{width:960,height:600}},
 ignoreDefaultArgs:['--disable-extensions'],args:[`--disable-extensions-except=${root}`,`--load-extension=${root}`]
});
const evidence={releaseCommit:release,captureCommit:process.env.GITHUB_SHA,version:'2.6.0',capturedAt:new Date().toISOString(),provider:'Live Google Translate, no mocked provider responses',setup:'Selection translation enabled before recording (off by default). English throughout.',presentation:'Self-authored reading page. A pointer overlay follows actual mouse events; extension UI and output are unmodified. No lookup-speed editing.',events:[],requests:[]};
let page,video;
try{
 const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');
 const id=new URL(worker.url()).host;
 await worker.evaluate(()=>chrome.storage.sync.set({selectedApi:'google',targetLanguage:'en',selectionTranslationEnabled:true,triggerMode:'hover',hoverDelayMs:500}));
 context.on('request',request=>{const u=new URL(request.url());if(u.hostname==='translate.googleapis.com')evidence.requests.push({at:new Date().toISOString(),text:u.searchParams.get('q'),target:u.searchParams.get('tl')});});
 await context.route('http://127.0.0.1/reading-demo',route=>route.fulfill({contentType:'text/html',body:`<!doctype html><html lang="ko"><meta charset="utf-8"><title>Korean reading demonstration</title><style>*{box-sizing:border-box}body{margin:0;background:#f1f5ed;color:#183b33;font-family:'Noto Sans CJK KR',sans-serif;padding:42px 62px}.brand{font:600 13px Arial,sans-serif;color:#637a70;letter-spacing:.7px}article{margin-top:22px;padding:28px 34px 100px;background:white;border:1px solid #dfe7dc;border-radius:16px;min-height:430px;box-shadow:0 15px 40px #244a3310}h1{font-size:30px;font-weight:600;margin:0 0 26px}p{font-size:29px;line-height:1.85;margin:12px 0}::selection{background:#bae0d3;color:#15392f}#pointer{position:fixed;left:0;top:0;z-index:2147483647;pointer-events:none;width:23px;height:29px;filter:drop-shadow(0 2px 2px #0005)}#pointer.down{filter:drop-shadow(0 0 5px #1aab8b)}</style><div class="brand">Korean Word Lookup</div><article><h1>나의 작은 일상</h1><p id="first">도서관 안은 조용해요.</p><p id="sentence">좋은 책을 읽고 싶어요.</p></article><svg id="pointer" viewBox="0 0 24 30"><path d="M2 1 L2 23 L8 18 L13 28 L18 25 L13 16 L22 15 Z" fill="white" stroke="#183b33" stroke-width="1.8"/></svg><script>const p=document.getElementById('pointer');document.addEventListener('mousemove',e=>{p.style.transform='translate('+e.clientX+'px,'+e.clientY+'px)'});document.addEventListener('mousedown',()=>p.classList.add('down'));document.addEventListener('mouseup',()=>p.classList.remove('down'));</script></html>`}));
 page=await context.newPage();video=page.video();await page.goto('http://127.0.0.1/reading-demo');await page.bringToFront();await page.locator('.kr-tooltip').waitFor({state:'attached'});await page.evaluate(()=>document.fonts.ready);
 const cdp=await context.newCDPSession(page),worlds=[];cdp.on('Runtime.executionContextCreated',e=>worlds.push(e.context));await cdp.send('Runtime.enable');let ready=false;
 for(const world of worlds){const ident=await cdp.send('Runtime.evaluate',{contextId:world.id,expression:"typeof chrome==='object'?chrome.runtime?.id:''",returnByValue:true});if(ident.result.value!==id)continue;const result=await cdp.send('Runtime.evaluate',{contextId:world.id,expression:"new Promise(resolve=>{const start=Date.now();const t=setInterval(()=>{if(isInitialized&&!sitePaused){clearInterval(t);resolve(true)}else if(Date.now()-start>10000){clearInterval(t);resolve(false)}},50)})",awaitPromise:true,returnByValue:true});ready=result.result.value===true;}await cdp.detach();if(!ready)throw Error('Content script not ready');await page.locator('#pointer').evaluate(el=>document.body.append(el));
 const start=Date.now();const mark=(name,data={})=>evidence.events.push({name,elapsedMs:Date.now()-start,...data});let mouse={x:825,y:450};await page.mouse.move(mouse.x,mouse.y);
 async function move(x,y,ms=800){const from={...mouse},steps=32;for(let i=1;i<=steps;i++){const f=i/steps;await page.mouse.move(from.x+(x-from.x)*f,from.y+(y-from.y)*f);await page.waitForTimeout(ms/steps);}mouse={x,y};}
 async function click(locator){const b=await locator.boundingBox();if(!b)throw Error('Missing control');await move(b.x+b.width/2,b.y+b.height/2,450);await page.mouse.click(mouse.x,mouse.y);}
 mark('reading-start');await page.waitForTimeout(2400);
 const word=await page.locator('#first').evaluate(el=>{const r=document.createRange();r.setStart(el.firstChild,0);r.setEnd(el.firstChild,3);const b=r.getBoundingClientRect();return{x:b.x+b.width/2,y:b.y+b.height/2}});
 await move(word.x,word.y);mark('hover-start');
 await page.waitForFunction(()=>/library/i.test(document.querySelector('.kr-tooltip__body')?.textContent||''),{},{timeout:15000});if(!(await page.locator('.kr-tooltip__meta').innerText()).includes('Google Translate'))throw Error('Expected live Google word result');mark('hover-result',{text:await page.locator('.kr-tooltip').innerText()});
 await page.screenshot({path:path.join(out,'hover-result.png')});await page.waitForTimeout(4200);
 await click(page.locator('.kr-tooltip').getByRole('button',{name:'Close',exact:true}));await page.waitForTimeout(700);
 const sentence=await page.locator('#sentence').evaluate(el=>{const r=document.createRange();r.selectNodeContents(el);const b=r.getBoundingClientRect();return{x:b.x,y:b.y+b.height/2,width:b.width}});
 // Travel through the blank left margin so no unrelated word is hovered.
 await move(78,sentence.y,400);await move(sentence.x+1,sentence.y,180);await page.mouse.down();await move(sentence.x+sentence.width-1,sentence.y,1700);await page.mouse.up();mark('selection-complete',{selected:await page.evaluate(()=>window.getSelection()?.toString())});
 await page.waitForFunction(()=>{const t=document.querySelector('.kr-tooltip');return t?.textContent.includes('좋은 책을 읽고 싶어요.')&&/book/i.test(t.textContent)&&!t.classList.contains('kr-tooltip--loading')},{},{timeout:15000});if(!(await page.locator('.kr-tooltip__meta').innerText()).includes('Google Translate'))throw Error('Expected live Google sentence result');mark('sentence-result',{text:await page.locator('.kr-tooltip').innerText()});await page.screenshot({path:path.join(out,'sentence-result.png')});await page.waitForTimeout(5200);
 await click(page.locator('.kr-tooltip').getByRole('button',{name:'Close',exact:true}));await move(825,450,650);await page.mouse.click(825,450);await page.waitForTimeout(2100);mark('reading-end');
 for(const text of ['도서관','좋은 책을 읽고 싶어요.'])if(!evidence.requests.some(r=>r.text===text&&r.target==='en'))throw Error('Missing live Google request: '+text);
 if(evidence.requests.some(r=>r.target!=='en'||!['도서관','좋은 책을 읽고 싶어요.'].includes(r.text)))throw Error('Unexpected lookup: '+JSON.stringify(evidence.requests));
 await page.close();await video.saveAs(path.join(out,'reading-demo.webm'));evidence.actionTimelineMs=evidence.events.at(-1).elapsedMs;
 await writeFile(path.join(out,'evidence.json'),JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence));
}finally{await context.close();await rm(profile,{recursive:true,force:true});}
