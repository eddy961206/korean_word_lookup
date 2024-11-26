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

      // 현재 활성화된 모든 탭에 메시지 전송
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs.length > 0) {
          chrome.tabs.sendMessage(tabs[0].id, {
            action: 'toggleTranslation',
            enabled: isEnabled
          }, (response) => {
            if (chrome.runtime.lastError) {
              console.error('메시지 전송 실패:', chrome.runtime.lastError.message);
              // 콘텐츠 스크립트가 없는 경우 (예: chrome:// 페이지), 오류를 무시합니다.
            } else {
              // 응답 처리 (필요시)
            }
          });
        }
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
