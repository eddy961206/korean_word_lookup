import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
const source = fs.readFileSync(new URL('../vocabulary-store.js', import.meta.url), 'utf8');
function fixture({promiseOnly = false} = {}) {
  let data = {};
  let writes = 0;
  const storage = {
    get(key, cb) { const result = vm.runInContext(`JSON.parse(${JSON.stringify(JSON.stringify(data))})`, context); if (promiseOnly) return Promise.resolve(result); setTimeout(() => cb(result), 1); },
    set(value, cb) { data = structuredClone(value); writes++; if (promiseOnly) return Promise.resolve(); setTimeout(cb, 1); }
  };
  const context = vm.createContext({chrome:{storage:{local:storage},runtime:{}},crypto:webcrypto,TextEncoder});
  vm.runInContext(source,context);
  vm.runInContext('KWLVocabulary.init()',context);
  const send = (request) => vm.runInContext(`KWLVocabulary.handle(${JSON.stringify(request)})`,context);
  return {send, get data(){return structuredClone(data);}, get writes(){return writes;},context};
}
const save = (f, term) => f.send({action:'vocabularySave',term});
const list = (f) => f.send({action:'vocabularyList'});
const backup = (items) => JSON.stringify({format:'korean-word-lookup-notebook',version:1,items});
test('saves only explicit source terms and normalizes duplicates without overwriting notes', async () => {
  const f = fixture();
  const first = await save(f,'  한국어  ');
  assert.equal(first.ok,true);
  assert.equal(first.item.term,'한국어');
  assert.equal(first.item.meaning,'');
  await f.send({action:'vocabularyUpdate',id:first.item.id,fields:{term:'한국어',meaning:'My Korean',note:'Own words',context:'My example'}});
  const second = await save(f,'한국어');
  assert.equal(second.duplicate,true);
  assert.equal(second.item.meaning,'My Korean');
  assert.equal((await list(f)).items.length,1);
  await assert.rejects(save(f,''),/INVALID_DATA/);
  await assert.rejects(f.send({action:'vocabularySave',term:'단어',meaning:'provider output'}),/INVALID_DATA/);
  await assert.rejects(f.send({action:'vocabularySave',term:'단어',url:'https://example.com'}),/INVALID_DATA/);
});
test('serializes concurrent mutations and reads', async () => {
  const f = fixture();
  await Promise.all(Array.from({length:30},(_,index) => save(f,`단어 ${index}`)));
  assert.equal((await list(f)).items.length,30);
});
test('delete is recoverable using persisted undo and does not delete unrelated words', async () => {
  const f = fixture(); const {item} = await save(f,'사과'); await save(f,'배');
  const deleted = await f.send({action:'vocabularyDelete',id:item.id});
  assert.equal((await list(f)).items.length,1);
  vm.runInContext('KWLVocabulary.init()',f.context);
  await f.send({action:'vocabularyUndoDelete',id:deleted.undoId});
  assert.equal((await list(f)).items.length,2);
  await assert.rejects(f.send({action:'vocabularyUndoDelete',id:item.id}),/NOT_FOUND/);
});
test('backup import merges, preserves existing notes, skips duplicates, and is atomic', async () => {
  const f = fixture(); const g = fixture();
  await save(f,'사과'); await save(g,'사과'); const {item} = await save(g,'배');
  item.note = '<script>alert(1)</script>';
  const incoming = [(await list(g)).items.find((x) => x.term === '사과'), item];
  const result = await f.send({action:'vocabularyImport',backup:backup(incoming)});
  assert.equal(result.added,1); assert.equal(result.skipped,1);
  assert.equal((await list(f)).items.find((x) => x.term === '배').note,item.note);
  const before = f.writes;
  await assert.rejects(f.send({action:'vocabularyImport',backup:backup([item,{...item,id:'another',term:'새 단어',note:42}])}),/INVALID_DATA/);
  assert.equal(f.writes,before);
});
test('rejects unknown/prototype fields, oversized data, invalid timestamps and duplicate backup IDs', async () => {
  const f = fixture(); const {item} = await save(f,'한글');
  for (const invalid of [{...item,url:'https://example.com'}, {...item,createdAt:Infinity}, {...item,updatedAt:8640000000000001}, {...item,term:'x'.repeat(201)}]) {
    await assert.rejects(f.send({action:'vocabularyImport',backup:backup([invalid])}),/INVALID_DATA/);
  }
  await assert.rejects(f.send({action:'vocabularyImport',backup:backup([item,item])}),/INVALID_DATA/);
  await assert.rejects(f.send({action:'vocabularyImport',backup:' '.repeat(2*1024*1024+1)}),/IMPORT_TOO_LARGE/);
  await assert.rejects(f.send({action:'vocabularyImport',backup:backup([item]).replace('"version":1','"version":1,"__proto__":{}')}),/INVALID_DATA/);
});
test('enforces 2,000 entry limit without partial writes', async () => {
  const f = fixture();
  const entries = Array.from({length:2000},(_,i) => ({id:`word-${i}`,term:`단어 ${i}`,meaning:'',context:'',note:'',createdAt:1,updatedAt:1}));
  await f.send({action:'vocabularyImport',backup:backup(entries)});
  await assert.rejects(save(f,'넘침'),/NOTEBOOK_FULL/);
  assert.equal((await list(f)).items.length,2000);
});
test('supports Promise storage APIs and returns safe storage failures', async () => {
  const f = fixture({promiseOnly:true});
  await save(f,'안녕'); assert.equal((await list(f)).items.length,1);
  const before = f.data;
  f.context.chrome.storage.local.set = () => Promise.reject(new Error('private internals'));
  await assert.rejects(save(f,'실패'),/^Error: STORAGE_ERROR$/);
  const incoming = {...(await list(f)).items[0],id:'import-failure',term:'가져오기 실패'};
  await assert.rejects(f.send({action:'vocabularyImport',backup:backup([incoming])}),/^Error: STORAGE_ERROR$/);
  assert.deepEqual(f.data,before);
});
test('notebook uses local assets, safe text rendering, and spreadsheet formula protection', () => {
  const html = fs.readFileSync(new URL('../notebook.html',import.meta.url),'utf8');
  const js = fs.readFileSync(new URL('../notebook.js',import.meta.url),'utf8');
  assert.ok(html.includes('notebook.js')); assert.ok(html.includes('notebook.css'));
  assert.doesNotMatch(js,/innerHTML|insertAdjacentHTML|fetch\(|XMLHttpRequest/);
  assert.ok(js.includes('textContent')); assert.ok(js.includes("`'${normalized}`"));
  assert.ok(js.includes("beforeunload")); assert.ok(html.includes('aria-live="polite"'));
});

test('preview validates exact import and reports merge counts without any storage mutation', async () => {
  const f = fixture(); const g = fixture();
  await save(f,'기존'); await save(g,'기존'); await save(g,'새로운');
  const incoming = (await list(g)).items;
  const before = f.data; const writesBefore = f.writes;
  const preview = await f.send({action:'vocabularyPreviewImport',backup:backup(incoming)});
  assert.equal(preview.added,1); assert.equal(preview.skipped,1);
  assert.equal(f.writes,writesBefore); assert.deepEqual(f.data,before);
  const imported = await f.send({action:'vocabularyImport',backup:backup(incoming)});
  assert.equal(imported.added,preview.added); assert.equal(imported.skipped,preview.skipped);
});
test('invalid preview and over-capacity preview/import preserve existing data including notes', async () => {
  const f = fixture();
  const entries = Array.from({length:2000},(_,i) => ({id:`full-${i}`,term:`단어 ${i}`,meaning:'My own meaning',context:'',note:'Keep this',createdAt:1,updatedAt:1}));
  await f.send({action:'vocabularyImport',backup:backup(entries)});
  const before = f.data; const writesBefore = f.writes;
  const extra = {...entries[0],id:'overflow',term:'넘침'};
  for (const action of ['vocabularyPreviewImport','vocabularyImport']) {
    await assert.rejects(f.send({action,backup:backup([extra])}),/NOTEBOOK_FULL/);
    await assert.rejects(f.send({action,backup:backup([{...extra,url:'https://example.com'}])}),/INVALID_DATA/);
    assert.deepEqual(f.data,before); assert.equal(f.writes,writesBefore);
  }
});
test('notebook confirms the validated preview before sending the import mutation', () => {
  const js = fs.readFileSync(new URL('../notebook.js',import.meta.url),'utf8');
  const preview = js.indexOf("action:'vocabularyPreviewImport'");
  const confirm = js.indexOf('if (!window.confirm',preview);
  const mutation = js.indexOf("action:'vocabularyImport'",preview);
  assert.ok(preview > 0 && confirm > preview && mutation > confirm);
  assert.match(js.slice(confirm,mutation),/return;/);
});

test('TSV removes lone CR and all row/column separators before formula protection; CSV preserves quoted content', () => {
  const js = fs.readFileSync(new URL('../notebook.js',import.meta.url),'utf8');
  const start = js.indexOf('function cell(');
  const end = js.indexOf('\nfunction download(',start);
  const context = vm.createContext({});
  vm.runInContext(js.slice(start,end),context);
  const cell = (value, delimiter) => vm.runInContext(`cell(${JSON.stringify(value)}, ${JSON.stringify(delimiter)})`,context);
  assert.equal(cell('plain\r=1+1','\t'),'plain =1+1');
  assert.equal(cell('\r=1+1','\t'),"' =1+1");
  assert.equal(cell('\t\r\n@SUM(A1)','\t'),"'   @SUM(A1)");
  assert.equal(cell('line\rnext\nlast\tcolumn','\t'),'line next last column');
  const original = 'plain\r=1+1\ncomma, and "quote"\tend';
  const csv = cell(original, ',');
  assert.equal(csv, '"plain\r=1+1\ncomma, and ""quote""\tend"');
  assert.equal(csv.slice(1,-1).replace(/""/g,'"'),original);
  assert.equal(cell('=1+1',','),'"\'=1+1"');
});
