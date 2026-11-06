/* 사용자가 직접 저장한 단어와 메모만 보관합니다. 네트워크 요청은 없습니다. */
(function (root) {
  'use strict';
  const KEY = 'kwlVocabularyV1';
  const LIMIT = 2000;
  const MAX_BYTES = 2 * 1024 * 1024;
  let storage;
  let enqueue;
  const fail = (code) => { throw new Error(code); };
  function exact(value, keys) {
    if (!value || typeof value !== 'object' || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) fail('INVALID_DATA');
    if (Object.keys(value).some((key) => !keys.includes(key))) fail('INVALID_DATA');
  }
  function str(value, max, required = false) {
    if (typeof value !== 'string' || value.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(value)) fail('INVALID_DATA');
    const result = value.normalize('NFC').trim();
    if (required && !result) fail('INVALID_DATA');
    return result;
  }
  function fields(value) {
    exact(value, ['term', 'meaning', 'note', 'context']);
    return { term: str(value.term, 200, true), meaning: str(value.meaning ?? '', 1000), note: str(value.note ?? '', 2000), context: str(value.context ?? '', 1000) };
  }
  function entry(value) {
    exact(value, ['id', 'term', 'meaning', 'note', 'context', 'createdAt', 'updatedAt']);
    const id = str(value.id, 80, true);
    if (!/^[a-zA-Z0-9_-]+$/u.test(id)) fail('INVALID_DATA');
    for (const key of ['createdAt', 'updatedAt']) if (!Number.isSafeInteger(value[key]) || value[key] < 0 || value[key] > 8640000000000000) fail('INVALID_DATA');
    return { id, ...fields({term: value.term, meaning: value.meaning, note: value.note, context: value.context}), createdAt: value.createdAt, updatedAt: value.updatedAt };
  }
  function bytes(value) { return new TextEncoder().encode(JSON.stringify(value)).length; }
  function call(method, value) {
    return new Promise((resolve, reject) => {
      let settled = false;
      const done = (result) => {
        if (settled) return;
        settled = true;
        const error = root.chrome?.runtime?.lastError;
        if (error) reject(new Error('STORAGE_ERROR')); else resolve(result);
      };
      try {
        const promise = storage[method](value, done);
        if (promise?.then) promise.then(done, () => { if (!settled) { settled = true; reject(new Error('STORAGE_ERROR')); } });
      } catch { reject(new Error('STORAGE_ERROR')); }
    });
  }
  async function read() {
    const raw = (await call('get', KEY))?.[KEY];
    if (!raw) return { items: [], deleted: [] };
    exact(raw, ['items', 'deleted']);
    if (!Array.isArray(raw.items) || !Array.isArray(raw.deleted) || raw.items.length > LIMIT || raw.deleted.length > 20) fail('INVALID_DATA');
    return { items: raw.items.map(entry), deleted: raw.deleted.map(entry) };
  }
  function checkCapacity(state) {
    if (state.items.length > LIMIT || bytes(state) > MAX_BYTES - 1024) fail('NOTEBOOK_FULL');
  }
  async function write(state) {
    checkCapacity(state);
    await call('set', { [KEY]: state });
  }
  function init(options = {}) {
    storage = options.storage || root.chrome.storage.local;
    // 백그라운드의 공용 큐를 주입해 다른 저장 작업과도 순서를 보장합니다.
    let pending = Promise.resolve();
    enqueue = options.enqueueMutation || ((fn) => { const next = pending.then(fn); pending = next.catch(() => {}); return next; });
    return api;
  }
  async function execute(request) {
    const state = await read();
    switch (request.action) {
      case 'vocabularyList':
        exact(request, ['action']);
        return { ok: true, items: state.items, limit: LIMIT, undoId: state.deleted[0]?.id || null };
      case 'vocabularySave': {
        exact(request, ['action', 'term']);
        const term = str(request.term, 200, true);
        const existing = state.items.find((item) => item.term === term);
        if (existing) return { ok: true, item: existing, duplicate: true };
        const now = Date.now();
        const item = { id: root.crypto.randomUUID(), term, meaning: '', note: '', context: '', createdAt: now, updatedAt: now };
        state.items.unshift(item);
        await write(state);
        return { ok: true, item, duplicate: false };
      }
      case 'vocabularyUpdate': {
        exact(request, ['action', 'id', 'fields']);
        const id = str(request.id, 80, true);
        const index = state.items.findIndex((item) => item.id === id);
        if (index < 0) fail('NOT_FOUND');
        const values = fields(request.fields);
        if (state.items.some((item) => item.id !== id && item.term === values.term)) fail('DUPLICATE_TERM');
        state.items[index] = { ...state.items[index], ...values, updatedAt: Date.now() };
        await write(state);
        return { ok: true, item: state.items[index] };
      }
      case 'vocabularyDelete': {
        exact(request, ['action', 'id']);
        const id = str(request.id, 80, true);
        const index = state.items.findIndex((item) => item.id === id);
        if (index < 0) fail('NOT_FOUND');
        const [item] = state.items.splice(index, 1);
        state.deleted = [item, ...state.deleted.filter((old) => old.id !== id)].slice(0, 20);
        await write(state);
        return { ok: true, undoId: id };
      }
      case 'vocabularyUndoDelete': {
        exact(request, ['action', 'id']);
        const id = str(request.id, 80, true);
        const index = state.deleted.findIndex((item) => item.id === id);
        if (index < 0) fail('NOT_FOUND');
        const [item] = state.deleted.splice(index, 1);
        if (state.items.some((old) => old.id === id || old.term === item.term)) fail('DUPLICATE_TERM');
        state.items.unshift(item);
        await write(state);
        return { ok: true, item };
      }
      case 'vocabularyPreviewImport':
      case 'vocabularyImport': {
        exact(request, ['action', 'backup']);
        if (typeof request.backup !== 'string' || new TextEncoder().encode(request.backup).length > MAX_BYTES) fail('IMPORT_TOO_LARGE');
        let backup;
        try { backup = JSON.parse(request.backup); } catch { fail('INVALID_DATA'); }
        exact(backup, ['format', 'version', 'items']);
        if (backup.format !== 'korean-word-lookup-notebook' || backup.version !== 1 || !Array.isArray(backup.items) || backup.items.length > LIMIT) fail('INVALID_DATA');
        const incoming = backup.items.map(entry);
        const ids = new Set();
        const terms = new Set();
        for (const item of incoming) {
          if (ids.has(item.id) || terms.has(item.term)) fail('INVALID_DATA');
          ids.add(item.id); terms.add(item.term);
        }
        const additions = incoming.filter((item) => !state.items.some((old) => old.id === item.id || old.term === item.term));
        state.items.unshift(...additions);
        // 미리보기와 실제 가져오기는 동일한 검증을 거치지만 미리보기는 쓰지 않습니다.
        checkCapacity(state);
        if (request.action === 'vocabularyImport') await write(state);
        return { ok: true, added: additions.length, skipped: incoming.length - additions.length };
      }
      default: fail('UNKNOWN_ACTION');
    }
  }
  const api = { init, handle(request) {
    if (!storage || !enqueue) fail('NOT_INITIALIZED');
    // 읽기도 같은 큐를 사용하므로 진행 중인 저장 이후의 스냅샷을 반환합니다.
    return enqueue(() => execute(request));
  } };
  root.KWLVocabulary = api;
})(globalThis);
