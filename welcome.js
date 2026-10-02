document.addEventListener('DOMContentLoaded', () => {
  document.documentElement.lang = typeof chrome !== 'undefined' && chrome.i18n
    ? chrome.i18n.getUILanguage()
    : navigator.language;
  document.querySelectorAll('[data-i18n]').forEach(element => {
    const key = element.getAttribute('data-i18n');
    const message = getI18nMessage(key);
    if (message) element.textContent = message;
  });

  const shortcutPrefix = /Mac/i.test(navigator.platform) ? '⌥⇧' : 'Alt+';
  document.querySelectorAll('[data-shortcut]').forEach(element => {
    element.textContent = shortcutPrefix + element.getAttribute('data-shortcut');
  });

  trackEvent('welcome_view');

  const demoWord = document.getElementById('demoWord');
  const demoTooltip = document.getElementById('demoTooltip');
  function showDemoTooltip() {
    if (!demoTooltip) return;
    demoTooltip.classList.add('visible');
    demoWord.setAttribute('aria-expanded', 'true');
    // 정적 예시는 실제 번역이나 첫 성공 지표로 기록하지 않는다.
  }

  if (demoWord) {
    demoWord.addEventListener('mouseenter', showDemoTooltip);
    demoWord.addEventListener('focus', showDemoTooltip);
    demoWord.addEventListener('click', showDemoTooltip);
    demoWord.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        showDemoTooltip();
      }
    });
  }

  const testButton = document.getElementById('openTestPage');
  if (!testButton) return;

  testButton.addEventListener('click', () => {
    trackEvent('onboarding_start');

    const url = 'https://ko.wikipedia.org/wiki/%ED%95%9C%EA%B5%AD%EC%96%B4';
    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) {
      chrome.tabs.create({ url });
      return;
    }
    window.open(url, '_blank', 'noopener');
  });
});

function getI18nMessage(key) {
  if (typeof chrome === 'undefined' || !chrome.i18n || !chrome.i18n.getMessage) {
    return '';
  }
  return chrome.i18n.getMessage(key);
}

function getRuntimePayload() {
  let version = 'local-preview';
  let locale = navigator.language || 'unknown';

  if (typeof chrome !== 'undefined') {
    if (chrome.runtime && chrome.runtime.getManifest) {
      version = chrome.runtime.getManifest().version;
    }
    if (chrome.i18n && chrome.i18n.getUILanguage) {
      locale = chrome.i18n.getUILanguage();
    }
  }

  return { version, locale };
}

function trackEvent(eventName) {
  if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) {
    return;
  }

  chrome.runtime.sendMessage({
    action: 'trackEvent',
    eventName,
    payload: getRuntimePayload()
  }, () => {
    if (chrome.runtime.lastError) {
      return;
    }
  });
}
