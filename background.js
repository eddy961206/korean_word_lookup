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
  