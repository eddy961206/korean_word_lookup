/**
 * Korean Word Lookup Chrome Extension
 * Dictionary data provided by National Institute of Korean Language's Basic Korean Dictionary
 * (https://krdict.korean.go.kr)
 * Licensed under the MIT License
 */

const DEFAULT_SETTINGS = {
  translationEnabled: true,
  selectedApi: 'google',
  hoverDelayMs: 150,
  maxDefinitions: 3,
  showKoreanDefinitions: true,
  compactTooltip: false,
  autoFallbackEnabled: true,
  selectionTranslationEnabled: false
};

const CACHE_LIMIT = 200;
const CACHE_TTL_MS = 1000 * 60 * 60 * 24;
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
let autoFallbackEnabled = DEFAULT_SETTINGS.autoFallbackEnabled;
let selectionTranslationEnabled = DEFAULT_SETTINGS.selectionTranslationEnabled;

let lastWord = '';
let tooltipElements = null;
let hoverTimer = null;
let lastHoverPoint = null;
let positionFrame = null;
let activeRequestId = 0;
const translationCache = new Map();
const pendingRequests = new Map();
let cacheGeneration = 0;
let selectionText = '';
let selectionTimer = null;
let selectionRequestId = 0;
let isSelecting = false;
let tooltipMode = null;
let hasTrackedFirstSuccess = false;

// 초기 상태를 Promise로 가져오는 함수
async function initializeExtension() {
  // 초기 비동기 읽기 중 도착한 변경을 모아 오래된 스냅샷보다 우선 적용한다.
  const startupSettings = {};
  // 툴팁 요소 생성 및 이벤트 리스너 설정
  tooltipElements = createTooltip();

  // 팝업으로부터 상태 변경 메시지를 수신
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'invalidateDictionaryCache') {
      invalidateLookupCache();
      sendResponse({ status: 'success' });
      return true;
    }
    if (request.action === 'toggleTranslation') {
      if (!isInitialized) startupSettings.translationEnabled = request.enabled;
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
    if (!isInitialized) {
      for (const [key, change] of Object.entries(changes)) startupSettings[key] = change.newValue;
      return;
    }

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
      invalidateLookupCache();
    }

    // 키/제공자 설정 변경 뒤 이전 실패나 폴백 결과를 재사용하지 않는다.
    if (changes.autoFallbackEnabled) {
      invalidateLookupCache();
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

    if (changes.autoFallbackEnabled) {
      autoFallbackEnabled = changes.autoFallbackEnabled.newValue !== false;
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

  const result = await storageGet([
    'translationEnabled',
    'selectedApi',
    'hoverDelayMs',
    'maxDefinitions',
    'showKoreanDefinitions',
    'compactTooltip',
    'autoFallbackEnabled',
    'selectionTranslationEnabled'
  ]);

  // 로컬 사용 기록은 신뢰된 백그라운드에서만 읽고 쓴다.
  const localState = await chrome.runtime.sendMessage({ action: 'readUsageState' }).catch(() => ({}));
  hasTrackedFirstSuccess = Number.isFinite(localState?.firstSuccessAt);

  applySettings({ ...result, ...startupSettings });

  isInitialized = true; // 초기화 완료 표시

  document.addEventListener('mousedown', () => {
    cancelPendingLookups();
    isSelecting = true;
  });

  document.addEventListener('mouseup', () => {
    isSelecting = false;
    if (!selectionTranslationEnabled) return;
    handleSelectionChange();
  });

  document.addEventListener('keyup', () => {
    if (!selectionTranslationEnabled) return;
    handleSelectionChange();
  });

  // 포커스/선택/화면 변화 뒤에는 이전 위치의 텍스트를 전송하지 않는다.
  document.addEventListener('focusin', cancelPendingLookups, true);
  document.addEventListener('scroll', cancelPendingLookups, true);
  document.addEventListener('visibilitychange', cancelPendingLookups);
  document.addEventListener('mouseleave', cancelPendingLookups);
  document.addEventListener('selectionchange', () => {
    clearHoverTimer();
    activeRequestId += 1;
    if (!isSelecting) handleSelectionChange();
  });

  // 마우스 이동 이벤트 핸들러
  // Optimized for performance: passive listener where possible, but mousemove position is needed.
  document.addEventListener('mousemove', (e) => {
    if (!isEnabled || !isInitialized) return; // 초기화 전에는 동작하지 않음
    schedulePositionUpdate(e);
    scheduleLookup(e);
  }, { passive: true });

  return tooltipElements.tooltip;
}

function storageGet(keys) {
  return new Promise(resolve => {
    chrome.storage.sync.get(keys, resolve);
  });
}

function trackUsage(kind) {
  chrome.runtime.sendMessage({ action: 'trackUsage', kind }, () => {
    if (chrome.runtime.lastError) {
      return;
    }
  });
}

function trackEvent(eventName, payload = {}) {
  chrome.runtime.sendMessage({ action: 'trackEvent', eventName, payload }, () => {
    if (chrome.runtime.lastError) {
      return;
    }
  });
}

async function markFirstSuccess(kind) {
  if (hasTrackedFirstSuccess) return;
  hasTrackedFirstSuccess = true;
  try {
    const response = await chrome.runtime.sendMessage({ action: 'markFirstSuccess', kind });
    if (!response?.ok) hasTrackedFirstSuccess = false;
  } catch {
    hasTrackedFirstSuccess = false;
  }
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
  autoFallbackEnabled = result.autoFallbackEnabled !== false; // Default true
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

// 편집 영역은 중첩/상속 및 Shadow DOM 경계를 넘어 보수적으로 제외한다.
function composedParent(node) {
  return node?.assignedSlot || node?.parentNode || node?.getRootNode?.().host || null;
}

function isPrivateNode(node) {
  for (let current = node; current; current = composedParent(current)) {
    if (current.nodeType !== Node.ELEMENT_NODE) continue;
    const tag = current.tagName?.toLowerCase();
    const editable = current.getAttribute?.('contenteditable');
    if (['input', 'textarea', 'select'].includes(tag)
      || current.isContentEditable
      || (editable !== null && editable !== undefined && ['', 'true', 'plaintext-only'].includes(editable.toLowerCase()))
      || ['textbox', 'searchbox', 'combobox'].includes(current.getAttribute?.('role'))
      || current === tooltipElements?.tooltip) return true;
  }
  return document.designMode?.toLowerCase() === 'on';
}

function cancelPendingLookups() {
  clearHoverTimer();
  lastHoverPoint = null;
  activeRequestId += 1;
  clearSelectionTranslation();
  hideTooltip();
}

function invalidateLookupCache() {
  cancelPendingLookups();
  cacheGeneration += 1;
  translationCache.clear();
  pendingRequests.clear();
}

function scheduleLookup(event) {
  // Mouseup can happen outside this document. Recover only when no button is held.
  if (isSelecting && event.buttons === 0) isSelecting = false;
  clearHoverTimer();
  if (!isEnabled || !isInitialized || document.hidden || isSelecting
    || (selectionTranslationEnabled && selectionText)
    || (event.composedPath?.() || [event.target]).some(isPrivateNode)) {
    cancelPendingLookups();
    return;
  }
  const point = { clientX: event.clientX, clientY: event.clientY, target: event.target };
  lastHoverPoint = point;
  // 이미 표시한 같은 단어는 위치만 갱신하고 사용 횟수를 다시 기록하지 않는다.
  if (lastWord && getKoreanWordAtPoint(point.clientX, point.clientY) === lastWord) return;
  // 다른 단어로 이동하면 진행 중인 응답도 이전 위치에 표시하지 않는다.
  activeRequestId += 1;
  lastWord = '';
  hoverTimer = setTimeout(() => {
    hoverTimer = null;
    if (lastHoverPoint !== point) return;
    handleHover(point).catch(() => {
      lastWord = '';
      hideTooltip();
    });
  }, Math.max(0, hoverDelayMs));
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
  if (!selection || selection.isCollapsed || isEditableSelection(selection)) {
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

  clearHoverTimer();
  activeRequestId += 1;

  if (normalized.length > MAX_SELECTION_CHARS) {
    clearSelectionTimer();
    selectionText = normalized;
    selectionRequestId += 1;
    const msg = chrome.i18n.getMessage('msgTooLong', [String(MAX_SELECTION_CHARS)]);
    renderSelectionError(selectionText, msg);
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
    selectionTimer = null;
    translateSelection(normalized, requestId).catch(error => {
      console.error('Selection translation error:', error);
    });
  }, delay);
}

function isEditableSelection(selection) {
  if (isPrivateNode(document.activeElement)
    || isPrivateNode(selection.anchorNode) || isPrivateNode(selection.focusNode)) return true;
  // 양 끝이 일반 텍스트여도 범위 내부에 편집기가 끼어 있으면 전송하지 않는다.
  for (let index = 0; index < selection.rangeCount; index += 1) {
    const range = selection.getRangeAt(index);
    if (isPrivateNode(range.commonAncestorContainer)) return true;
    const root = range.commonAncestorContainer;
    const candidates = root.querySelectorAll?.('input, textarea, select, [contenteditable], [role="textbox"], [role="searchbox"], [role="combobox"]') || [];
    for (const element of candidates) {
      if (isPrivateNode(element) && range.intersectsNode(element)) return true;
    }
  }
  return false;
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
  if (requestId !== selectionRequestId || !isEnabled || !selectionTranslationEnabled || document.hidden) return;

  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || isEditableSelection(selection)) {
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

  const result = await lookupSelection(text, () => {
    const current = window.getSelection();
    return requestId === selectionRequestId && isEnabled && selectionTranslationEnabled
      && !document.hidden && current && !current.isCollapsed && !isEditableSelection(current)
      && normalizeSelectionText(current.toString()) === text;
  });

  const currentSelection = window.getSelection();
  if (requestId !== selectionRequestId || !isEnabled || !selectionTranslationEnabled
    || document.hidden || !currentSelection || currentSelection.isCollapsed
    || isEditableSelection(currentSelection)
    || normalizeSelectionText(currentSelection.toString()) !== text) return;

  renderSelectionResult(text, result);
  if (selectionRect) {
    updateTooltipPositionFromRect(selectionRect);
  }
}

async function handleHover(point) {
  if (!isEnabled || !isInitialized || document.hidden || isSelecting || isPrivateNode(point.target)
    || (selectionTranslationEnabled && selectionText)) {
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

  lastWord = '';
  const requestId = ++activeRequestId;

  renderLoadingState(koreanWord);
  updateTooltipPosition(point);

  // Auto-fallback logic inside lookupWord
  const result = await lookupWord(koreanWord, () => requestId === activeRequestId
    && isEnabled && !document.hidden && !isPrivateNode(point.target)
    && getKoreanWordAtPoint(point.clientX, point.clientY) === koreanWord);

  if (requestId !== activeRequestId || !isEnabled || document.hidden
    || isPrivateNode(point.target) || getKoreanWordAtPoint(point.clientX, point.clientY) !== koreanWord) {
    return;
  }

  renderLookupResult(koreanWord, result);
  lastWord = result.type === 'error' ? '' : koreanWord; // 성공한 단어만 중복 표시를 막는다.
  if (lastHoverPoint) {
    updateTooltipPosition(lastHoverPoint);
  }
}

async function lookupWord(word, isCurrent = () => true) {
  const api = selectedApi;
  const allowFallback = autoFallbackEnabled;
  const cacheKey = `${selectedApi}:${word}:${autoFallbackEnabled}`;
  const cached = getCacheEntry(cacheKey);
  if (cached) {
    return cached;
  }

  const pending = pendingRequests.get(cacheKey);
  if (pending) {
    pending.subscribers.add(isCurrent);
    return pending.promise;
  }

  const generation = cacheGeneration;
  const subscribers = new Set([isCurrent]);
  // Shared work may continue for a newer caller, but never for stale contexts only.
  const hasCurrentSubscriber = () => generation === cacheGeneration
    && [...subscribers].some(check => check());
  const entry = { subscribers, promise: null };
  const requestPromise = (async () => {
    let result = await performLookup(word, api, hasCurrentSubscriber);
    
    // Fallback Logic
    if (allowFallback && hasCurrentSubscriber() && result.type === 'error') {
       const fallbackApi = api === 'google' ? 'krdict' : 'google';
       const fallbackResult = await performLookup(word, fallbackApi, hasCurrentSubscriber);
       if (fallbackResult.type !== 'error') {
         // Mark as fallback for UI
         fallbackResult.isFallback = true;
         return fallbackResult;
       }
    }
    return result;
  })();

  entry.promise = requestPromise;
  pendingRequests.set(cacheKey, entry);

  try {
    const result = await requestPromise;
    if (generation === cacheGeneration) cacheResult(cacheKey, result);
    return result;
  } finally {
    if (pendingRequests.get(cacheKey) === entry) pendingRequests.delete(cacheKey);
  }
}

async function performLookup(word, api, isCurrent = () => true) {
    if (api === 'google') {
      let translation = await translateText(word);
      if (!translation && isCurrent()) {
        // Fallback to the on-device Chrome Translator API when the
        // remote endpoint is unreachable (Chrome 138+).
        translation = await onDeviceTranslate(word);
      }
      if (translation) {
        return { type: 'google', translation };
      }
      return buildErrorResult(chrome.i18n.getMessage('error') || 'Unable to translate');
    }

    const data = await getDictionaryMeaning(word);
    if (data && data.error === 'missing_key') {
      return buildErrorResult(chrome.i18n.getMessage('errorMissingKey') || 'Dictionary API key missing. Set it in the popup.');
    }
    if (data) {
      return { type: 'dict', data };
    }
    return buildErrorResult(chrome.i18n.getMessage('errorNotFound') || 'Word not found in dictionary');
}

async function lookupSelection(text, isCurrent = () => true) {
  const cacheKey = `selection:${text}`;
  const cached = getCacheEntry(cacheKey);
  if (cached) {
    return cached;
  }

  const pending = pendingRequests.get(cacheKey);
  if (pending) {
    pending.subscribers.add(isCurrent);
    return pending.promise;
  }

  const generation = cacheGeneration;
  const subscribers = new Set([isCurrent]);
  // Shared work may continue for a newer caller, but never for stale contexts only.
  const hasCurrentSubscriber = () => generation === cacheGeneration
    && [...subscribers].some(check => check());
  const entry = { subscribers, promise: null };
  const requestPromise = (async () => {
    let translation = await translateText(text, 'selection');
    if (!translation && hasCurrentSubscriber()) {
      translation = await onDeviceTranslate(text);
    }
    if (translation) {
      return { type: 'selection', translation };
    }
    return buildErrorResult(chrome.i18n.getMessage('error') || 'Unable to translate selection');
  })();

  entry.promise = requestPromise;
  pendingRequests.set(cacheKey, entry);

  try {
    const result = await requestPromise;
    if (generation === cacheGeneration) cacheResult(cacheKey, result);
    return result;
  } finally {
    if (pendingRequests.get(cacheKey) === entry) pendingRequests.delete(cacheKey);
  }
}

function renderLookupResult(word, result) {
  const fallbackPrefix = result.isFallback ? (chrome.i18n.getMessage('fallbackPrefix') || '(Auto)') + ' ' : '';
  
  if (result.type === 'google') {
    renderGoogleResult(word, result.translation, fallbackPrefix);
  } else if (result.type === 'dict') {
    renderDictionaryResult(result.data, fallbackPrefix);
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
  // 첫 요청의 네트워크/키 설정 실패가 이후 정상 요청을 막지 않게 한다.
  if (result.type === 'error') return;
  setCacheEntry(key, result, CACHE_TTL_MS);
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
  setTooltipHeader(formatSelectionHeader(text), chrome.i18n.getMessage('msgSelection'));
  clearTooltipBody();
  setTooltipBody(chrome.i18n.getMessage('msgTranslatingSel'));
  showTooltip();
}

function renderSelectionSuccess(text, translation) {
  setTooltipMode('selection');
  setTooltipState('idle');
  setTooltipHeader(formatSelectionHeader(text), chrome.i18n.getMessage('msgSelection'));
  clearTooltipBody();
  setTooltipBody(translation);
  showTooltip();
  trackUsage('selection');
  markFirstSuccess('selection');
  trackEvent('feature_use', { kind: 'selection', source: 'google' });
}

function renderSelectionError(text, message) {
  setTooltipMode('selection');
  setTooltipState('error');
  setTooltipHeader(formatSelectionHeader(text), chrome.i18n.getMessage('msgSelection'));
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
  setTooltipHeader(word, selectedApi === 'google' ? chrome.i18n.getMessage('googleTrans') : chrome.i18n.getMessage('koreanDict'));
  clearTooltipBody();
  setTooltipBody(chrome.i18n.getMessage('msgTranslating'));
  showTooltip();
}

function renderErrorState(word, message) {
  setTooltipMode('word');
  setTooltipState('error');
  setTooltipHeader(word, selectedApi === 'google' ? chrome.i18n.getMessage('googleTrans') : chrome.i18n.getMessage('koreanDict'));
  clearTooltipBody();
  setTooltipBody(message);
  showTooltip();
  trackEvent('lookup_error', { source: selectedApi, message });
}

function renderGoogleResult(word, translation, prefix = '') {
  setTooltipMode('word');
  setTooltipState('idle');
  setTooltipHeader(word, prefix + chrome.i18n.getMessage('googleTrans'));
  clearTooltipBody();
  setTooltipBody(translation);
  showTooltip();
  trackUsage('word');
  markFirstSuccess('word_google');
  trackEvent('feature_use', { kind: 'word', source: 'google' });
}

function renderDictionaryResult(result, prefix = '') {
  setTooltipMode('word');
  setTooltipState('idle');

  const metaParts = [];
  if (prefix) {
      metaParts.push(prefix.trim()); // e.g. (Auto)
  }
  if (result.primaryTranslation) {
    metaParts.push(result.primaryTranslation);
  }
  if (result.pos) {
    metaParts.push(result.pos);
  }

  setTooltipHeader(result.word, metaParts.join(' • '));
  clearTooltipBody();

  if (compactTooltip) {
    const compactLine = result.englishDefs[0] || result.koreanDefs[0] || chrome.i18n.getMessage('noDef');
    setTooltipBody(compactLine);
  } else {
    const englishDefs = limitDefinitions(result.englishDefs, maxDefinitions);
    appendSection(chrome.i18n.getMessage('headerEng'), englishDefs);

    if (showKoreanDefinitions) {
      const koreanDefs = limitDefinitions(result.koreanDefs, maxDefinitions);
      appendSection(chrome.i18n.getMessage('headerKor'), koreanDefs);
    }
  }

  showTooltip();
  trackUsage('word');
  markFirstSuccess('word_dict');
  trackEvent('feature_use', { kind: 'word', source: 'krdict' });
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
    numbered.push(chrome.i18n.getMessage('moreDefs', [String(remaining)]));
  }
  return numbered;
}

// 문자열에 한국어 문자가 포함되어 있는지 확인
function containsKorean(text) {
  return /[\u3131-\u318E\uAC00-\uD7A3]/.test(text);
}

// 마우스 위치에서 한국어 단어를 추출
function getKoreanWordAtPoint(x, y) {
  // caret API는 가까운 편집기까지 이동할 수 있으므로 실제 노드도 아래에서 검사한다.
  if (isPrivateNode(document.elementFromPoint?.(x, y))) return null;
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
    if (node.nodeType === Node.TEXT_NODE && !isPrivateNode(node)) {
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

// 공급자 요청은 서비스 워커에서 실행해 페이지 CORS와 자격 증명 노출을 피한다.
async function translateText(text, kind = 'word') {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'translateText', text, kind });
    return typeof response?.translation === 'string' ? response.translation : null;
  } catch {
    return null;
  }
}

// On-device translation via the built-in Chrome Translator API.
// Returns null when the API is unavailable so callers can fall back gracefully.
let onDeviceTranslatorPromise = null;

async function getOnDeviceTranslator() {
  if (!('Translator' in self)) {
    return null;
  }
  if (onDeviceTranslatorPromise) {
    return onDeviceTranslatorPromise;
  }
  onDeviceTranslatorPromise = (async () => {
    try {
      const options = { sourceLanguage: 'ko', targetLanguage: 'en' };
      const availability = await Translator.availability(options);
      if (availability === 'unavailable') {
        return null;
      }
      return await Translator.create(options);
    } catch (error) {
      console.warn('On-device translator unavailable:', error);
      return null;
    }
  })();
  const translator = await onDeviceTranslatorPromise;
  // 모델 다운로드/활성화 전 실패를 페이지 수명 전체에 캐시하지 않는다.
  if (!translator) onDeviceTranslatorPromise = null;
  return translator;
}

async function onDeviceTranslate(text) {
  try {
    const translator = await getOnDeviceTranslator();
    if (!translator) {
      return null;
    }
    const translated = await translator.translate(text);
    return translated || null;
  } catch (error) {
    console.warn('On-device translation error:', error);
    return null;
  }
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
  try {
    const response = await chrome.runtime.sendMessage({ action: 'lookupDictionary', text: word });
    if (response?.error === 'missing_key') return { error: 'missing_key' };
    if (typeof response?.xml !== 'string') return null;
    const xmlText = response.xml;
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, "text/xml");
    
    const items = xmlDoc.getElementsByTagName('item');

    if (items.length > 0) {
      const item = items[0];
      const matchedWordNode = item.getElementsByTagName('word')[0];
      const matchedWord = matchedWordNode ? matchedWordNode.textContent : '';
      
      const posNode = item.getElementsByTagName('pos')[0];
      const koreanPos = posNode ? posNode.textContent : '';
      const pos = translatePos(koreanPos);

      // 모든 의미(sense)를 배열로 수집
      const senses = Array.from(item.getElementsByTagName('sense')).map(sense => {
        const definitionNode = sense.getElementsByTagName('definition')[0];
        const koreanDef = definitionNode ? definitionNode.textContent : '';
        
        let translation = '';
        const transWordNode = sense.getElementsByTagName('trans_word')[0];
        if (transWordNode) translation = transWordNode.textContent;

        let englishDef = '';
        const transDfnNode = sense.getElementsByTagName('trans_dfn')[0];
        if (transDfnNode) englishDef = transDfnNode.textContent;
        
        return {
          koreanDef,
          translation,
          englishDef
        };
      });

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
    // 공급자 오류나 본문을 로그에 남기지 않는다.
    return null;
  }
}

// 익스텐션 초기화 실행
initializeExtension().catch(error => {
  console.error('Extension initialization error:', error);
});
