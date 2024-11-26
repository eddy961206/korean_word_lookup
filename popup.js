// This file can be used to add interactivity to the popup
// Currently empty as the popup is static, but you can add features like:
// - Toggle extension on/off
// - Configure tooltip appearance
// - Add custom words to the dictionary
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
    chrome.storage.sync.set({ translationEnabled: isEnabled });
    
    // 상태 메시지 업데이트
    updateStatusMessage(isEnabled);

    // 현재 활성화된 탭에 메시지 전송
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, { 
        action: 'toggleTranslation', 
        enabled: isEnabled 
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