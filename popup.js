document.addEventListener('DOMContentLoaded', () => {
  const toggleSwitch = document.getElementById('translationToggle');
  const statusMessage = document.getElementById('statusMessage');
  const apiRadios = document.getElementsByName('apiChoice');

  // 저장된 상태 불러오기
  chrome.storage.sync.get(['translationEnabled', 'selectedApi'], (result) => {
    toggleSwitch.checked = result.translationEnabled !== false;
    updateStatusMessage(toggleSwitch.checked);
    
    // API 선택 상태 복원
    const selectedApi = result.selectedApi || 'google';
    apiRadios.forEach(radio => {
      radio.checked = radio.value === selectedApi;
    });
  });

  // API 선택 변경 이벤트
  apiRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      chrome.storage.sync.set({ selectedApi: e.target.value });
    });
  });

  // 토글 상태 변경 이벤트 수정
  toggleSwitch.addEventListener('change', (e) => {
    const isEnabled = e.target.checked;

    // 상태 저장
    chrome.storage.sync.set({ translationEnabled: isEnabled }, () => {
      // 상태 메시지 업데이트
      updateStatusMessage(isEnabled);

      // 모든 탭에 메시지 전송
      chrome.tabs.query({}, (tabs) => {
        tabs.forEach((tab) => {
          if (tab.id && !tab.url.startsWith('chrome://')) {
            chrome.tabs.sendMessage(tab.id, {
              action: 'toggleTranslation',
              enabled: isEnabled
            });
          }
        });
      });
    });
  });

  function updateStatusMessage(isEnabled) {
    if (isEnabled) {
      document.querySelector('.api-selection-container').style.display = 'block';
      statusMessage.innerHTML = `
        Hover over Korean text to see English definitions<br>
        <small style="display: block; margin-top: 8px; color: #666;">
          Shortcuts: Alt+G (Google Translate) | Alt+K (Korean Dictionary) | Alt+T (Toggle Translation)
        </small>
      `;
      statusMessage.style.background = '#f0f9ff';
      statusMessage.style.color = '#0369a1';
    } else {
      document.querySelector('.api-selection-container').style.display = 'none';
      statusMessage.textContent = 'Translation is currently disabled';
      statusMessage.style.background = '#fee2e2';
      statusMessage.style.color = '#dc2626';
    }
  }

  // 스토리지 변경 감지하여 라디오 버튼 상태 업데이트
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync' && changes.selectedApi) {
      const newApi = changes.selectedApi.newValue;
      apiRadios.forEach(radio => {
        radio.checked = radio.value === newApi;
      });
    } else if (area === 'sync' && changes.translationEnabled) {
      const newStatus = changes.translationEnabled.newValue;
      toggleSwitch.checked = newStatus !== false;
      updateStatusMessage(newStatus);
    }
  });
});
