document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-i18n]').forEach(element => {
    const key = element.getAttribute('data-i18n');
    const message = chrome.i18n.getMessage(key);
    if (message) element.textContent = message;
  });

  chrome.runtime.sendMessage({
    action: 'trackEvent',
    eventName: 'welcome_view'
  }, () => {
    if (chrome.runtime.lastError) {
      return;
    }
  });

  const demoResult = document.getElementById('demoResult');
  document.querySelectorAll('.demo-word').forEach(wordEl => {
    wordEl.addEventListener('mouseenter', () => {
      const word = wordEl.textContent.trim();
      const meaning = wordEl.getAttribute('data-meaning') || '';
      if (demoResult) {
        demoResult.textContent = `🔎 ${word} → ${meaning}`;
      }

      chrome.runtime.sendMessage({
        action: 'trackEvent',
        eventName: 'welcome_demo_hover',
        payload: { kind: 'sample', source: 'welcome' }
      }, () => {
        if (chrome.runtime.lastError) return;
      });
    });
  });

  const testButton = document.getElementById('openTestPage');
  if (!testButton) return;

  testButton.addEventListener('click', () => {
    chrome.runtime.sendMessage({
      action: 'trackEvent',
      eventName: 'onboarding_start'
    }, () => {
      if (chrome.runtime.lastError) {
        return;
      }
    });

    chrome.tabs.create({
      url: 'https://ko.wikipedia.org/wiki/%ED%95%9C%EA%B5%AD%EC%96%B4'
    });
  });
});
