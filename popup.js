document.addEventListener('DOMContentLoaded', () => {
  const toggleSwitch = document.getElementById('translationToggle');
  const statusMessage = document.getElementById('statusMessage');
  const apiRadios = document.getElementsByName('apiChoice');
  const hoverDelaySelect = document.getElementById('hoverDelay');
  const maxDefinitionsSelect = document.getElementById('maxDefinitions');
  const showKoreanDefinitionsToggle = document.getElementById('showKoreanDefinitions');
  const compactTooltipToggle = document.getElementById('compactTooltip');
  const krdictApiKeyInput = document.getElementById('krdictApiKey');
  const clearApiKeyButton = document.getElementById('clearApiKey');

  const defaultSettings = {
    hoverDelayMs: 150,
    maxDefinitions: 3,
    showKoreanDefinitions: true,
    compactTooltip: false
  };

  // 저장된 상태 불러오기
  chrome.storage.sync.get([
    'translationEnabled',
    'selectedApi',
    'hoverDelayMs',
    'maxDefinitions',
    'showKoreanDefinitions',
    'compactTooltip',
    'krdictApiKey'
  ], (result) => {
    toggleSwitch.checked = result.translationEnabled !== false;
    updateStatusMessage(toggleSwitch.checked);
    
    // API 선택 상태 복원
    const selectedApi = result.selectedApi || 'google';
    apiRadios.forEach(radio => {
      radio.checked = radio.value === selectedApi;
    });

    const hoverDelayValue = Number.isFinite(result.hoverDelayMs)
      ? result.hoverDelayMs
      : defaultSettings.hoverDelayMs;
    const maxDefinitionsValue = Number.isFinite(result.maxDefinitions)
      ? result.maxDefinitions
      : defaultSettings.maxDefinitions;
    const showKoreanDefinitionsValue = result.showKoreanDefinitions !== false;
    const compactTooltipValue = result.compactTooltip === true;
    const apiKeyValue = (result.krdictApiKey || '').trim();

    hoverDelaySelect.value = String(hoverDelayValue);
    maxDefinitionsSelect.value = String(maxDefinitionsValue);
    showKoreanDefinitionsToggle.checked = showKoreanDefinitionsValue;
    compactTooltipToggle.checked = compactTooltipValue;
    krdictApiKeyInput.value = apiKeyValue;
  });

  // API 선택 변경 이벤트
  apiRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      chrome.storage.sync.set({ selectedApi: e.target.value });
    });
  });

  hoverDelaySelect.addEventListener('change', (e) => {
    chrome.storage.sync.set({ hoverDelayMs: Number(e.target.value) });
  });

  maxDefinitionsSelect.addEventListener('change', (e) => {
    chrome.storage.sync.set({ maxDefinitions: Number(e.target.value) });
  });

  showKoreanDefinitionsToggle.addEventListener('change', (e) => {
    chrome.storage.sync.set({ showKoreanDefinitions: e.target.checked });
  });

  compactTooltipToggle.addEventListener('change', (e) => {
    chrome.storage.sync.set({ compactTooltip: e.target.checked });
  });

  krdictApiKeyInput.addEventListener('input', (e) => {
    chrome.storage.sync.set({ krdictApiKey: e.target.value.trim() });
  });

  clearApiKeyButton.addEventListener('click', () => {
    chrome.storage.sync.set({ krdictApiKey: '' }, () => {
      krdictApiKeyInput.value = '';
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
          if (!tab.id) return;
          chrome.tabs.sendMessage(tab.id, {
            action: 'toggleTranslation',
            enabled: isEnabled
          }, () => {
            if (chrome.runtime.lastError) {
              return;
            }
          });
        });
      });
    });
  });

  function updateStatusMessage(isEnabled) {
    if (isEnabled) {
      document.querySelector('.api-selection-container').style.display = 'block';
      document.querySelector('.tooltip-settings-container').style.display = 'block';
      document.querySelector('.api-key-container').style.display = 'block';
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
      document.querySelector('.tooltip-settings-container').style.display = 'none';
      document.querySelector('.api-key-container').style.display = 'none';
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
    } else if (area === 'sync' && changes.hoverDelayMs) {
      const newDelay = Number.isFinite(changes.hoverDelayMs.newValue)
        ? changes.hoverDelayMs.newValue
        : defaultSettings.hoverDelayMs;
      hoverDelaySelect.value = String(newDelay);
    } else if (area === 'sync' && changes.maxDefinitions) {
      const newMax = Number.isFinite(changes.maxDefinitions.newValue)
        ? changes.maxDefinitions.newValue
        : defaultSettings.maxDefinitions;
      maxDefinitionsSelect.value = String(newMax);
    } else if (area === 'sync' && changes.showKoreanDefinitions) {
      showKoreanDefinitionsToggle.checked = changes.showKoreanDefinitions.newValue !== false;
    } else if (area === 'sync' && changes.compactTooltip) {
      compactTooltipToggle.checked = changes.compactTooltip.newValue === true;
    } else if (area === 'sync' && changes.krdictApiKey) {
      krdictApiKeyInput.value = (changes.krdictApiKey.newValue || '').trim();
    } else if (area === 'sync' && changes.translationEnabled) {
      const newStatus = changes.translationEnabled.newValue;
      toggleSwitch.checked = newStatus !== false;
      updateStatusMessage(newStatus);
    }
  });
});
