/**
 * Korean Word Lookup Chrome Extension
 * Dictionary data provided by National Institute of Korean Language's Basic Korean Dictionary
 * (https://krdict.korean.go.kr)
 * Licensed under CC BY-SA 2.0 KR
 */

const DEFAULT_SETTINGS = {
  translationEnabled: true,
  selectedApi: 'google',
  hoverDelayMs: 150,
  maxDefinitions: 3,
  showKoreanDefinitions: true,
  compactTooltip: false,
  selectionTranslationEnabled: false
};

const CACHE_LIMIT = 200;
const CACHE_TTL_MS = 1000 * 60 * 60 * 24;
const ERROR_TTL_MS = 1000 * 60 * 2;
const MAX_SELECTION_CHARS = 500;
const SELECTION_HEADER_CHARS = 60;

// 번역 기능 활성화 여부를 저장하는 변수
let isEnabled = true;
let isInitialized = false; // 초기화 여부를 추적하는 변수
let selectedApi = DEFAULT_SETTINGS.selectedApi;
let hoverDelayMs = DEFAULT_SETTINGS.hoverDelayMs;
let maxDefinitions = DEFAULT_SETTINGS.maxDefinitions;
let showKoreanDefinitions = DEFAULT_SETTINGS.showKoreanDefinitions;
let compactTooltip = DEFAULT_SETTINGS.compactTooltip;
let selectionTranslationEnabled = DEFAULT_SETTINGS.selectionTranslationEnabled;

let lastWord = '';
let tooltipElements = null;
let hoverTimer = null;
let lastHoverPoint = null;
let positionFrame = null;
let activeRequestId = 0;
const translationCache = new Map();
const pendingRequests = new Map();
let selectionText = '';
let selectionTimer = null;
let selectionRequestId = 0;
let isSelecting = false;
let tooltipMode = null;

// 초기 상태를 Promise로 가져오는 함수
async function initializeExtension() {
  const result = await storageGet([
    'translationEnabled',
    'selectedApi',
    'hoverDelayMs',
    'maxDefinitions',
    'showKoreanDefinitions',
    'compactTooltip',
    'selectionTranslationEnabled'
  ]);

  applySettings(result);

  // 툴팁 요소 생성 및 이벤트 리스너 설정
  tooltipElements = createTooltip();

  // 팝업으로부터 상태 변경 메시지를 수신
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'toggleTranslation') {
      isEnabled = request.enabled;
      if (!isEnabled) {
        hideTooltip();
        lastWord = '';
        activeRequestId += 1;
        clearHoverTimer();
        lastHoverPoint = null;
        clearSelectionTranslation();
      }
      sendResponse({ status: 'success' }); // 반드시 응답을 보내야 함
      return true; // 비동기 응답을 허용
    }
  });

  // 스토리지 변경 사항을 실시간으로 감지
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync') return;

    if (changes.translationEnabled) {
      isEnabled = changes.translationEnabled.newValue !== false;
      if (!isEnabled) {
        hideTooltip();
        lastWord = '';
        activeRequestId += 1;
        clearHoverTimer();
        lastHoverPoint = null;
        clearSelectionTranslation();
      }
    }

    if (changes.selectedApi) {
      selectedApi = changes.selectedApi.newValue || DEFAULT_SETTINGS.selectedApi;
      activeRequestId += 1;
      lastWord = '';
    }

    if (changes.hoverDelayMs) {
      hoverDelayMs = Number.isFinite(changes.hoverDelayMs.newValue)
        ? changes.hoverDelayMs.newValue
        : DEFAULT_SETTINGS.hoverDelayMs;
    }

    if (changes.maxDefinitions) {
      maxDefinitions = Number.isFinite(changes.maxDefinitions.newValue)
        ? changes.maxDefinitions.newValue
        : DEFAULT_SETTINGS.maxDefinitions;
    }

    if (changes.showKoreanDefinitions) {
      showKoreanDefinitions = changes.showKoreanDefinitions.newValue !== false;
    }

    if (changes.compactTooltip) {
      compactTooltip = changes.compactTooltip.newValue === true;
    }

    if (changes.selectionTranslationEnabled) {
      selectionTranslationEnabled = changes.selectionTranslationEnabled.newValue === true;
      if (selectionTranslationEnabled) {
        handleSelectionChange();
      } else {
        clearSelectionTranslation();
      }
    }
  });

  isInitialized = true; // 초기화 완료 표시

  document.addEventListener('mousedown', () => {
    if (!selectionTranslationEnabled) return;
    isSelecting = true;
    clearHoverTimer();
  });

  document.addEventListener('mouseup', () => {
    if (!selectionTranslationEnabled) return;
    isSelecting = false;
    handleSelectionChange();
  });

  document.addEventListener('keyup', () => {
    if (!selectionTranslationEnabled) return;
    handleSelectionChange();
  });

  // 마우스 이동 이벤트 핸들러
  $(document).on('mousemove', (e) => {
    if (!isEnabled || !isInitialized) return; // 초기화 전에는 동작하지 않음
    schedulePositionUpdate(e);
    scheduleLookup(e);
  });

  return tooltipElements.tooltip;
}

function storageGet(keys) {
  return new Promise(resolve => {
    chrome.storage.sync.get(keys, resolve);
  });
}

function applySettings(result) {
  isEnabled = result.translationEnabled !== false;
  selectedApi = result.selectedApi || DEFAULT_SETTINGS.selectedApi;
  hoverDelayMs = Number.isFinite(result.hoverDelayMs)
    ? result.hoverDelayMs
    : DEFAULT_SETTINGS.hoverDelayMs;
  maxDefinitions = Number.isFinite(result.maxDefinitions)
    ? result.maxDefinitions
    : DEFAULT_SETTINGS.maxDefinitions;
  showKoreanDefinitions = result.showKoreanDefinitions !== false;
  compactTooltip = result.compactTooltip === true;
  selectionTranslationEnabled = result.selectionTranslationEnabled === true;
}

function createTooltip() {
  const tooltip = document.createElement('div');
  tooltip.className = 'kr-tooltip';

  const header = document.createElement('div');
  header.className = 'kr-tooltip__header';

  const word = document.createElement('span');
  word.className = 'kr-tooltip__word';

  const meta = document.createElement('span');
  meta.className = 'kr-tooltip__meta';

  header.appendChild(word);
  header.appendChild(meta);

  const body = document.createElement('div');
  body.className = 'kr-tooltip__body';

  tooltip.appendChild(header);
  tooltip.appendChild(body);

  document.body.appendChild(tooltip);

  return { tooltip, word, meta, body };
}

function clearHoverTimer() {
  if (!hoverTimer) return;
  clearTimeout(hoverTimer);
  hoverTimer = null;
}

function scheduleLookup(event) {
  if (selectionTranslationEnabled && (isSelecting || selectionText)) {
    return;
  }
  lastHoverPoint = { clientX: event.clientX, clientY: event.clientY };
  clearHoverTimer();

  const delay = Math.max(0, hoverDelayMs);
  hoverTimer = setTimeout(() => {
    if (!lastHoverPoint) return;
    handleHover(lastHoverPoint).catch(error => {
      console.error('Hover handling error:', error);
    });
  }, delay);
}

function schedulePositionUpdate(event) {
  if (!tooltipElements || tooltipElements.tooltip.style.display !== 'block') {
    return;
  }
  if (tooltipMode === 'selection') {
    return;
  }

  lastHoverPoint = { clientX: event.clientX, clientY: event.clientY };

  if (positionFrame) return;
  positionFrame = requestAnimationFrame(() => {
    positionFrame = null;
    if (!lastHoverPoint) return;
    updateTooltipPosition(lastHoverPoint);
  });
}

function clearSelectionTimer() {
  if (!selectionTimer) return;
  clearTimeout(selectionTimer);
  selectionTimer = null;
}

function clearSelectionTranslation() {
  clearSelectionTimer();
  selectionText = '';
  selectionRequestId += 1;
  isSelecting = false;
  lastWord = '';
  if (tooltipMode === 'selection') {
    hideTooltip();
  }
}

function handleSelectionChange() {
  if (!isEnabled || !selectionTranslationEnabled) {
    clearSelectionTranslation();
    return;
  }

  const selection = window.getSelection();
  if (!selection || selection.isCollapsed) {
    clearSelectionTranslation();
    return;
  }

  if (isEditableSelection(selection)) {
    clearSelectionTranslation();
    return;
  }

  const normalized = normalizeSelectionText(selection.toString());
  if (!normalized) {
    clearSelectionTranslation();
    return;
  }

  if (!containsKorean(normalized)) {
    clearSelectionTranslation();
    return;
  }

  if (normalized.length > MAX_SELECTION_CHARS) {
    selectionText = normalized;
    selectionRequestId += 1;
    renderSelectionError(selectionText, `Selection too long (max ${MAX_SELECTION_CHARS} characters).`);
    const selectionRect = getSelectionRect(selection);
    if (selectionRect) {
      updateTooltipPositionFromRect(selectionRect);
    } else if (lastHoverPoint) {
      updateTooltipPosition(lastHoverPoint);
    }
    return;
  }

  if (normalized === selectionText) {
    return;
  }

  selectionText = normalized;
  lastWord = '';
  const requestId = ++selectionRequestId;
  clearSelectionTimer();

  const delay = Math.max(0, hoverDelayMs);
  selectionTimer = setTimeout(() => {
    translateSelection(selectionText, requestId).catch(error => {
      console.error('Selection translation error:', error);
    });
  }, delay);
}

function isEditableSelection(selection) {
  const anchorNode = selection.anchorNode;
  if (!anchorNode) return false;
  const element = anchorNode.nodeType === Node.ELEMENT_NODE
    ? anchorNode
    : anchorNode.parentElement;
  if (!element) return false;
  if (element.isContentEditable) return true;
  return Boolean(element.closest('input, textarea, [contenteditable="true"]'));
}

function normalizeSelectionText(text) {
  return text.replace(/\s+/g, ' ').trim();
}

function getSelectionRect(selection) {
  if (!selection || selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0);
  if (!range) return null;
  const rect = range.getBoundingClientRect();
  if (rect && (rect.width || rect.height)) {
    return rect;
  }
  const rects = range.getClientRects();
  if (rects.length) {
    return rects[rects.length - 1];
  }
  return rect;
}

function updateTooltipPositionFromRect(rect) {
  if (!tooltipElements || !rect) return;

  const tooltip = tooltipElements.tooltip;
  const scrollX = window.scrollX || window.pageXOffset;
  const scrollY = window.scrollY || window.pageYOffset;
  const padding = 12;

  let left = rect.left + scrollX;
  let top = rect.bottom + scrollY + padding;

  const tooltipWidth = tooltip.offsetWidth || 0;
  const tooltipHeight = tooltip.offsetHeight || 0;
  const maxLeft = scrollX + window.innerWidth - tooltipWidth - padding;
  const maxTop = scrollY + window.innerHeight - tooltipHeight - padding;

  if (tooltipWidth) {
    left = Math.min(left, maxLeft);
  }

  if (tooltipHeight) {
    top = Math.min(top, maxTop);
  }

  tooltip.style.left = `${Math.max(scrollX + padding, left)}px`;
  tooltip.style.top = `${Math.max(scrollY + padding, top)}px`;
}

async function translateSelection(text, requestId) {
  if (requestId !== selectionRequestId) return;

  const selection = window.getSelection();
  if (!selection || selection.isCollapsed) {
    clearSelectionTranslation();
    return;
  }

  const normalized = normalizeSelectionText(selection.toString());
  if (normalized !== text) {
    return;
  }

  activeRequestId += 1;
  const selectionRect = getSelectionRect(selection);

  renderSelectionLoading(text);
  if (selectionRect) {
    updateTooltipPositionFromRect(selectionRect);
  } else if (lastHoverPoint) {
    updateTooltipPosition(lastHoverPoint);
  }

  const result = await lookupSelection(text);

  if (requestId !== selectionRequestId) {
    return;
  }

  renderSelectionResult(text, result);
  if (selectionRect) {
    updateTooltipPositionFromRect(selectionRect);
  }
}

async function handleHover(point) {
  if (selectionTranslationEnabled && selectionText) {
    return;
  }
  const koreanWord = getKoreanWordAtPoint(point.clientX, point.clientY);

  if (!koreanWord || !containsKorean(koreanWord)) {
    hideTooltip();
    lastWord = '';
    activeRequestId += 1;
    return;
  }

  if (koreanWord === lastWord) {
    return;
  }

  lastWord = koreanWord;
  const requestId = ++activeRequestId;

  renderLoadingState(koreanWord);
  updateTooltipPosition(point);

  const result = await lookupWord(koreanWord);

  if (requestId !== activeRequestId) {
    return;
  }

  renderLookupResult(koreanWord, result);
  if (lastHoverPoint) {
    updateTooltipPosition(lastHoverPoint);
  }
}

async function lookupWord(word) {
  const cacheKey = `${selectedApi}:${word}`;
  const cached = getCacheEntry(cacheKey);
  if (cached) {
    return cached;
  }

  const pending = pendingRequests.get(cacheKey);
  if (pending) {
    return pending;
  }

  const requestPromise = (async () => {
    if (selectedApi === 'google') {
      const translation = await translateText(word);
      if (translation) {
        return { type: 'google', translation };
      }
      return buildErrorResult('Unable to translate');
    }

    const data = await getDictionaryMeaning(word);
    if (data && data.error === 'missing_key') {
      return buildErrorResult('Dictionary API key missing. Set it in the popup.');
    }
    if (data) {
      return { type: 'dict', data };
    }
    return buildErrorResult('Word not found in dictionary');
  })();

  pendingRequests.set(cacheKey, requestPromise);

  try {
    const result = await requestPromise;
    cacheResult(cacheKey, result);
    return result;
  } finally {
    pendingRequests.delete(cacheKey);
  }
}

async function lookupSelection(text) {
  const cacheKey = `selection:${text}`;
  const cached = getCacheEntry(cacheKey);
  if (cached) {
    return cached;
  }

  const pending = pendingRequests.get(cacheKey);
  if (pending) {
    return pending;
  }

  const requestPromise = (async () => {
    const translation = await translateText(text);
    if (translation) {
      return { type: 'selection', translation };
    }
    return buildErrorResult('Unable to translate selection');
  })();

  pendingRequests.set(cacheKey, requestPromise);

  try {
    const result = await requestPromise;
    cacheResult(cacheKey, result);
    return result;
  } finally {
    pendingRequests.delete(cacheKey);
  }
}

function renderLookupResult(word, result) {
  if (result.type === 'google') {
    renderGoogleResult(word, result.translation);
  } else if (result.type === 'dict') {
    renderDictionaryResult(result.data);
  } else {
    renderErrorState(word, result.message);
  }
}

function renderSelectionResult(text, result) {
  if (result.type === 'selection') {
    renderSelectionSuccess(text, result.translation);
  } else {
    renderSelectionError(text, result.message);
  }
}

function buildErrorResult(message) {
  return { type: 'error', message };
}

function cacheResult(key, result) {
  const ttl = result.type === 'error' ? ERROR_TTL_MS : CACHE_TTL_MS;
  setCacheEntry(key, result, ttl);
}

function getCacheEntry(key) {
  const entry = translationCache.get(key);
  if (!entry) {
    return null;
  }
  if (Date.now() > entry.expiresAt) {
    translationCache.delete(key);
    return null;
  }
  translationCache.delete(key);
  translationCache.set(key, entry);
  return entry.value;
}

function setCacheEntry(key, value, ttlMs) {
  const expiresAt = Date.now() + ttlMs;
  if (translationCache.has(key)) {
    translationCache.delete(key);
  }
  translationCache.set(key, { value, expiresAt });

  if (translationCache.size > CACHE_LIMIT) {
    const oldestKey = translationCache.keys().next().value;
    translationCache.delete(oldestKey);
  }
}

function showTooltip() {
  if (!tooltipElements) return;
  tooltipElements.tooltip.style.display = 'block';
}

function hideTooltip() {
  if (!tooltipElements) return;
  tooltipElements.tooltip.style.display = 'none';
  tooltipMode = null;
}

function updateTooltipPosition(event) {
  if (!tooltipElements) return;

  const tooltip = tooltipElements.tooltip;
  const scrollX = window.scrollX || window.pageXOffset;
  const scrollY = window.scrollY || window.pageYOffset;
  const padding = 12;

  let left = event.clientX + scrollX + padding;
  let top = event.clientY + scrollY + padding;

  const tooltipWidth = tooltip.offsetWidth || 0;
  const tooltipHeight = tooltip.offsetHeight || 0;
  const maxLeft = scrollX + window.innerWidth - tooltipWidth - padding;
  const maxTop = scrollY + window.innerHeight - tooltipHeight - padding;

  if (tooltipWidth) {
    left = Math.min(left, maxLeft);
  }

  if (tooltipHeight) {
    top = Math.min(top, maxTop);
  }

  tooltip.style.left = `${Math.max(scrollX + padding, left)}px`;
  tooltip.style.top = `${Math.max(scrollY + padding, top)}px`;
}

function setTooltipMode(mode) {
  tooltipMode = mode;
}

function setTooltipState(state) {
  const tooltip = tooltipElements.tooltip;
  tooltip.classList.toggle('kr-tooltip--loading', state === 'loading');
  tooltip.classList.toggle('kr-tooltip--error', state === 'error');
  tooltip.classList.toggle('kr-tooltip--compact', compactTooltip);
}

function setTooltipHeader(wordText, metaText) {
  tooltipElements.word.textContent = wordText || '';
  tooltipElements.meta.textContent = metaText || '';
}

function setTooltipBody(text) {
  tooltipElements.body.textContent = text || '';
}

function clearTooltipBody() {
  tooltipElements.body.textContent = '';
  while (tooltipElements.body.firstChild) {
    tooltipElements.body.removeChild(tooltipElements.body.firstChild);
  }
}

function appendSection(title, lines) {
  if (!lines.length) return;
  const section = document.createElement('div');
  section.className = 'kr-tooltip__section';

  const sectionTitle = document.createElement('div');
  sectionTitle.className = 'kr-tooltip__section-title';
  sectionTitle.textContent = title;

  const sectionBody = document.createElement('div');
  sectionBody.className = 'kr-tooltip__section-body';
  sectionBody.textContent = lines.join('\n');

  section.appendChild(sectionTitle);
  section.appendChild(sectionBody);
  tooltipElements.body.appendChild(section);
}

function renderSelectionLoading(text) {
  setTooltipMode('selection');
  setTooltipState('loading');
  setTooltipHeader(formatSelectionHeader(text), 'Selection • Google Translate');
  clearTooltipBody();
  setTooltipBody('Translating selection...');
  showTooltip();
}

function renderSelectionSuccess(text, translation) {
  setTooltipMode('selection');
  setTooltipState('idle');
  setTooltipHeader(formatSelectionHeader(text), 'Selection • Google Translate');
  clearTooltipBody();
  setTooltipBody(translation);
  showTooltip();
}

function renderSelectionError(text, message) {
  setTooltipMode('selection');
  setTooltipState('error');
  setTooltipHeader(formatSelectionHeader(text), 'Selection • Google Translate');
  clearTooltipBody();
  setTooltipBody(message);
  showTooltip();
}

function formatSelectionHeader(text) {
  const normalized = normalizeSelectionText(text);
  if (normalized.length <= SELECTION_HEADER_CHARS) {
    return normalized;
  }
  const sliceLength = Math.max(0, SELECTION_HEADER_CHARS - 3);
  return `${normalized.slice(0, sliceLength)}...`;
}

function renderLoadingState(word) {
  setTooltipMode('word');
  setTooltipState('loading');
  setTooltipHeader(word, selectedApi === 'google' ? 'Google Translate' : 'Korean Dictionary');
  clearTooltipBody();
  setTooltipBody('Translating...');
  showTooltip();
}

function renderErrorState(word, message) {
  setTooltipMode('word');
  setTooltipState('error');
  setTooltipHeader(word, selectedApi === 'google' ? 'Google Translate' : 'Korean Dictionary');
  clearTooltipBody();
  setTooltipBody(message);
  showTooltip();
}

function renderGoogleResult(word, translation) {
  setTooltipMode('word');
  setTooltipState('idle');
  setTooltipHeader(word, 'Google Translate');
  clearTooltipBody();
  setTooltipBody(translation);
  showTooltip();
}

function renderDictionaryResult(result) {
  setTooltipMode('word');
  setTooltipState('idle');

  const metaParts = [];
  if (result.primaryTranslation) {
    metaParts.push(result.primaryTranslation);
  }
  if (result.pos) {
    metaParts.push(result.pos);
  }

  setTooltipHeader(result.word, metaParts.join(' • '));
  clearTooltipBody();

  if (compactTooltip) {
    const compactLine = result.englishDefs[0] || result.koreanDefs[0] || 'No definition available';
    setTooltipBody(compactLine);
    showTooltip();
    return;
  }

  const englishDefs = limitDefinitions(result.englishDefs, maxDefinitions);
  appendSection('English definitions', englishDefs);

  if (showKoreanDefinitions) {
    const koreanDefs = limitDefinitions(result.koreanDefs, maxDefinitions);
    appendSection('Korean definitions', koreanDefs);
  }

  showTooltip();
}

function limitDefinitions(definitions, limit) {
  if (!definitions.length) return [];
  const safeLimit = Number.isFinite(limit) && limit > 0
    ? limit
    : DEFAULT_SETTINGS.maxDefinitions;
  const trimmed = definitions.slice(0, safeLimit);
  const numbered = trimmed.map((definition, index) => `${index + 1}. ${definition}`);
  const remaining = definitions.length - trimmed.length;
  if (remaining > 0) {
    numbered.push(`...and ${remaining} more`);
  }
  return numbered;
}

// 문자열에 한국어 문자가 포함되어 있는지 확인
function containsKorean(text) {
  return /[\u3131-\u318E\uAC00-\uD7A3]/.test(text);
}

// 마우스 위치에서 한국어 단어를 추출
function getKoreanWordAtPoint(x, y) {
  let range;
  if (document.caretRangeFromPoint) {
    range = document.caretRangeFromPoint(x, y);
  } else if (document.caretPositionFromPoint) {
    const pos = document.caretPositionFromPoint(x, y);
    if (pos && pos.offsetNode) {
      range = document.createRange();
      range.setStart(pos.offsetNode, pos.offset);
      range.setEnd(pos.offsetNode, pos.offset);
    }
  }

  if (range) {
    const node = range.startContainer;
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent;
      const offset = range.startOffset;

      // 현재 커서가 정확히 한국어 문자 위에 있는지 확인
      if (!containsKorean(text.charAt(offset))) {
        return null;
      }

      let start = offset;
      let end = offset;

      // 왼쪽으로 이동하면서 단어의 시작 찾기
      while (start > 0) {
        const prevChar = text.charAt(start - 1);
        // 한국어가 아닌 문자(공백, 구두점 등)를 만나면 중단
        if (!containsKorean(prevChar) || /\s/.test(prevChar)) {
          break;
        }
        start--;
      }

      // 오른쪽으로 이동하면서 단어의 끝 찾기
      while (end < text.length) {
        const nextChar = text.charAt(end);
        // 한국어가 아닌 문자(공백, 구두점 등)를 만나면 중단
        if (!containsKorean(nextChar) || /\s/.test(nextChar)) {
          break;
        }
        end++;
      }

      if (start !== end) {
        return text.slice(start, end);
      }
    }
  }
  return null;
}

// 구글 번역 API 사용
function translateText(text) {
  return $.ajax({
    url: 'https://translate.googleapis.com/translate_a/single',
    data: {
      client: 'gtx',
      sl: 'ko',
      tl: 'en',
      dt: 't',
      q: text
    },
    dataType: 'json'
  }).then(
    data => data[0][0][0],
    error => {
      console.error('Translation error:', error);
      return null;
    }
  );
}

// 한국어 품사를 영어로 변환
function translatePos(koreanPos) {
  const posMap = {
    '명사': 'n.',
    '대명사': 'pron.',
    '수사': 'num.',
    '조사': 'part.',
    '동사': 'v.',
    '형용사': 'adj.',
    '관형사': 'det.',
    '부사': 'adv.',
    '감탄사': 'interj.',
    '접사': 'af.',
    '의존 명사': 'dep. n.',
    '보조 동사': 'aux. v.',
    '보조 형용사': 'aux. adj.',
    '어미': 'end.'
  };

  return posMap[koreanPos] || koreanPos; // 매핑이 없는 경우 원래 값 반환
}

// 국립국어원 사전 API 사용
async function getDictionaryMeaning(word) {
  // background.js로부터 API 키 가져오기
  const response = await chrome.runtime.sendMessage({ action: 'getApiKey' });
  const API_KEY = (response.apiKey || '').trim();
  if (!API_KEY) {
    return { error: 'missing_key' };
  }

  const url = `https://krdict.korean.go.kr/api/search?key=${API_KEY}&q=${encodeURIComponent(word)}&translated=y&trans_lang=1`;

  try {
    const response = await $.ajax({
      url: url,
      dataType: 'xml'
    });

    const $xml = $(response); // 응답 형태는 dict_res_example.xml 참고
    const items = $xml.find('item');

    if (items.length > 0) {
      const matchedWord = items.eq(0).find('word').text();
      const koreanPos = items.eq(0).find('pos').text();
      const pos = translatePos(koreanPos);

      // 모든 의미(sense)를 배열로 수집
      const senses = items.eq(0).find('sense').map(function() {
        const $sense = $(this);
        return {
          koreanDef: $sense.find('definition').text(),
          translation: $sense.find('translation trans_word').text(),
          englishDef: $sense.find('translation trans_dfn').text()
        };
      }).get();

      const primaryTranslation = senses[0]?.translation?.split(';')[0]?.trim() || '';

      const englishDefs = senses
        .map((sense) => sense.englishDef.trim())
        .filter(Boolean);

      const koreanDefs = senses
        .map((sense) => sense.koreanDef.trim())
        .filter(Boolean);

      return {
        word: matchedWord,
        pos,
        primaryTranslation,
        englishDefs,
        koreanDefs
      };
    }
    return null;
  } catch (error) {
    console.error('Dictionary lookup error:', error);
    return null;
  }
}

// 익스텐션 초기화 실행
initializeExtension().catch(error => {
  console.error('Extension initialization error:', error);
});
