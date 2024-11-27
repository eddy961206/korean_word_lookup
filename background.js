chrome.runtime.onInstalled.addListener(() => {
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
  