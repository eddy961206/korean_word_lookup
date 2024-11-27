document.addEventListener('DOMContentLoaded', () => {
  const toggleSwitch = document.getElementById('translationToggle');
  const statusMessage = document.getElementById('statusMessage');

  // 저장된 상태 불러오기
  chrome.storage.sync.get(['translationEnabled'], (result) => {
    toggleSwitch.checked = result.translationEnabled !== false; // 기본값 true
    updateStatusMessage(toggleSwitch.checked);
  });

  // 토글 상태 변경 이벤트
  toggleSwitch.addEventListener('change', (e) => {
    const isEnabled = e.target.checked;

    // 상태 저장
    chrome.storage.sync.set({ translationEnabled: isEnabled }, () => {
      // 상태 메시지 업데이트
      updateStatusMessage(isEnabled);

      // 모든 탭에 메시지 전송
      chrome.tabs.query({}, (tabs) => {
        tabs.forEach((tab) => {
          if (tab.id && !tab.url.startsWith('chrome://')) { // chrome:// 페이지 제외
            chrome.tabs.sendMessage(tab.id, {
              action: 'toggleTranslation',
              enabled: isEnabled
            }, (response) => {
              if (chrome.runtime.lastError) {
                console.error('Message sending failed:', chrome.runtime.lastError.message);
                // 필요에 따라 사용자에게 알림 추가 가능
              } else {
                // 응답 처리 (필요시)
              }
            });
          }
        });
      });
    });
  });

  function updateStatusMessage(isEnabled) {
    if (isEnabled) {
      statusMessage.textContent = 'Hover over Korean text to see English definitions';
      statusMessage.style.background = '#f0f9ff';
      statusMessage.style.color = '#0369a1';
    } else {
      statusMessage.textContent = 'Translation is currently disabled';
      statusMessage.style.background = '#fee2e2';
      statusMessage.style.color = '#dc2626';
    }
  }
});
