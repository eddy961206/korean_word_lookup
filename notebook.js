/* 개인 메모는 안전한 DOM API로만 표시하고 사용자의 저장 버튼으로만 변경합니다. */
'use strict';
const copy = {
  en: {
    importPreview:'Import preview',confirmImport:'Import these words? Existing entries will stay unchanged.',local:'Stored on this browser',eyebrow:'A little Korean, every day',title:'Your vocabulary notebook',subtitle:'Keep the words you choose. Make their meaning your own.',privacy:'Only words you save and notes you write are stored here. No page addresses or browsing history. This notebook is local to this browser profile, is not encrypted, and is removed if you uninstall the extension. Export a backup to keep a copy.',searchLabel:'Search your words',backup:'Back up JSON',import:'Import JSON',exportHint:'Exports include all saved words and your notes, even while searching. Keep exported files private. Import merges new words and keeps existing entries unchanged.',addLabel:'Add a word',add:'Save word',words:'Saved words',deleted:'Word deleted.',undo:'Undo',footer:'Dictionary results are for reading. This notebook saves source words and your own writing only.',term:'Korean word',meaning:'My meaning',note:'My note',context:'My example / context',edit:'Edit',remove:'Delete',save:'Save changes',cancel:'Cancel',hint:'Add your own meaning or a note.',emptyTitle:'Your next word starts here',emptyCopy:'Save a Korean word from a lookup, or add one above. Then write a meaning or example in your own words.',noMatch:'No matching words',noMatchCopy:'Try a different word, meaning, or note.',saved:'Saved.',duplicate:'This word is already in your notebook.',restored:'Word restored.',imported:'Import complete',added:'added',skipped:'already saved',error:'Could not complete this action. Try again.',invalid:'This file or entry is not a valid notebook backup. No changes were made.',full:'Notebook limit reached (2,000 words or 2 MB). Export a backup before deleting entries.',tooLarge:'Choose a JSON backup smaller than 2 MB.',notFound:'This entry has changed in another tab. Reload the notebook and try again.',duplicateTerm:'This word already exists. Choose a different word.',loading:'Loading your notebook…',downloaded:'Export prepared. Check your browser downloads.',count:'words',shown:'shown',limit:'limit',unsaved:'You have unsaved changes. Leave without saving?'
  },
  ko: {
    importPreview:'가져오기 미리보기',confirmImport:'이 단어를 가져올까요? 기존 항목은 그대로 유지합니다.',local:'이 브라우저에 저장',eyebrow:'매일 조금씩, 한국어',title:'나의 단어장',subtitle:'내가 고른 단어에 나만의 의미를 더하세요.',privacy:'직접 저장한 단어와 작성한 메모만 보관합니다. 페이지 주소나 방문 기록은 저장하지 않습니다. 이 브라우저 프로필에만 저장되며 암호화되지 않습니다. 확장 프로그램을 삭제하면 단어장도 사라지므로 백업을 내보내세요.',searchLabel:'단어와 메모 검색',backup:'JSON 백업',import:'JSON 가져오기',exportHint:'내보내기에는 검색 결과와 관계없이 모든 단어와 메모가 포함됩니다. 파일을 안전하게 보관하세요. 가져오기는 새 단어만 추가하며 기존 내용을 바꾸지 않습니다.',addLabel:'단어 추가',add:'단어 저장',words:'저장한 단어',deleted:'단어를 삭제했습니다.',undo:'실행 취소',footer:'사전 검색 결과는 읽기용입니다. 단어장에는 원문 단어와 직접 작성한 내용만 저장합니다.',term:'한국어 단어',meaning:'내가 쓴 뜻',note:'나의 메모',context:'직접 쓴 예문 / 맥락',edit:'수정',remove:'삭제',save:'변경 사항 저장',cancel:'취소',hint:'나만의 뜻이나 메모를 적어 보세요.',emptyTitle:'첫 단어를 모아 보세요',emptyCopy:'검색 결과에서 단어를 저장하거나 위에서 직접 추가하세요. 뜻과 예문은 내 말로 적을 수 있어요.',noMatch:'일치하는 단어가 없어요',noMatchCopy:'다른 단어나 뜻, 메모로 검색해 보세요.',saved:'저장했습니다.',duplicate:'이미 단어장에 있는 단어입니다.',restored:'단어를 복원했습니다.',imported:'가져오기 완료',added:'개 추가',skipped:'개 중복',error:'작업을 완료하지 못했습니다. 다시 시도해 주세요.',invalid:'올바른 단어장 백업 파일이나 항목이 아닙니다. 변경하지 않았습니다.',full:'단어장 한도(2,000개 또는 2MB)에 도달했습니다. 항목을 지우기 전에 백업하세요.',tooLarge:'2MB 이하의 JSON 백업을 선택하세요.',notFound:'다른 탭에서 항목이 변경되었습니다. 새로고침한 뒤 다시 시도하세요.',duplicateTerm:'같은 단어가 이미 있습니다. 다른 단어를 입력하세요.',loading:'단어장을 불러오는 중…',downloaded:'내보내기를 준비했습니다. 브라우저 다운로드를 확인하세요.',count:'개 단어',shown:'개 표시',limit:'최대',unsaved:'저장하지 않은 내용이 있습니다. 저장하지 않고 나갈까요?'
  },
  vi: {
    importPreview:'Xem trước khi nhập',confirmImport:'Nhập các từ này? Các mục hiện có sẽ được giữ nguyên.',local:'Lưu trên trình duyệt này',eyebrow:'Một chút tiếng Hàn mỗi ngày',title:'Sổ từ vựng của bạn',subtitle:'Giữ lại từ bạn chọn. Viết ý nghĩa theo cách của mình.',privacy:'Chỉ lưu từ bạn chủ động chọn và ghi chú bạn tự viết. Không lưu địa chỉ trang hoặc lịch sử duyệt web. Sổ chỉ nằm trong hồ sơ trình duyệt này, không được mã hóa và sẽ mất khi gỡ tiện ích. Hãy xuất bản sao lưu.',searchLabel:'Tìm từ và ghi chú',backup:'Sao lưu JSON',import:'Nhập JSON',exportHint:'Tệp xuất chứa tất cả từ và ghi chú, kể cả khi đang tìm kiếm. Giữ tệp riêng tư. Nhập chỉ thêm từ mới, không thay đổi mục đã có.',addLabel:'Thêm từ',add:'Lưu từ',words:'Từ đã lưu',deleted:'Đã xóa từ.',undo:'Hoàn tác',footer:'Kết quả từ điển chỉ để đọc. Sổ chỉ lưu từ gốc và nội dung bạn tự viết.',term:'Từ tiếng Hàn',meaning:'Nghĩa do tôi viết',note:'Ghi chú của tôi',context:'Ví dụ / ngữ cảnh của tôi',edit:'Sửa',remove:'Xóa',save:'Lưu thay đổi',cancel:'Hủy',hint:'Thêm nghĩa hoặc ghi chú của riêng bạn.',emptyTitle:'Bắt đầu với một từ mới',emptyCopy:'Lưu từ tiếng Hàn khi tra cứu hoặc thêm từ ở trên. Sau đó tự viết nghĩa hoặc ví dụ.',noMatch:'Không tìm thấy từ',noMatchCopy:'Thử tìm từ, nghĩa hoặc ghi chú khác.',saved:'Đã lưu.',duplicate:'Từ này đã có trong sổ.',restored:'Đã khôi phục từ.',imported:'Đã nhập xong',added:'đã thêm',skipped:'đã có',error:'Không thể hoàn thành. Vui lòng thử lại.',invalid:'Tệp hoặc mục không hợp lệ. Không có thay đổi nào được lưu.',full:'Đã đạt giới hạn (2.000 từ hoặc 2 MB). Hãy sao lưu trước khi xóa mục.',tooLarge:'Chọn bản sao JSON nhỏ hơn 2 MB.',notFound:'Mục đã thay đổi ở thẻ khác. Hãy tải lại sổ và thử lại.',duplicateTerm:'Từ này đã tồn tại. Hãy chọn từ khác.',loading:'Đang tải sổ từ vựng…',downloaded:'Đã chuẩn bị tệp xuất. Kiểm tra mục tải xuống.',count:'từ',shown:'hiển thị',limit:'giới hạn',unsaved:'Bạn có thay đổi chưa lưu. Thoát mà không lưu?'
  }
};
const language = (chrome.i18n?.getUILanguage?.() || navigator.language || 'en').split('-')[0];
const t = copy[language] || copy.en;
document.documentElement.lang = copy[language] ? language : 'en';
document.title = `${t.title} · Korean Word Lookup`;
document.querySelectorAll('[data-i18n]').forEach((element) => { element.textContent = t[element.dataset.i18n]; });
const $ = (id) => document.getElementById(id);
$('search').placeholder = t.searchLabel;
$('entries').setAttribute('aria-label', t.words);
let items = [];
let undoId = null;
let editing = null;
let dirty = false;
let busy = false;
function status(message, error = false) { $('status').textContent = message; $('status').classList.toggle('error', error); }
function errorText(error) {
  const code = error?.message || '';
  if (code.includes('NOTEBOOK_FULL')) return t.full;
  if (code.includes('IMPORT_TOO_LARGE')) return t.tooLarge;
  if (code.includes('INVALID_DATA')) return t.invalid;
  if (code.includes('NOT_FOUND')) return t.notFound;
  if (code.includes('DUPLICATE_TERM')) return t.duplicateTerm;
  return t.error;
}
function send(request) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(request, (response) => {
      if (chrome.runtime.lastError || !response || response.error || response.ok !== true) reject(new Error(response?.error || 'STORAGE_ERROR'));
      else resolve(response);
    });
  });
}
async function run(work) {
  if (busy) return;
  busy = true;
  document.querySelectorAll('button').forEach((button) => { button.disabled = true; });
  try { await work(); } catch (error) { status(errorText(error), true); }
  finally { busy = false; document.querySelectorAll('button').forEach((button) => { button.disabled = false; }); }
}
function node(tag, text, className) {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = text;
  if (className) element.className = className;
  return element;
}
function button(text, onClick, className) {
  const element = node('button', text, className);
  element.type = 'button'; element.addEventListener('click', onClick); return element;
}
function mayDiscard() { return !dirty || window.confirm(t.unsaved); }
function render() {
  $('search').disabled = editing !== null;
  const query = $('search').value.trim().toLocaleLowerCase();
  const visible = items.filter((item) => [item.term,item.meaning,item.note,item.context].some((value) => value.toLocaleLowerCase().includes(query)));
  $('count').textContent = `${query ? `${visible.length} ${t.shown} · ` : ''}${items.length} ${t.count} / 2,000 ${t.limit}`;
  $('empty').hidden = visible.length > 0;
  $('empty-title').textContent = items.length ? t.noMatch : t.emptyTitle;
  $('empty-copy').textContent = items.length ? t.noMatchCopy : t.emptyCopy;
  $('entries').replaceChildren();
  for (const item of visible) {
    const article = node('article', undefined, 'entry');
    const title = node('div'); const heading = node('h3', item.term); heading.lang = 'ko'; title.append(heading);
    const date = node('time', new Date(item.createdAt).toLocaleDateString(document.documentElement.lang));
    date.dateTime = new Date(item.createdAt).toISOString(); title.append(date); article.append(title);
    const body = node('div', undefined, 'entry-body');
    for (const field of ['meaning','context','note']) if (item[field]) {
      body.append(node('span', t[field], 'label'), node('p', item[field]));
    }
    if (!item.meaning && !item.note && !item.context) body.append(node('p', t.hint, 'hint'));
    article.append(body);
    const actions = node('div', undefined, 'entry-actions');
    const edit = button(t.edit, () => { if (!mayDiscard()) return; editing = item.id; dirty = false; render(); document.querySelector('.edit-form input')?.focus(); });
    edit.setAttribute('aria-label', `${t.edit}: ${item.term}`);
    const remove = button(t.remove, () => run(async () => {
      if (!mayDiscard()) return;
      const result = await send({action:'vocabularyDelete', id:item.id});
      undoId = result.undoId; editing = null; dirty = false;
      await refresh(); $('undo-bar').hidden = false; status(t.deleted); $('undo').focus();
    }), 'delete');
    remove.setAttribute('aria-label', `${t.remove}: ${item.term}`);
    actions.append(edit, remove); article.append(actions);
    if (editing === item.id) article.append(editForm(item));
    $('entries').append(article);
  }
}
function editForm(item) {
  const form = node('form', undefined, 'edit-form');
  for (const field of ['term','meaning','context','note']) {
    const label = node('label', t[field]);
    const input = node(field === 'term' ? 'input' : 'textarea');
    input.name = field; input.value = item[field]; input.maxLength = {term:200,meaning:1000,context:1000,note:2000}[field]; input.required = field === 'term';
    input.addEventListener('input', () => { dirty = true; }); label.append(input); form.append(label);
  }
  const actions = node('div', undefined, 'buttons'); const save = node('button', t.save, 'primary'); save.type = 'submit';
  actions.append(save, button(t.cancel, () => { if (!mayDiscard()) return; editing = null; dirty = false; render(); })); form.append(actions);
  form.addEventListener('submit', (event) => { event.preventDefault(); run(async () => {
    const fields = Object.fromEntries(new FormData(form));
    await send({action:'vocabularyUpdate',id:item.id,fields}); editing = null; dirty = false; await refresh(); status(t.saved);
  }); });
  return form;
}
async function refresh() {
  const result = await send({action:'vocabularyList'}); items = result.items;
  undoId = result.undoId || null; $('undo-bar').hidden = !undoId; render();
}
$('search').addEventListener('input', () => {
  // 검색은 작성 중인 편집 폼을 파괴하지 않습니다.
  if (editing) return;
  render();
});
$('add-form').addEventListener('submit', (event) => { event.preventDefault(); run(async () => {
  if (!mayDiscard()) return;
  const result = await send({action:'vocabularySave',term:$('new-term').value});
  $('new-term').value = ''; $('search').value = ''; editing = result.item.id; dirty = false; await refresh(); status(result.duplicate ? t.duplicate : t.saved); document.querySelector('.edit-form textarea')?.focus();
}); });
$('undo').addEventListener('click', () => run(async () => {
  if (!undoId || !mayDiscard()) return;
  await send({action:'vocabularyUndoDelete',id:undoId}); undoId = null; editing = null; dirty = false; $('undo-bar').hidden = true; await refresh(); status(t.restored);
}));
// 스프레드시트 수식 실행을 방지합니다. 원본 복원은 JSON 백업을 사용합니다.
function cell(value, delimiter) {
  // TSV의 모든 줄/열 구분자를 먼저 제거해 새 셀의 수식 실행을 막습니다.
  const normalized = delimiter === '\t' ? value.replace(/[\r\n\t]/g, ' ') : value;
  const safe = /^[\s]*[=+@-]/u.test(normalized) ? `'${normalized}` : normalized;
  if (delimiter === '\t') return safe;
  return `"${safe.replace(/"/g, '""')}"`;
}
function download(data, extension, mime) {
  const url = URL.createObjectURL(new Blob([data], {type:mime}));
  const link = node('a'); link.href = url; link.download = `korean-word-lookup-${new Date().toISOString().slice(0,10)}.${extension}`; document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000); status(t.downloaded);
}
for (const format of ['csv','tsv','backup']) $(format).addEventListener('click', () => run(async () => {
  const snapshot = (await send({action:'vocabularyList'})).items;
  if (format === 'backup') download(JSON.stringify({format:'korean-word-lookup-notebook',version:1,items:snapshot}),'json','application/json;charset=utf-8');
  else {
    const delimiter = format === 'csv' ? ',' : '\t'; const keys = ['term','meaning','context','note'];
    const rows = [keys.map((key) => t[key]), ...snapshot.map((item) => keys.map((key) => item[key]))];
    download('\uFEFF' + rows.map((row) => row.map((value) => cell(value, delimiter)).join(delimiter)).join('\r\n'),format,format === 'csv' ? 'text/csv;charset=utf-8' : 'text/tab-separated-values;charset=utf-8');
  }
}));
$('import').addEventListener('click', () => { if (mayDiscard()) $('import-file').click(); });
$('import-file').addEventListener('change', () => run(async () => {
  const file = $('import-file').files[0]; $('import-file').value = ''; if (!file) return;
  if (file.size > 2 * 1024 * 1024) throw new Error('IMPORT_TOO_LARGE');
  const backup = await file.text();
  const preview = await send({action:'vocabularyPreviewImport',backup});
  if (!window.confirm(`${t.importPreview}: ${preview.added} ${t.added}, ${preview.skipped} ${t.skipped}.\n\n${t.confirmImport}`)) return;
  const result = await send({action:'vocabularyImport',backup}); editing = null; dirty = false; await refresh(); status(`${t.imported}: ${result.added} ${t.added}, ${result.skipped} ${t.skipped}.`);
}));
window.addEventListener('beforeunload', (event) => { if (dirty) { event.preventDefault(); event.returnValue = ''; } });
status(t.loading);
run(async () => { await refresh(); status(''); });
