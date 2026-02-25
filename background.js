const CONFIG_URL = chrome.runtime.getURL('config.json');

chrome.runtime.onInstalled.addListener((details) => {
  chrome.storage.local.get(['installTimestamp'], (result) => {
    if (!Number.isFinite(result.installTimestamp)) {
      chrome.storage.local.set({ installTimestamp: Date.now() });
    }
  });

  if (details.reason === 'install') {
    trackEvent('install', {
      reason: details.reason,
      platform: getPlatformLabel()
    }).catch(() => {});

    // 웰컴 페이지 열기
    chrome.tabs.create({
      url: 'welcome.html'
    });
  }

  if (details.reason === 'update') {
    trackEvent('update', {
      reason: details.reason,
      platform: getPlatformLabel()
    }).catch(() => {});
  }
});

// Helper to get config API key
async function fetchConfigApiKey() {
  try {
    const response = await fetch(CONFIG_URL);
    const config = await response.json();
    return (config.KRDICT_API_KEY || '').trim();
  } catch (error) {
    console.error('Failed to load API key:', error);
    return '';
  }
}

// Helper to get effective API key (User > Config)
async function getApiKey() {
  // Try User Key first (Sync storage)
  const syncData = await new Promise(resolve => chrome.storage.sync.get(['krdictApiKey'], resolve));
  const userKey = (syncData.krdictApiKey || '').trim();
  if (userKey) return userKey;

  // Fallback to Config Key
  return fetchConfigApiKey();
}

// content script로부터의 메시지 수신
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getApiKey') {
    getApiKey().then((apiKey) => {
      sendResponse({ apiKey });
    });
    return true;  // 비동기 응답을 위해 true 반환
  }

  if (request.action === 'trackUsage') {
    trackUsage(request.kind).then(() => {
      sendResponse({ ok: true });
    });
    return true;
  }

  if (request.action === 'trackEvent') {
    trackEvent(request.eventName, request.payload || {}).then(() => {
      sendResponse({ ok: true });
    });
    return true;
  }

  if (request.action === 'openReviewPage') {
    chrome.tabs.create({ url: getReviewUrl() }, () => {
      sendResponse({ ok: !chrome.runtime.lastError });
    });
    return true;
  }
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
        const newStatus = !result.translationEnabled;
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

async function trackEvent(eventName, payload = {}) {
  if (!eventName || typeof eventName !== 'string') return;

  const now = Date.now();
  const dayKey = new Date(now).toISOString().slice(0, 10);
  const key = `analyticsEventCounts:${dayKey}`;
  const result = await getLocal([key, 'analyticsEventTrail']);

  const counts = typeof result[key] === 'object' && result[key] !== null
    ? result[key]
    : {};

  counts[eventName] = Number.isFinite(counts[eventName])
    ? counts[eventName] + 1
    : 1;

  const trail = Array.isArray(result.analyticsEventTrail)
    ? result.analyticsEventTrail
    : [];

  trail.push({
    eventName,
    ts: now,
    payload
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
  
