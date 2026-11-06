const REPO_ISSUE_URL = 'https://github.com/eddy961206/korean_word_lookup/issues/new';

chrome.runtime.onInstalled.addListener((details) => {
  clearUninstallRedirect();

  chrome.storage.local.get(['installTimestamp'], (result) => {
    if (!Number.isFinite(result.installTimestamp)) {
      chrome.storage.local.set({ installTimestamp: Date.now() });
    }
  });

  if (details.reason === 'install') {
    storageReady.then(() => enqueueMutation(() => trackEvent('install', {
      ...getCommonAnalyticsPayload(),
      reason: details.reason,
    }))).catch(() => {});

    // 웰컴 페이지 열기
    chrome.tabs.create({
      url: 'welcome.html'
    });
  }

  if (details.reason === 'update') {
    storageReady.then(() => enqueueMutation(() => trackEvent('update', {
      ...getCommonAnalyticsPayload(),
      reason: details.reason,
    }))).catch(() => {});
  }
});

// API 키는 신뢰된 확장 프로그램 컨텍스트의 로컬 저장소에서만 사용한다.
// 이전 sync 키는 로컬 저장이 성공한 뒤 제거해 마이그레이션 중 유실을 막는다.
const storageReady = initializePrivateStorage();
storageReady.catch(() => {}); // 실패 시 키/번역 메시지는 안전하게 거절한다.
let mutationQueue = Promise.resolve();

function storageCall(area, method, value) {
  return new Promise((resolve, reject) => {
    chrome.storage[area][method](value, result => {
      if (chrome.runtime.lastError) reject(new Error('Storage unavailable'));
      else resolve(result);
    });
  });
}

async function initializePrivateStorage() {
  await chrome.storage.local.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' });
  const [local, sync] = await Promise.all([
    storageCall('local', 'get', ['krdictApiKey']),
    storageCall('sync', 'get', ['krdictApiKey'])
  ]);
  if (!Object.hasOwn(local, 'krdictApiKey') && typeof sync.krdictApiKey === 'string') {
    await storageCall('local', 'set', { krdictApiKey: sync.krdictApiKey.trim() });
  }
  await storageCall('sync', 'remove', 'krdictApiKey');
  // 원격 분석 경로를 폐기하며 과거의 로컬 식별자/설정을 함께 정리한다.
  await storageCall('local', 'remove', [
    'ga4TelemetryEnabled', 'ga4MeasurementId', 'ga4ApiSecret',
    'analyticsClientId', 'analyticsSessionId'
  ]);
}

function enqueueMutation(operation) {
  const next = mutationQueue.then(operation);
  mutationQueue = next.catch(() => {});
  return next;
}

function isTrustedPopup(sender) {
  return sender.url === chrome.runtime.getURL('popup.html');
}

function isValidLookupText(text) {
  return typeof text === 'string' && text.trim().length > 0 && text.length <= 500;
}

// 고정된 공급자 URL만 허용한다. 페이지에서 임의의 URL/헤더를 전달할 수 없다.
async function fetchProvider(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(url, {
      credentials: 'omit', referrerPolicy: 'no-referrer',
      cache: 'no-store', redirect: 'error', signal: controller.signal
    });
    if (!response.ok) return null;
    // 본문 읽기도 제한 시간 안에 완료되어야 한다.
    const body = await response.text();
    return body.length <= 1_000_000 ? body : null;
  } catch {
    // URL에 키/본문이 포함될 수 있으므로 원본 오류를 기록하지 않는다.
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function translateTextRequest(text) {
  const params = new URLSearchParams({ client: 'gtx', sl: 'ko', tl: 'en', dt: 't', q: text });
  const body = await fetchProvider(`https://translate.googleapis.com/translate_a/single?${params}`);
  if (!body) return { translation: null };
  try {
    const data = JSON.parse(body);
    const translation = Array.isArray(data?.[0]) ? data[0]
      .filter(segment => Array.isArray(segment) && typeof segment[0] === 'string')
      .map(segment => segment[0]).join('') : '';
    return { translation: translation || null };
  } catch {
    return { translation: null };
  }
}

async function lookupDictionaryRequest(text) {
  const local = await storageCall('local', 'get', ['krdictApiKey']);
  const key = typeof local.krdictApiKey === 'string' ? local.krdictApiKey.trim() : '';
  if (!key) return { error: 'missing_key' };
  const params = new URLSearchParams({ key, q: text, translated: 'y', trans_lang: '1' });
  const xml = await fetchProvider(`https://krdict.korean.go.kr/api/search?${params}`);
  // 키가 공급자 오류 응답에 반사되더라도 페이지 컨텍스트로 전달하지 않는다.
  if (xml && (xml.includes(key) || xml.includes(encodeURIComponent(key)))) return { error: 'provider_error' };
  return xml ? { xml } : { error: 'provider_error' };
}

async function handleRequest(request, sender) {
  if (!request || sender.id !== chrome.runtime.id) return { error: 'unauthorized' };
  await storageReady;
  switch (request.action) {
    case 'getDictionaryKeyStatus': {
      if (!isTrustedPopup(sender)) return { error: 'unauthorized' };
      const local = await storageCall('local', 'get', ['krdictApiKey']);
      return { hasKey: Boolean(local.krdictApiKey) };
    }
    case 'setDictionaryKey': {
      if (!isTrustedPopup(sender)) return { error: 'unauthorized' };
      if (typeof request.key !== 'string' || request.key.length > 256 || /[\s]/u.test(request.key.trim())) {
        return { error: 'invalid_key' };
      }
      await enqueueMutation(async () => {
        await storageCall('local', 'set', { krdictApiKey: request.key.trim() });
        await storageCall('sync', 'remove', 'krdictApiKey');
      });
      // 키 원문 없이 캐시 무효화 신호만 모든 탭에 전달한다.
      chrome.tabs.query({}, tabs => {
        for (const tab of tabs) {
          if (!Number.isInteger(tab.id)) continue;
          chrome.tabs.sendMessage(tab.id, { action: 'invalidateDictionaryCache' }, () => {
            void chrome.runtime.lastError; // 콘텐츠 스크립트가 없는 탭은 건너뛴다.
          });
        }
      });
      return { ok: true, hasKey: Boolean(request.key.trim()) };
    }
    case 'translateText':
    case 'lookupDictionary': {
      if (!isValidLookupText(request.text)) return { error: 'invalid_text' };
      const settings = await storageCall('sync', 'get', ['translationEnabled', 'selectionTranslationEnabled']);
      if (settings.translationEnabled === false) return { error: 'disabled' };
      if (request.kind === 'selection' && settings.selectionTranslationEnabled !== true) return { error: 'disabled' };
      return request.action === 'translateText'
        ? translateTextRequest(request.text) : lookupDictionaryRequest(request.text);
    }
    case 'readUsageState': {
      const local = await getLocal(['firstSuccessAt']);
      return { firstSuccessAt: Number.isFinite(local.firstSuccessAt) ? local.firstSuccessAt : null };
    }
    case 'markFirstSuccess':
      return enqueueMutation(async () => {
        if (!['word_google', 'word_dict', 'selection'].includes(request.kind)) return { error: 'invalid_kind' };
        const local = await getLocal(['firstSuccessAt']);
        if (!Number.isFinite(local.firstSuccessAt)) {
          local.firstSuccessAt = Date.now();
          await setLocal({ firstSuccessAt: local.firstSuccessAt, firstSuccessKind: request.kind });
          await trackEvent('first_success', { kind: request.kind });
        }
        return { ok: true, firstSuccessAt: local.firstSuccessAt };
      });
    case 'trackUsage':
      if (!['word', 'selection'].includes(request.kind)) return { error: 'invalid_kind' };
      await enqueueMutation(() => trackUsage(request.kind));
      return { ok: true };
    case 'trackEvent':
      await enqueueMutation(() => trackEvent(request.eventName, request.payload));
      return { ok: true };
    case 'openReviewPage':
    case 'openFeedbackPage':
      if (!isTrustedPopup(sender)) return { error: 'unauthorized' };
      await chrome.tabs.create({ url: request.action === 'openReviewPage' ? getReviewUrl() : getFeedbackUrl() });
      return { ok: true };
    default:
      return { error: 'unsupported_action' };
  }
}

// 서비스 워커가 키와 네트워크를 소유하며 콘텐츠 스크립트에는 결과만 반환한다.
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  handleRequest(request, sender).then(sendResponse, () => sendResponse({ error: 'unavailable' }));
  return true;
});

// 아이콘 상태 업데이트 함수 (배지 텍스트 사용)
function updateIcon(isEnabled) {
  const badgeText = isEnabled ? "ON" : "OFF";
  const badgeColor = isEnabled ? "#4CAF50" : "#F44336"; // 녹색 또는 빨간색
  const title = isEnabled ? "Korean Word Lookup (Enabled)" : "Korean Word Lookup (Disabled)";

  chrome.action.setBadgeText({ text: badgeText });
  chrome.action.setBadgeBackgroundColor({ color: badgeColor });
  chrome.action.setTitle({ title: title });
}

// 초기 상태 설정
chrome.storage.sync.get(['translationEnabled'], (result) => {
  updateIcon(result.translationEnabled !== false);
});

// 단축키 처리
chrome.commands.onCommand.addListener((command) => {
  switch (command) {
    case 'toggle-translation':
      chrome.storage.sync.get(['translationEnabled'], (result) => {
        const newStatus = !(result.translationEnabled !== false);
        chrome.storage.sync.set({ translationEnabled: newStatus }, () => {
          updateIcon(newStatus);
          // 현재 활성 탭에만 메시지 전송
          chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
            if (tabs[0] && tabs[0].id) {
              chrome.tabs.sendMessage(tabs[0].id, {
                action: 'toggleTranslation',
                enabled: newStatus
              }, () => {
                if (chrome.runtime.lastError) {
                  return;
                }
              });
            }
          });
        });
      });
      break;
    case 'toggle-google-translate':
      chrome.storage.sync.set({ selectedApi: 'google' });
      break;
    case 'toggle-korean-dict':
      chrome.storage.sync.set({ selectedApi: 'krdict' });
      break;
    case 'toggle-selection-translation':
      chrome.storage.sync.get(['selectionTranslationEnabled'], (result) => {
        const current = result.selectionTranslationEnabled === true;
        chrome.storage.sync.set({ selectionTranslationEnabled: !current });
      });
      break;
  }
});

// 스토리지 변경 감지
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && changes.translationEnabled) {
    updateIcon(changes.translationEnabled.newValue);
  }
});

function getReviewUrl() {
  const extensionId = chrome.runtime.id;
  return `https://chromewebstore.google.com/detail/${extensionId}/reviews`;
}

function getFeedbackUrl(kind = 'general') {
  const extensionId = chrome.runtime.id;
  const title = encodeURIComponent('[Feedback] Korean Word Lookup');
  const lines = [
    'Tell us what we should improve:',
    '',
    '- Platform: (Windows/Mac/ChromeOS/Linux)',
    '- What happened?',
    '- URL where issue happened:',
    '- Repro steps:',
    '- Expected behavior:',
    '',
    `Extension ID: ${extensionId}`
  ];
  const body = encodeURIComponent(lines.join('\n'));

  return `${REPO_ISSUE_URL}?title=${title}&body=${body}`;
}

function clearUninstallRedirect() {
  chrome.runtime.setUninstallURL('');
}

function getCommonAnalyticsPayload() {
  return {
    platform: getPlatformLabel(),
    version: chrome.runtime.getManifest().version,
    locale: chrome.i18n.getUILanguage()
  };
}

function getLocal(keys) {
  return new Promise(resolve => {
    chrome.storage.local.get(keys, resolve);
  });
}

function setLocal(values) {
  return new Promise(resolve => {
    chrome.storage.local.set(values, resolve);
  });
}

async function trackUsage(kind) {
  const result = await getLocal([
    'usageCount',
    'wordLookupCount',
    'selectionTranslateCount'
  ]);

  const usageCount = Number.isFinite(result.usageCount) ? result.usageCount : 0;
  const wordLookupCount = Number.isFinite(result.wordLookupCount) ? result.wordLookupCount : 0;
  const selectionTranslateCount = Number.isFinite(result.selectionTranslateCount) ? result.selectionTranslateCount : 0;

  const next = {
    usageCount: usageCount + 1
  };

  if (kind === 'selection') {
    next.selectionTranslateCount = selectionTranslateCount + 1;
  } else {
    next.wordLookupCount = wordLookupCount + 1;
  }

  await setLocal(next);
}

function getPlatformLabel() {
  return 'chrome-extension';
}

// 로컬 진단만 유지한다. 자유 입력/URL/번역문/키는 기록하지 않는다.
const ALLOWED_EVENTS = new Set([
  'install', 'update', 'welcome_view', 'onboarding_start', 'popup_open',
  'first_success', 'feature_use', 'lookup_error', 'enable_extension', 'disable_extension',
  'open_shortcut_settings', 'review_prompt_show', 'review_prompt_rate_click',
  'review_prompt_feedback_click', 'review_prompt_later', 'review_prompt_dismiss',
  'onboarding_nudge_show', 'onboarding_nudge_accept', 'onboarding_nudge_dismiss'
]);
const ANALYTICS_ENUMS = {
  kind: ['word', 'selection', 'word_google', 'word_dict'],
  source: ['google', 'krdict', 'popup'],
  platform: ['chrome-extension', 'mac', 'other'],
  reason: ['install', 'update'],
  action: ['enable_selection']
};
function sanitizeAnalyticsPayload(payload = {}) {
  const clean = {};
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return clean;
  for (const [key, values] of Object.entries(ANALYTICS_ENUMS)) {
    if (values.includes(payload[key])) clean[key] = payload[key];
  }
  for (const key of ['daysSinceInstall', 'daysSinceFirstSuccess', 'usageCount']) {
    if (Number.isFinite(payload[key]) && payload[key] >= 0) clean[key] = Math.min(1_000_000, Math.floor(payload[key]));
  }
  return clean;
}

async function trackEvent(eventName, payload = {}) {
  if (!ALLOWED_EVENTS.has(eventName)) return;

  const now = Date.now();
  const dayKey = new Date(now).toISOString().slice(0, 10);
  const key = `analyticsEventCounts:${dayKey}`;
  const safePayload = sanitizeAnalyticsPayload(payload);
  const result = await getLocal(null);
  const cutoff = now - 30 * 24 * 60 * 60 * 1000;
  const expiredKeys = Object.keys(result).filter(name =>
    name.startsWith('analyticsEventCounts:') &&
    (!Number.isFinite(Date.parse(name.slice(21))) || Date.parse(name.slice(21)) < cutoff || Date.parse(name.slice(21)) > now));
  if (expiredKeys.length) await storageCall('local', 'remove', expiredKeys);

  const counts = Object.fromEntries(Object.entries(result[key] || {}).filter(([name, count]) =>
    ALLOWED_EVENTS.has(name) && Number.isFinite(count) && count >= 0));

  counts[eventName] = Number.isFinite(counts[eventName])
    ? Math.min(1_000_000, counts[eventName] + 1)
    : 1;

  const trail = Array.isArray(result.analyticsEventTrail)
    ? result.analyticsEventTrail.filter(event => event && Number.isFinite(event.ts) && event.ts >= cutoff && event.ts <= now && ALLOWED_EVENTS.has(event.eventName))
      .map(event => ({ eventName: event.eventName, ts: event.ts, payload: sanitizeAnalyticsPayload(event.payload) }))
    : [];

  trail.push({
    eventName,
    ts: now,
    payload: safePayload
  });

  while (trail.length > 200) {
    trail.shift();
  }

  await setLocal({
    [key]: counts,
    analyticsEventTrail: trail,
    analyticsLastEventAt: now
  });

}

clearUninstallRedirect();
