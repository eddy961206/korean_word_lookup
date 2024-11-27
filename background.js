chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    // 웰컴 페이지 열기
    chrome.tabs.create({
      url: 'welcome.html'
    });
  }

  // 모든 탭을 조회
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach((tab) => {
      // 특정 URL 제외 (예: chrome:// 페이지)
      if (tab.url && !tab.url.startsWith('chrome://')) {
        // 먼저 CSS 주입
        chrome.scripting.insertCSS({
          target: { tabId: tab.id },
          files: ['tooltip.css']
        }, () => {
          if (chrome.runtime.lastError) {
            console.error(`Tab ${tab.id}에 CSS 주입 실패: ${chrome.runtime.lastError.message}`);
          } else {
            console.log(`Tab ${tab.id}에 CSS 주입 성공`);
            
            // 그 다음 JS 주입
            chrome.scripting.executeScript({
              target: { tabId: tab.id },
              files: ['thirdParty/jquery-3.6.0.min.js', 'content.js']
            }, () => {
              if (chrome.runtime.lastError) {
                console.error(`Tab ${tab.id}에 JS 주입 실패: ${chrome.runtime.lastError.message}`);
              } else {
                console.log(`Tab ${tab.id}에 JS 주입 성공`);
              }
            });
          }
        });
      }
    });
  });
});
  
  
// API 키를 저장할 변수
let API_KEY = '';

// 환경 설정 로드
fetch(chrome.runtime.getURL('config.json'))
  .then(response => response.json())
  .then(config => {
    API_KEY = config.KRDICT_API_KEY;
  })
  .catch(error => {
    console.error('Failed to load API key:', error);
  });

// content script로부터의 메시지 수신
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getApiKey') {
    sendResponse({ apiKey: API_KEY });
    return true;  // 비동기 응답을 위해 true 반환
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
          // 모든 탭에 상태 변경 메시지 전송
          chrome.tabs.query({}, (tabs) => {
            tabs.forEach((tab) => {
              if (tab.id && !tab.url.startsWith('chrome://')) {
                chrome.tabs.sendMessage(tab.id, {
                  action: 'toggleTranslation',
                  enabled: newStatus
                });
              }
            });
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
  }
});

// 스토리지 변경 감지
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && changes.translationEnabled) {
    updateIcon(changes.translationEnabled.newValue);
  }
});
  